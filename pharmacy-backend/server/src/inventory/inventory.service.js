const {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} = require('@nestjs/common');
const { Op, UniqueConstraintError } = require('sequelize');
const { Batch, InventoryCategory, InventoryMovement, Medicine, Sales, sequelize } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');
const { taxonomySlug } = require('../../lib/inventory-taxonomy');
const {
  buildProductKey,
  hasProductIdentityDetails,
  normalizeIdentityValue,
  sameProductIdentity,
} = require('./product-identity');
const {
  activeBatchWhere,
  isBatchInactive,
  reserveUniqueBatchNumberCandidate,
  resolveBatchStatus,
} = require('./batch-utils');
const { toCompactProductImageUrl } = require('./image-utils');
const { DuplicateResourceException } = require('../common/errors');

const MEDICINE_UPDATE_FIELDS = [
  'name', 'genericName', 'brandName', 'category', 'dosage', 'strength', 'supplier',
  'manufacturer', 'barcode', 'imageUrl', 'lowStockThreshold', 'prescriptionRequired',
  'packSize', 'unitOfMeasure', 'isCustomerVisible', 'description', 'warnings', 'basePrice',
];

function sanitizeDate(value, defaultDate) {
  if (value && typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  return defaultDate;
}

function getDefaultExpiryDate() {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);
  return future.toISOString().split('T')[0];
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parsePositiveQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BadRequestException('Quantity must be a positive whole number');
  }
  return quantity;
}

function parseNonNegativeNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`${fieldName} must be a non-negative number`);
  }
  return number;
}

function parseNonNegativeWholeNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new BadRequestException(`${fieldName} must be a non-negative whole number`);
  }
  return number;
}

function hasBatchPayload(body = {}) {
  return body.batchNumber !== undefined || body.quantity !== undefined;
}

function medicineAttributes(body = {}) {
  const name = cleanText(body.name);
  if (!name) throw new BadRequestException('Medicine name is required');

  return {
    name,
    genericName: cleanText(body.genericName),
    category: cleanText(body.category),
    dosage: cleanText(body.dosage),
    strength: cleanText(body.strength),
    brandName: cleanText(body.brandName),
    packSize: cleanText(body.packSize),
    unitOfMeasure: cleanText(body.unitOfMeasure),
    supplier: cleanText(body.supplier),
    manufacturer: cleanText(body.manufacturer),
    barcode: cleanText(body.barcode) || cleanText(body.sku),
    imageUrl: cleanText(body.imageUrl),
    lowStockThreshold: body.lowStockThreshold === undefined && body.reorderLevel === undefined && body.threshold === undefined
      ? 10
      : parseNonNegativeWholeNumber(body.lowStockThreshold ?? body.reorderLevel ?? body.threshold, 'Low-stock threshold'),
    totalQuantity: 0,
  };
}

function updateAttributes(body = {}, existing) {
  const attributes = {};
  for (const field of MEDICINE_UPDATE_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === 'lowStockThreshold') {
      attributes[field] = parseNonNegativeWholeNumber(body[field], 'Low-stock threshold');
    } else if (field === 'prescriptionRequired' || field === 'isCustomerVisible') {
      attributes[field] = Boolean(body[field]);
    } else if (field === 'basePrice') {
      attributes[field] = parseNonNegativeNumber(body[field], 'Base price');
    } else if (field === 'name') {
      const name = cleanText(body.name);
      if (!name) throw new BadRequestException('Medicine name is required');
      attributes.name = name;
    } else {
      attributes[field] = cleanText(body[field]);
    }
  }

  return { ...existing.get({ plain: true }), ...attributes };
}

function isUniqueConstraintError(error) {
  return error instanceof UniqueConstraintError || error?.name === 'SequelizeUniqueConstraintError';
}

function isRetryableTransactionError(error) {
  const code = error?.parent?.code || error?.original?.code || '';
  const message = String(error?.message || '');
  return (
    code === 'SQLITE_BUSY'
    || code === '40001'
    || code === '40P01'
    || /SQLITE_BUSY/i.test(message)
  );
}

async function runWithTransactionRetry(operation, maxAttempts = 6) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts - 1 || !isRetryableTransactionError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1) + Math.floor(Math.random() * 25)));
    }
  }
  return undefined;
}

function rethrowPersistenceError(error, fallbackMessage) {
  if (error instanceof HttpException) throw error;
  if (isUniqueConstraintError(error)) {
    throw new DuplicateResourceException('This medicine or batch already exists. Refresh inventory and try again.');
  }

  // Names/codes aid operations without exposing database URLs, credentials, SQL, or values.
  console.error('Inventory persistence operation failed:', error?.name || 'UnknownError', error?.parent?.code || '');
  throw new InternalServerErrorException(fallbackMessage);
}

