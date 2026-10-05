const {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} = require('@nestjs/common');
const { Op, UniqueConstraintError } = require('sequelize');
const { Batch, InventoryCategory, InventoryMovement, Medicine, sequelize } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');
const { taxonomySlug } = require('../../lib/inventory-taxonomy');
const {
  buildProductKey,
  hasProductIdentityDetails,
  normalizeIdentityValue,
  sameProductIdentity,
} = require('./product-identity');

const MEDICINE_UPDATE_FIELDS = [
  'name', 'genericName', 'brandName', 'category', 'dosage', 'strength', 'supplier',
  'manufacturer', 'barcode', 'imageUrl', 'lowStockThreshold', 'prescriptionRequired',
  'packSize', 'unitOfMeasure',
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
    } else if (field === 'prescriptionRequired') {
      attributes[field] = Boolean(body[field]);
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

function generatedBatchNumber(prefix = 'BATCH') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function isUniqueConstraintError(error) {
  return error instanceof UniqueConstraintError || error?.name === 'SequelizeUniqueConstraintError';
}

function rethrowPersistenceError(error, fallbackMessage) {
  if (error instanceof HttpException) throw error;
  if (isUniqueConstraintError(error)) {
    throw new ConflictException('This medicine or batch already exists. Refresh inventory and try again.');
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
          where: { medicineId: [...filterIds] },
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
        const expiryWhere = { quantity: { [Op.gt]: 0 } };
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

    const result = await Medicine.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      include: [
        { model: Batch },
        { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug', 'path'] },
        { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug', 'path'] },
        { model: InventoryCategory, as: 'ProductForm', attributes: ['id', 'name', 'slug', 'path'] },
      ],
      distinct: true,
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return paginatedResponse(result.rows, result.count, pagination);
  }

  async lowStock() {
    const medicines = await Medicine.findAll({ include: [Batch] });
    return medicines.filter((medicine) => {
      const total = medicine.Batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
      return total <= medicine.lowStockThreshold;
    });
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

  async createBatchForMedicine(medicine, item, shared, transaction, movementType = 'PURCHASE') {
    const quantity = parsePositiveQuantity(item.quantity);
    const costPrice = parseNonNegativeNumber(item.costPrice ?? 0, 'Cost price');
    const sellingPrice = parseNonNegativeNumber(item.sellingPrice ?? 0, 'Selling price');
    const explicitBatchNumber = cleanText(item.batchNumber);
    const batchNumber = explicitBatchNumber || generatedBatchNumber();
    const expiryDate = sanitizeDate(item.expiryDate, getDefaultExpiryDate());

    const existingBatch = await Batch.findOne({
      where: { medicineId: medicine.id, batchNumber },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingBatch) throw new ConflictException('This batch already exists for this medicine.');

    const batch = await Batch.create({
      medicineId: medicine.id,
      batchNumber,
      quantity,
      expiryDate,
      costPrice,
      sellingPrice,
      warehouse: cleanText(shared.warehouse) || cleanText(item.warehouse),
      invoiceNumber: cleanText(shared.invoiceNumber) || cleanText(item.invoiceNumber),
      receivedDate: sanitizeDate(shared.receivedDate || item.receivedDate, getTodayDate()),
    }, { transaction });

    await medicine.increment('totalQuantity', { by: quantity, transaction });
    await InventoryMovement.create({
      medicineId: medicine.id,
      batchId: batch.id,
      movementType,
      quantityChange: quantity,
      referenceType: shared.referenceType || 'INVENTORY_RECEIPT',
      referenceId: shared.referenceId || null,
      reason: cleanText(shared.reason),
    }, { transaction });

    return batch;
  }

  async addBatch(body) {
    const transaction = await sequelize.transaction();
    try {
      const metadata = body.metadata || {};
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) throw new BadRequestException('Items array is required and must not be empty');

      const shared = {
        supplier: body.supplier || metadata.supplier || null,
        warehouse: body.warehouse || metadata.warehouse || null,
        invoiceNumber: body.invoiceNumber || metadata.invoiceNumber || null,
        receivedDate: body.receivedDate || metadata.orderDate || metadata.receivedDate,
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

        const batch = await this.createBatchForMedicine(medicine, item, shared, transaction);
        createdItems.push({ medicineId: medicine.id, batchId: batch.id });
      }

      await transaction.commit();
      return { success: true, count: createdItems.length, items: createdItems };
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to process inventory receipt');
    }
  }

  async add(body) {
    const transaction = await sequelize.transaction();
    try {
      const attributes = medicineAttributes(body);
      const existingMedicine = await this.findMedicineByIdentity(attributes, transaction);
      const classification = await this.resolveClassification(body, transaction, { required: !existingMedicine });
      if (classification.dosage) attributes.dosage = classification.dosage;
      let medicine = await this.findMedicineByIdentity(attributes, transaction);
      const receivedWithBatch = hasBatchPayload(body);

      if (medicine && !receivedWithBatch) throw new ConflictException('This medicine already exists.');
      if (!medicine) {
        medicine = await Medicine.create({
          ...attributes,
          ...classification,
          productKey: buildProductKey(attributes),
        }, { transaction });
      } else if (classification.mainCategoryId && !medicine.mainCategoryId) {
        await medicine.update(classification, { transaction });
      }
      if (receivedWithBatch) await this.createBatchForMedicine(medicine, body, body, transaction);

      await transaction.commit();
      return Medicine.findByPk(medicine.id, { include: [Batch] });
    } catch (error) {
      await transaction.rollback();
      rethrowPersistenceError(error, 'Failed to add inventory item');
    }
  }

  async update(id, body) {
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
      if (matchingMedicine) throw new ConflictException('This medicine already exists.');

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

      if (body.sellingPrice !== undefined) {
        await Batch.update(
          { sellingPrice: parseNonNegativeNumber(body.sellingPrice, 'Selling price') },
          { where: { medicineId: id }, transaction }
        );
      }
      if (body.costPrice !== undefined) {
        await Batch.update(
          { costPrice: parseNonNegativeNumber(body.costPrice, 'Cost price') },
          { where: { medicineId: id }, transaction }
        );
      }

      if (Array.isArray(body.Batches)) {
        for (const submittedBatch of body.Batches) {
          if (!submittedBatch.id) continue;
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
          if (Object.keys(batchChanges).length > 0) {
            const [updated] = await Batch.update(batchChanges, {
              where: { id: submittedBatch.id, medicineId: id },
              transaction,
            });
            if (updated === 0) throw new NotFoundException('Batch not found for this medicine');
          }
        }
      }

      if (body.totalQuantity !== undefined) {
        const requestedTotal = parseNonNegativeWholeNumber(body.totalQuantity, 'Total quantity');
        const batches = await Batch.findAll({
          where: { medicineId: id },
          order: [['expiryDate', 'ASC'], ['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const currentTotal = batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
        const difference = requestedTotal - currentTotal;

        if (difference > 0) {
          const batch = await Batch.create({
            medicineId: id,
            batchNumber: generatedBatchNumber('ADJ'),
            quantity: difference,
            expiryDate: getDefaultExpiryDate(),
            costPrice: body.costPrice === undefined ? 0 : parseNonNegativeNumber(body.costPrice, 'Cost price'),
            sellingPrice: body.sellingPrice === undefined ? 0 : parseNonNegativeNumber(body.sellingPrice, 'Selling price'),
          }, { transaction });
          await InventoryMovement.create({
            medicineId: id,
            batchId: batch.id,
            movementType: 'ADJUSTMENT',
            quantityChange: difference,
            referenceType: 'MEDICINE',
            referenceId: Number(id),
            reason: 'Manual inventory quantity adjustment',
          }, { transaction });
        } else if (difference < 0) {
          let remaining = Math.abs(difference);
          for (const batch of batches) {
            if (remaining <= 0) break;
            const deduction = Math.min(Number(batch.quantity || 0), remaining);
            if (deduction === 0) continue;
            await batch.update({ quantity: Number(batch.quantity) - deduction }, { transaction });
            await InventoryMovement.create({
              medicineId: id,
              batchId: batch.id,
              movementType: 'ADJUSTMENT',
              quantityChange: -deduction,
              referenceType: 'MEDICINE',
              referenceId: Number(id),
              reason: 'Manual inventory quantity adjustment',
            }, { transaction });
            remaining -= deduction;
          }
        }
        await medicine.update({ totalQuantity: requestedTotal }, { transaction });
      }

      await transaction.commit();
      return Medicine.findByPk(id, { include: [Batch] });
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