class InventoryService {
  async categories() {
    const rows = await InventoryCategory.findAll({
      order: [['level', 'ASC'], ['name', 'ASC'], ['id', 'ASC']],
    });
    const nodes = new Map(rows.map((row) => [Number(row.id), {
      id: row.id,
      name: row.name,
      slug: row.slug,
      path: row.path,
      level: row.level,
      subcategories: [],
      forms: [],
    }]));
    const categories = [];

    for (const row of rows) {
      const node = nodes.get(Number(row.id));
      if (row.level === 1) {
        categories.push(node);
      } else {
        const parent = nodes.get(Number(row.parentId));
        if (parent) {
          if (row.level === 2) parent.subcategories.push(node);
          else if (row.level === 3) parent.forms.push(node);
        }
      }
    }

    return categories;
  }

  async findCategory(value, { level, parentId, transaction } = {}) {
    if (value === undefined || value === null || value === '') return null;
    const numericId = Number(value);
    const where = { level };
    if (parentId !== undefined) where.parentId = parentId;
    if (Number.isInteger(numericId) && numericId > 0) where.id = numericId;
    else {
      const text = cleanText(value);
      where[Op.or] = [
        { slug: taxonomySlug(text) },
        { name: text },
      ];
    }
    return InventoryCategory.findOne({ where, transaction });
  }

  async findCategories(value, { level, parentIds, transaction } = {}) {
    const numericId = Number(value);
    const where = { level };
    if (Array.isArray(parentIds)) where.parentId = { [Op.in]: parentIds };
    if (Number.isInteger(numericId) && numericId > 0) where.id = numericId;
    else {
      const text = cleanText(value);
      where[Op.or] = [
        { slug: taxonomySlug(text) },
        { name: text },
      ];
    }
    return InventoryCategory.findAll({ where, order: [['id', 'ASC']], transaction });
  }

  async resolveClassification(payload = {}, transaction, { required = false } = {}) {
    const rawMain = payload.mainCategoryId ?? payload.categoryId ?? payload.category;
    const hasMain = rawMain !== undefined && rawMain !== null && rawMain !== '';
    if (!hasMain) {
      if (required) throw new BadRequestException('Main category is required');
      return {};
    }

    const mainCategory = await this.findCategory(rawMain, { level: 1, transaction });
    if (!mainCategory) throw new BadRequestException('Invalid main category');

    const rawSubcategory = payload.subcategoryId ?? payload.subcategory;
    const hasSubcategory = rawSubcategory !== undefined && rawSubcategory !== null && rawSubcategory !== '';
    let subcategory = null;
    if (hasSubcategory) {
      subcategory = await this.findCategory(rawSubcategory, {
        level: 2,
        parentId: mainCategory.id,
        transaction,
      });
      if (!subcategory) throw new BadRequestException('Subcategory does not belong to the selected main category');
    }

    const rawForm = payload.productFormId ?? payload.formId ?? payload.form ?? payload.dosage;
    const hasForm = rawForm !== undefined && rawForm !== null && rawForm !== '';
    let productForm = null;
    if (hasForm) {
      if (!subcategory) throw new BadRequestException('Select a subcategory before selecting a product form');
      productForm = await this.findCategory(rawForm, {
        level: 3,
        parentId: subcategory.id,
        transaction,
      });
      if (!productForm) throw new BadRequestException('Product form is not available for the selected subcategory');
    }

    return {
      mainCategoryId: mainCategory.id,
      subcategoryId: subcategory?.id || null,
      productFormId: productForm?.id || null,
      category: mainCategory.name,
      dosage: productForm?.name || null,
    };
  }

  async list(query) {
    const pagination = parsePagination(query);
    const where = {};
    const mainValue = query.mainCategoryId ?? query.category;
    const subcategoryValue = query.subcategoryId ?? query.subcategory;
    const formValue = query.productFormId ?? query.form;
    let selectedSubcategoryIds = null;

    if (mainValue) {
      const category = await this.findCategory(mainValue, { level: 1 });
      if (!category) throw new BadRequestException('Invalid main category filter');
      where.mainCategoryId = category.id;
    }
    if (subcategoryValue) {
      const subcategories = await this.findCategories(subcategoryValue, {
        level: 2,
        parentIds: where.mainCategoryId ? [where.mainCategoryId] : undefined,
      });
      if (subcategories.length === 0) throw new BadRequestException('Invalid subcategory filter');
      selectedSubcategoryIds = subcategories.map((subcategory) => subcategory.id);
      where.subcategoryId = selectedSubcategoryIds.length === 1
        ? selectedSubcategoryIds[0]
        : { [Op.in]: selectedSubcategoryIds };
    }
    if (formValue) {
      let parentIds = selectedSubcategoryIds;
      if (!parentIds && where.mainCategoryId) {
        const subcategories = await InventoryCategory.findAll({
          where: { level: 2, parentId: where.mainCategoryId },
          attributes: ['id'],
        });
        parentIds = subcategories.map((subcategory) => subcategory.id);
      }
      const forms = await this.findCategories(formValue, {
        level: 3,
        parentIds,
      });
      if (forms.length === 0) throw new BadRequestException('Invalid product form filter');
      where.productFormId = forms.length === 1
        ? forms[0].id
        : { [Op.in]: forms.map((form) => form.id) };
    }
    for (const [queryField, modelField] of [
      ['genericName', 'genericName'],
      ['brand', 'brandName'],
      ['supplier', 'supplier'],
    ]) {
      const value = cleanText(query[queryField]);
      if (value) where[modelField] = { [Op.like]: `%${value}%` };
    }
    const search = cleanText(query.search);
    if (search) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { genericName: { [Op.like]: `%${search}%` } },
            { brandName: { [Op.like]: `%${search}%` } },
            { barcode: { [Op.like]: `%${search}%` } },
          ],
        },
      ];
    }

    let filterIds = null;
    if (query.stockStatus || query.expiryStatus) {
      const candidates = await Medicine.findAll({
        where,
        attributes: ['id', 'lowStockThreshold'],
        raw: true,
      });
      filterIds = new Set(candidates.map((medicine) => Number(medicine.id)));
      if (query.stockStatus) {
        const quantities = await Batch.findAll({
          attributes: ['medicineId', [sequelize.fn('SUM', sequelize.col('quantity')), 'quantity']],
          where: activeBatchWhere({ medicineId: [...filterIds] }),
          group: ['medicineId'],
          raw: true,
        });
        const totals = new Map(quantities.map((row) => [Number(row.medicineId), Number(row.quantity || 0)]));
        const status = String(query.stockStatus).toLowerCase();
        if (!['low', 'out', 'in'].includes(status)) {
          throw new BadRequestException('Invalid stock status filter');
        }
        const allowed = new Set(candidates.filter((medicine) => {
          const quantity = totals.get(Number(medicine.id)) || 0;
          const threshold = Number(medicine.lowStockThreshold || 10);
          if (status === 'out') return quantity === 0;
          if (status === 'low') return quantity > 0 && quantity <= threshold;
          return quantity > threshold;
        }).map((medicine) => Number(medicine.id)));
        filterIds = new Set([...filterIds].filter((id) => allowed.has(id)));
      }
      if (query.expiryStatus) {
        const status = String(query.expiryStatus).toLowerCase();
        if (!['expired', 'near-expiry', 'valid'].includes(status)) {
          throw new BadRequestException('Invalid expiry status filter');
        }
        const today = getTodayDate();
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + 30);
        const expiryWhere = activeBatchWhere({ quantity: { [Op.gt]: 0 } });
        if (status === 'expired') expiryWhere.expiryDate = { [Op.lt]: today };
        else if (status === 'near-expiry') {
          expiryWhere.expiryDate = { [Op.gte]: today, [Op.lte]: warningDate.toISOString().slice(0, 10) };
        } else {
          expiryWhere.expiryDate = { [Op.gt]: warningDate.toISOString().slice(0, 10) };
        }
        const batches = await Batch.findAll({
          where: expiryWhere,
          attributes: ['medicineId'],
          group: ['medicineId'],
          raw: true,
        });
        const expiryIds = new Set(batches.map((batch) => Number(batch.medicineId)));
        filterIds = new Set([...filterIds].filter((id) => expiryIds.has(id)));
      }
      where.id = { [Op.in]: [...filterIds] };
    }

    const includeArchived = String(query.includeArchived || '').toLowerCase() === 'true';
    const compactImages = String(query.compactImages || '').toLowerCase() === 'true';
    const result = await Medicine.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      include: [
        includeArchived
          ? { model: Batch, required: false }
          : { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug', 'path'] },
        { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug', 'path'] },
        { model: InventoryCategory, as: 'ProductForm', attributes: ['id', 'name', 'slug', 'path'] },
      ],
      distinct: true,
      limit: pagination.limit,
      offset: pagination.offset,
    });
    const rows = compactImages
      ? result.rows.map((row) => {
          const plain = row.get({ plain: true });
          return {
            ...plain,
            imageUrl: toCompactProductImageUrl(plain),
          };
        })
      : result.rows;
    return paginatedResponse(rows, result.count, pagination);
  }

  async lowStock() {
    const lowStockMedicines = [];
    const chunkSize = 200;
    let lastId = 0;

    while (true) {
      const candidates = await Medicine.findAll({
        where: { id: { [Op.gt]: lastId } },
        attributes: ['id', 'lowStockThreshold'],
        order: [['id', 'ASC']],
        limit: chunkSize,
        raw: true,
      });
      if (candidates.length === 0) break;
      lastId = Number(candidates[candidates.length - 1].id);

      const quantities = await Batch.findAll({
        where: activeBatchWhere({ medicineId: candidates.map((medicine) => medicine.id) }),
        attributes: ['medicineId', [sequelize.fn('SUM', sequelize.col('quantity')), 'quantity']],
        group: ['medicineId'],
        raw: true,
      });
      const quantityByMedicineId = new Map(
        quantities.map((row) => [Number(row.medicineId), Number(row.quantity || 0)])
      );
      const lowStockIds = candidates
        .filter((medicine) => (
          (quantityByMedicineId.get(Number(medicine.id)) || 0) <= Number(medicine.lowStockThreshold || 0)
        ))
        .map((medicine) => medicine.id);

      if (lowStockIds.length > 0) {
        const rows = await Medicine.findAll({
          where: { id: { [Op.in]: lowStockIds } },
          include: [{ model: Batch, where: activeBatchWhere(), required: false }],
          order: [['id', 'ASC']],
        });
        lowStockMedicines.push(...rows);
      }
    }

    return lowStockMedicines;
  }

  async movements(id, query) {
    const medicine = await Medicine.findByPk(id, { attributes: ['id'] });
    if (!medicine) throw new NotFoundException('Medicine not found');

    const pagination = parsePagination(query);
    const result = await InventoryMovement.findAndCountAll({
      where: { medicineId: id },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return paginatedResponse(result.rows, result.count, pagination);
  }

  async batchHistory(id, query = {}) {
    const medicine = await Medicine.findByPk(id, { attributes: ['id', 'name', 'totalQuantity'] });
    if (!medicine) throw new NotFoundException('Medicine not found');

    const statusFilter = cleanText(query.status)?.toLowerCase();
    const batchWhere = { medicineId: id };
    if (statusFilter && ['active', 'depleted', 'archived', 'deleted'].includes(statusFilter)) {
      batchWhere.status = statusFilter;
    }

    const [batches, movements] = await Promise.all([
      Batch.findAll({
        where: batchWhere,
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      }),
      InventoryMovement.findAll({
        where: { medicineId: id },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: Math.min(Math.max(Number(query.limit) || 50, 1), 200),
      }),
    ]);

    return {
      medicineId: medicine.id,
      medicineName: medicine.name,
      totalQuantity: Number(medicine.totalQuantity || 0),
      batches,
      movements,
    };
  }

  async findMedicineByIdentity(input, transaction, excludeId = null) {
    const productKey = buildProductKey(input);
    const directWhere = { productKey };
    if (excludeId !== null) directWhere.id = { [Op.ne]: excludeId };

    const directMatch = await Medicine.findOne({
      where: directWhere,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (directMatch) return directMatch;

    // Legacy records can have NULL keys only when backfill found an ambiguous
    // duplicate group. Compare them rather than silently creating another row.
    const candidates = await Medicine.findAll({
      attributes: ['id', 'name', 'genericName', 'strength', 'dosage', 'manufacturer', 'productKey'],
      transaction,
    });
    const otherCandidates = candidates.filter((medicine) => Number(medicine.id) !== Number(excludeId));
    const exactMatches = otherCandidates.filter((medicine) => sameProductIdentity(medicine, input));
    if (exactMatches.length > 1) {
      throw new ConflictException(
        'Existing duplicate medicine records need manual review before more stock can be added to this product.'
      );
    }
    if (exactMatches.length === 1) return exactMatches[0];

    // Name-only rows remain compatible with the existing receipt UI, but the
    // service never guesses between products that share a name.
    if (!hasProductIdentityDetails(input)) {
      const normalizedName = normalizeIdentityValue(input.name);
      const sameName = otherCandidates.filter(
        (medicine) => normalizeIdentityValue(medicine.name) === normalizedName
      );
      if (sameName.length === 1) return sameName[0];
      if (sameName.length > 1) {
        throw new ConflictException(
          'Multiple medicines share this name. Provide generic name, strength, dosage form, and manufacturer.'
        );
      }
    }

    return null;
  }

  async recalculateMedicineTotal(medicine, transaction) {
    const activeSum = await Batch.sum('quantity', {
      where: activeBatchWhere({ medicineId: medicine.id }),
      transaction,
    });
    const total = Number(activeSum || 0);
    await medicine.update({ totalQuantity: total }, { transaction });
    return total;
  }

  async hasCompletedSalesForBatch(batchId, transaction) {
    const directSales = await Sales.count({
      where: {
        batchId,
        saleStatus: { [Op.ne]: 'REVERSED' },
      },
      transaction,
    });
    if (directSales > 0) return true;

    const saleMovements = await InventoryMovement.findAll({
      where: {
        batchId,
        movementType: 'SALE',
      },
      attributes: ['referenceType', 'referenceId'],
      transaction,
    });
    if (saleMovements.length === 0) return false;

    const saleIds = saleMovements
      .filter((m) => m.referenceType === 'SALE' && m.referenceId)
      .map((m) => Number(m.referenceId));
    if (saleIds.length > 0) {
      const completedViaMovement = await Sales.count({
        where: {
          id: { [Op.in]: saleIds },
          saleStatus: { [Op.ne]: 'REVERSED' },
        },
        transaction,
      });
      if (completedViaMovement > 0) return true;
    }

    const hasOnlineOrderSale = saleMovements.some((m) => m.referenceType === 'ONLINE_ORDER');
    if (hasOnlineOrderSale) {
      const returnMovements = await InventoryMovement.count({
        where: {
          batchId,
          movementType: 'RETURN',
          referenceType: 'ONLINE_ORDER_CANCELLATION',
        },
        transaction,
      });
      const onlineSalesCount = saleMovements.filter((m) => m.referenceType === 'ONLINE_ORDER').length;
      if (onlineSalesCount > returnMovements) return true;
    }

    return false;
  }

  async resolveUniqueBatchNumber(medicineId, explicitBatchNumber, actor, transaction) {
    if (explicitBatchNumber) {
      const existingBatch = await Batch.findOne({
        where: { medicineId, batchNumber: explicitBatchNumber },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingBatch) throw new DuplicateResourceException('This batch already exists for this medicine.');
      return explicitBatchNumber;
    }

    const now = new Date();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = reserveUniqueBatchNumberCandidate({ medicineId, actor, now, attempt });
      const collision = await Batch.findOne({
        where: { medicineId, batchNumber: candidate },
        attributes: ['id'],
        transaction,
      });
      if (!collision) return candidate;
    }

    throw new ConflictException('Could not generate a unique batch number. Please retry.');
  }

  async createBatchForMedicine(medicine, item, shared = {}, transaction, movementType = 'PURCHASE', actor = null) {
    const quantity = parsePositiveQuantity(item.quantity);
    const costPrice = parseNonNegativeNumber(item.costPrice ?? 0, 'Cost price');
    const sellingPrice = parseNonNegativeNumber(item.sellingPrice ?? 0, 'Selling price');
    const explicitBatchNumber = cleanText(item.batchNumber);
    const batchNumber = await this.resolveUniqueBatchNumber(medicine.id, explicitBatchNumber, actor, transaction);
    const expiryDate = sanitizeDate(item.expiryDate, getDefaultExpiryDate());
    const manufacturingDate = item.manufacturingDate
      ? sanitizeDate(item.manufacturingDate, null)
      : shared.manufacturingDate
        ? sanitizeDate(shared.manufacturingDate, null)
        : null;
    const supplier = cleanText(item.supplier) || cleanText(shared.supplier) || cleanText(medicine.supplier);
    const supplierBatchNumber = cleanText(item.supplierBatchNumber) || cleanText(shared.supplierBatchNumber) || null;
    const supplierId = Number.isInteger(Number(item.supplierId ?? shared.supplierId)) && Number(item.supplierId ?? shared.supplierId) > 0
      ? Number(item.supplierId ?? shared.supplierId)
      : null;

    const batch = await Batch.create({
      medicineId: medicine.id,
      supplierId,
      supplier,
      batchNumber,
      supplierBatchNumber,
      quantity,
      quantityReceived: quantity,
      status: 'active',
      expiryDate,
      manufacturingDate,
      costPrice,
      sellingPrice,
      warehouse: cleanText(shared.warehouse) || cleanText(item.warehouse),
      invoiceNumber: cleanText(shared.invoiceNumber) || cleanText(item.invoiceNumber),
      receivedDate: sanitizeDate(shared.receivedDate || item.receivedDate, getTodayDate()),
      createdByUserId: actor?.id || null,
      createdByUsername: actor?.username || null,
    }, { transaction });

    await this.recalculateMedicineTotal(medicine, transaction);
    await InventoryMovement.create({
      medicineId: medicine.id,
      batchId: batch.id,
      movementType,
      quantityChange: quantity,
      referenceType: shared.referenceType || 'INVENTORY_RECEIPT',
      referenceId: shared.referenceId || null,
      reason: cleanText(shared.reason) || (actor?.username ? `Stock added by ${actor.username}` : null),
    }, { transaction });

    return batch;
  }

  async addBatch(body, actor = null) {
    const transaction = await sequelize.transaction();
    try {
      const metadata = body.metadata || {};
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) throw new BadRequestException('Items array is required and must not be empty');

      const shared = {
        supplier: body.supplier || metadata.supplier || null,
        supplierId: body.supplierId || metadata.supplierId || null,
        warehouse: body.warehouse || metadata.warehouse || null,
        invoiceNumber: body.invoiceNumber || metadata.invoiceNumber || null,
        receivedDate: body.receivedDate || metadata.orderDate || metadata.receivedDate,
        reason: body.reason || metadata.reason || null,
      };
      const createdItems = [];

      for (const item of items) {
        const attributes = medicineAttributes({ ...item, supplier: shared.supplier || item.supplier });
        const existingMedicine = await this.findMedicineByIdentity(attributes, transaction);
        const classification = await this.resolveClassification(item, transaction, { required: !existingMedicine });
        if (classification.dosage) attributes.dosage = classification.dosage;
        let medicine = await this.findMedicineByIdentity(attributes, transaction);
        if (!medicine) {
          medicine = await Medicine.create({
            ...attributes,
            ...classification,
            productKey: buildProductKey(attributes),
          }, { transaction });
        } else if (classification.mainCategoryId) {
          if (medicine.mainCategoryId && (
            Number(medicine.mainCategoryId) !== Number(classification.mainCategoryId) ||
            (classification.subcategoryId && Number(medicine.subcategoryId) !== Number(classification.subcategoryId)) ||
            (classification.productFormId && Number(medicine.productFormId) !== Number(classification.productFormId))
          )) {
            throw new ConflictException('Product classification differs from the existing product. Update the product before receiving stock.');
          }
          if (!medicine.mainCategoryId) await medicine.update(classification, { transaction });
        }

        const batch = await this.createBatchForMedicine(medicine, item, shared, transaction, 'PURCHASE', actor);
        createdItems.push({ medicineId: medicine.id, batchId: batch.id, batchNumber: batch.batchNumber });
      }

      await transaction.commit();
      return { success: true, count: createdItems.length, items: createdItems };
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to process inventory receipt');
    }
  }

  async addBatchToMedicine(id, body, actor = null) {
    try {
      return await runWithTransactionRetry(async () => {
        const transaction = await sequelize.transaction();
        try {
          const medicine = await Medicine.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
          if (!medicine) throw new NotFoundException('Medicine not found');

          await this.createBatchForMedicine(medicine, body, body, transaction, 'PURCHASE', actor);
          await transaction.commit();
          return Medicine.findByPk(id, {
            include: [{ model: Batch, where: activeBatchWhere(), required: false }],
          });
        } catch (error) {
          if (!transaction.finished) {
            await transaction.rollback().catch(() => {});
          }
          throw error;
        }
      });
    } catch (error) {
      rethrowPersistenceError(error, 'Failed to add stock batch');
    }
  }

  async removeBatch(id, batchId, body = {}, actor = null) {
    const transaction = await sequelize.transaction();
    try {
      const medicine = await Medicine.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!medicine) throw new NotFoundException('Medicine not found');

      const batch = await Batch.findOne({
        where: { id: batchId, medicineId: id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!batch) throw new NotFoundException('Batch not found for this medicine');
      if (isBatchInactive(batch)) {
        throw new ConflictException('This batch has already been deleted or archived.');
      }

      const hasCompletedSales = await this.hasCompletedSalesForBatch(batch.id, transaction);
      if (hasCompletedSales) {
        throw new ConflictException(
          'This batch has been used in completed sales and cannot be deleted. Reverse the associated sale(s) first, or archive the batch once depleted.'
        );
      }

      const previousQuantity = Number(batch.quantity || 0);
      const customReason = cleanText(body?.reason);
      const reason = customReason || 'Removed from active inventory';
      const deletedAt = new Date();

      await batch.update({
        quantity: 0,
        status: 'deleted',
        deletedAt,
        deletedByUserId: actor?.id || null,
        deletedByUsername: actor?.username || null,
        deletionReason: reason,
      }, { transaction });

      await InventoryMovement.create({
        medicineId: medicine.id,
        batchId: batch.id,
        movementType: 'ADJUSTMENT',
        quantityChange: -previousQuantity,
        referenceType: 'BATCH_DELETE',
        referenceId: Number(batch.id),
        reason: customReason
          ? `Batch ${batch.batchNumber} removed from active inventory: ${customReason}`
          : `Batch ${batch.batchNumber} removed from active inventory`,
      }, { transaction });

      await this.recalculateMedicineTotal(medicine, transaction);

      await transaction.commit();
      return Medicine.findByPk(id, {
        include: [{ model: Batch, where: activeBatchWhere(), required: false }],
      });
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to delete stock batch');
    }
  }

  async archiveBatch(id, batchId, body = {}, actor = null) {
    const transaction = await sequelize.transaction();
    try {
      const medicine = await Medicine.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!medicine) throw new NotFoundException('Medicine not found');

      const batch = await Batch.findOne({
        where: { id: batchId, medicineId: id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!batch) throw new NotFoundException('Batch not found for this medicine');
      if (isBatchInactive(batch)) {
        throw new ConflictException('This batch has already been archived or deleted.');
      }

      const previousQuantity = Number(batch.quantity || 0);
      const hasCompletedSales = await this.hasCompletedSalesForBatch(batch.id, transaction);
      if (hasCompletedSales && previousQuantity > 0) {
        throw new ConflictException(
          'Batches with completed sales and remaining stock cannot be archived until stock is depleted or sales are reversed.'
        );
      }

      const reason = cleanText(body?.reason) || 'Archived by authorized user';
      await batch.update({
        quantity: 0,
        status: 'archived',
        deletedAt: new Date(),
        deletedByUserId: actor?.id || null,
        deletedByUsername: actor?.username || null,
        deletionReason: reason,
      }, { transaction });

      await InventoryMovement.create({
        medicineId: medicine.id,
        batchId: batch.id,
        movementType: 'ADJUSTMENT',
        quantityChange: -previousQuantity,
        referenceType: 'BATCH_ARCHIVE',
        referenceId: Number(batch.id),
        reason: `Batch ${batch.batchNumber} archived by ${actor?.username || 'authorized user'}: ${reason}`,
      }, { transaction });

      await this.recalculateMedicineTotal(medicine, transaction);

      await transaction.commit();
      return Medicine.findByPk(id, {
        include: [{ model: Batch, where: activeBatchWhere(), required: false }],
      });
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to archive stock batch');
    }
  }

  async add(body, actor = null) {
    const transaction = await sequelize.transaction();
    try {
      const attributes = medicineAttributes(body);
      const existingMedicine = await this.findMedicineByIdentity(attributes, transaction);
      const classification = await this.resolveClassification(body, transaction, { required: !existingMedicine });
      if (classification.dosage) attributes.dosage = classification.dosage;
      let medicine = await this.findMedicineByIdentity(attributes, transaction);
      const receivedWithBatch = hasBatchPayload(body);

      if (medicine && !receivedWithBatch) throw new DuplicateResourceException('This medicine already exists.');
      if (!medicine) {
        medicine = await Medicine.create({
          ...attributes,
          ...classification,
          productKey: buildProductKey(attributes),
        }, { transaction });
      } else if (classification.mainCategoryId && !medicine.mainCategoryId) {
        await medicine.update(classification, { transaction });
      }
      if (receivedWithBatch) await this.createBatchForMedicine(medicine, body, body, transaction, 'PURCHASE', actor);

      await transaction.commit();
      return Medicine.findByPk(medicine.id, {
        include: [{ model: Batch, where: activeBatchWhere(), required: false }],
      });
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to add inventory item');
    }
  }

  async update(id, body, actor = null) {
    const transaction = await sequelize.transaction();
    try {
      const medicine = await Medicine.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!medicine) throw new NotFoundException('Medicine not found');

      const mergedAttributes = updateAttributes(body, medicine);
      const classificationWasSubmitted = [
        body.mainCategoryId,
        body.categoryId,
        body.subcategoryId,
        body.subcategory,
        body.productFormId,
        body.formId,
        body.form,
      ].some((value) => value !== undefined && value !== null && value !== '');
      let classification = {};
      if (classificationWasSubmitted) {
        classification = await this.resolveClassification({
          mainCategoryId: body.mainCategoryId ?? body.categoryId ?? medicine.mainCategoryId,
          subcategoryId: body.subcategoryId ?? medicine.subcategoryId,
          productFormId: body.productFormId ?? body.formId ?? body.form ?? medicine.productFormId,
        }, transaction, { required: true });
      }
      const identityAttributes = classificationWasSubmitted
        ? { ...mergedAttributes, dosage: classification.dosage }
        : mergedAttributes;
      const matchingMedicine = await this.findMedicineByIdentity(identityAttributes, transaction, medicine.id);
      if (matchingMedicine) throw new DuplicateResourceException('This medicine already exists.');

      const changes = {};
      for (const field of MEDICINE_UPDATE_FIELDS) {
        if (body[field] !== undefined) changes[field] = mergedAttributes[field];
      }
      if (classificationWasSubmitted) {
        Object.assign(changes, {
          mainCategoryId: classification.mainCategoryId,
          subcategoryId: classification.subcategoryId,
          productFormId: classification.productFormId,
          category: classification.category,
          dosage: classification.dosage,
        });
      }
      if (Object.keys(changes).length > 0) {
        changes.productKey = buildProductKey(identityAttributes);
        await medicine.update(changes, { transaction });
      }

      const existingActiveBatches = await Batch.findAll({
        where: activeBatchWhere({ medicineId: id }),
        order: [['expiryDate', 'ASC'], ['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const currentTotalBeforeUpdate = existingActiveBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
      const requestedTotal = body.totalQuantity !== undefined
        ? parseNonNegativeWholeNumber(body.totalQuantity, 'Total quantity')
        : null;
      const isStockIncrease = requestedTotal !== null && requestedTotal > currentTotalBeforeUpdate;

      if (body.sellingPrice !== undefined && !isStockIncrease) {
        await Batch.update(
          { sellingPrice: parseNonNegativeNumber(body.sellingPrice, 'Selling price') },
          { where: activeBatchWhere({ medicineId: id, quantity: { [Op.gt]: 0 } }), transaction }
        );
      }
      if (body.costPrice !== undefined && !isStockIncrease) {
        await Batch.update(
          { costPrice: parseNonNegativeNumber(body.costPrice, 'Cost price') },
          { where: activeBatchWhere({ medicineId: id, quantity: { [Op.gt]: 0 } }), transaction }
        );
      }

      if (Array.isArray(body.Batches)) {
        for (const submittedBatch of body.Batches) {
          if (!submittedBatch.id) continue;
          const existingBatch = await Batch.findOne({
            where: { id: submittedBatch.id, medicineId: id },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!existingBatch) throw new NotFoundException('Batch not found for this medicine');
          if (isBatchInactive(existingBatch)) continue;

          const batchChanges = {};
          if (submittedBatch.batchNumber !== undefined) {
            const batchNumber = cleanText(submittedBatch.batchNumber);
            if (!batchNumber) throw new BadRequestException('Batch number is required');
            batchChanges.batchNumber = batchNumber;
          }
          if (submittedBatch.warehouse !== undefined) batchChanges.warehouse = cleanText(submittedBatch.warehouse);
          if (submittedBatch.expiryDate !== undefined) {
            batchChanges.expiryDate = sanitizeDate(submittedBatch.expiryDate, getDefaultExpiryDate());
          }
          if (submittedBatch.supplierBatchNumber !== undefined) {
            batchChanges.supplierBatchNumber = cleanText(submittedBatch.supplierBatchNumber);
          }
          if (submittedBatch.manufacturingDate !== undefined) {
            batchChanges.manufacturingDate = submittedBatch.manufacturingDate
              ? sanitizeDate(submittedBatch.manufacturingDate, null)
              : null;
          }
          if (Object.keys(batchChanges).length > 0) {
            await existingBatch.update(batchChanges, { transaction });
          }
        }
      }

      if (requestedTotal !== null) {
        const batches = existingActiveBatches;
        const currentTotal = currentTotalBeforeUpdate;
        const difference = requestedTotal - currentTotal;

        if (difference > 0) {
          const referenceBatch = batches.find((b) => Number(b.quantity || 0) > 0) || batches[0] || null;
          const costPrice = body.costPrice !== undefined
            ? parseNonNegativeNumber(body.costPrice, 'Cost price')
            : Number(referenceBatch?.costPrice || 0);
          const sellingPrice = body.sellingPrice !== undefined
            ? parseNonNegativeNumber(body.sellingPrice, 'Selling price')
            : Number(referenceBatch?.sellingPrice || medicine.basePrice || 0);

          await this.createBatchForMedicine(
            medicine,
            {
              quantity: difference,
              costPrice,
              sellingPrice,
              expiryDate: body.expiryDate || getDefaultExpiryDate(),
              manufacturingDate: body.manufacturingDate || null,
              supplier: body.supplier || medicine.supplier || null,
              supplierId: body.supplierId || null,
              supplierBatchNumber: body.supplierBatchNumber || null,
              warehouse: body.warehouse || referenceBatch?.warehouse || null,
            },
            {
              referenceType: 'MEDICINE',
              referenceId: Number(id),
              reason: cleanText(body.reason) || `Manual stock addition by ${actor?.username || 'authorized user'}`,
            },
            transaction,
            'ADJUSTMENT',
            actor
          );
        } else if (difference < 0) {
          let remaining = Math.abs(difference);
          for (const batch of batches) {
            if (remaining <= 0) break;
            const deduction = Math.min(Number(batch.quantity || 0), remaining);
            if (deduction === 0) continue;
            const nextQty = Number(batch.quantity) - deduction;
            await batch.update({
              quantity: nextQty,
              status: resolveBatchStatus(nextQty, batch.status),
            }, { transaction });
            await InventoryMovement.create({
              medicineId: id,
              batchId: batch.id,
              movementType: 'ADJUSTMENT',
              quantityChange: -deduction,
              referenceType: 'MEDICINE',
              referenceId: Number(id),
              reason: cleanText(body.reason) || 'Manual inventory quantity adjustment',
            }, { transaction });
            remaining -= deduction;
          }
          await this.recalculateMedicineTotal(medicine, transaction);
        }
      }

      await transaction.commit();
      return Medicine.findByPk(id, {
        include: [{ model: Batch, where: activeBatchWhere(), required: false }],
      });
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to update inventory item');
    }
  }

  async remove(id) {
    const transaction = await sequelize.transaction();
    try {
      const medicine = await Medicine.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!medicine) throw new NotFoundException('Medicine not found');
      await medicine.destroy({ transaction });
      await transaction.commit();
      return { message: 'Medicine deleted' };
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to delete medicine');
    }
  }
}

Injectable()(InventoryService);
module.exports = InventoryService;
