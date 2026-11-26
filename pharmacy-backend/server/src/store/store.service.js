const {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} = require('@nestjs/common');
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const { InsufficientStockException, OrderStateException } = require('../common/errors');
const { Op, col, fn } = require('sequelize');
const {
  Batch,
  Customer,
  InventoryCategory,
  InventoryMovement,
  Medicine,
  Order,
  OrderItem,
  OrderItemReservation,
  OrderPaymentEvent,
  Prescription,
  ReplenishmentTask,
  Sales,
  SupportInquiry,
  User,
  sequelize,
} = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');
const {
  validateAndNormalizePhone,
  validateAndNormalizeOptionalEmail,
} = require('./contact-validation');
const searchService = require('./search.service');
const { activeBatchWhere, isBatchInactive, resolveBatchStatus } = require('../inventory/batch-utils');
const { parseImageDataUri, toCompactProductImageUrl } = require('../inventory/image-utils');
const { sendReceiptEmail } = require('../sales/receipt-email');

function validatePrescriptionFile(fileData) {
  if (!fileData) return null;
  if (typeof fileData !== 'string') {
    throw new BadRequestException('Prescription file must be a supported image or PDF');
  }

  const headerMatch = fileData.trim().match(/^data:(image\/(?:jpe?g|png)|application\/pdf);base64,([\s\S]+)$/i);
  if (!headerMatch) {
    throw new BadRequestException('Prescription file must be a PNG, JPEG, or PDF under 5 MB');
  }

  const rawMime = headerMatch[1].toLowerCase();
  const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  const encoded = headerMatch[2].replace(/\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new BadRequestException('Prescription file must be a PNG, JPEG, or PDF under 5 MB');
  }

  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const decodedSize = Math.floor(encoded.length * 3 / 4) - padding;
  if (decodedSize <= 0 || decodedSize > 5 * 1024 * 1024) {
    throw new BadRequestException('Prescription file must be a PNG, JPEG, or PDF under 5 MB');
  }
  return `data:${normalizedMime};base64,${encoded}`;
}

function calculateProductPrice(medicine) {
  const activeBatches = Array.isArray(medicine.Batches)
    ? medicine.Batches.filter((batch) => !isBatchInactive(batch))
    : [];
  if (activeBatches.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const validBatches = activeBatches
      .filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate >= today && Number(batch.sellingPrice) > 0)
      .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
    if (validBatches.length > 0) {
      return Number(validBatches[0].sellingPrice);
    }
    const configuredBatch = activeBatches
      .filter((batch) => Number(batch.sellingPrice) > 0)
      .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)))[0];
    if (configuredBatch) {
      return Number(configuredBatch.sellingPrice);
    }
  }
  return Number(medicine.basePrice || 0);
}

function formatProduct(medicine, options = {}) {
  const plain = typeof medicine.get === 'function' ? medicine.get({ plain: true }) : medicine;
  const price = calculateProductPrice(plain);
  const today = new Date().toISOString().slice(0, 10);
  const availableStock = (Array.isArray(plain.Batches) ? plain.Batches : [])
    .filter((batch) => (
      !isBatchInactive(batch)
      && String(batch.expiryDate) >= today
    ))
    .reduce((sum, batch) => (
      sum + Math.max(0, Number(batch.quantity || 0) - Number(batch.reservedQuantity || 0))
    ), 0);
  const hasBatches = Array.isArray(plain.Batches) && plain.Batches.length > 0;
  const fallbackStock = Math.max(
    0,
    Number(plain.totalQuantity || 0) - Number(plain.reservedQuantity || 0)
  );
  const preorderEligible = !Boolean(plain.prescriptionRequired);
  const orderableStock = hasBatches ? availableStock : fallbackStock;
  const imageUrl = options.compactImages
    ? toCompactProductImageUrl(plain)
    : plain.imageUrl;

  return {
    id: plain.id,
    name: plain.name,
    genericName: plain.genericName,
    brandName: plain.brandName,
    category: plain.category,
    strength: plain.strength,
    dosage: plain.dosage,
    manufacturer: plain.manufacturer,
    imageUrl,
    description: plain.description,
    warnings: plain.warnings,
    packSize: plain.packSize,
    unitOfMeasure: plain.unitOfMeasure,
    mainCategoryId: plain.mainCategoryId,
    subcategoryId: plain.subcategoryId,
    productFormId: plain.productFormId,
    MainCategory: plain.MainCategory,
    Subcategory: plain.Subcategory,
    ProductForm: plain.ProductForm,
    price,
    prescriptionRequired: Boolean(plain.prescriptionRequired),
    availabilityStatus: orderableStock > 0 ? 'in_stock' : (preorderEligible ? 'preorder' : 'unavailable'),
    preorderEligible,
  };
}

class StoreService {
  async listProducts(query = {}) {
    const pagination = parsePagination(query);
    const compactImages = String(query.compactImages || '').toLowerCase() === 'true';

    if (query.search) {
      const searchResult = await searchService.searchProducts({
        query: query.search,
        category: query.category,
        subcategoryId: query.subcategoryId,
        productFormId: query.productFormId,
        prescriptionRequired: query.prescriptionRequired,
        sort: query.sort,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        page: pagination.page,
        limit: pagination.limit,
        sessionId: query.sessionId,
      });

      if (searchResult) {
        let scoredItems = searchResult.scoredProducts;

        if (query.mainCategoryId || query.category) {
          const catParam = String(query.mainCategoryId || query.category).toLowerCase();
          scoredItems = scoredItems.filter((item) => {
            const m = item.medicine;
            if (!isNaN(Number(catParam))) return m.mainCategoryId === Number(catParam);
            return (
              (m.MainCategory && m.MainCategory.slug === catParam) ||
              (m.category && m.category.toLowerCase().includes(catParam))
            );
          });
        }

        if (query.subcategoryId) {
          scoredItems = scoredItems.filter((item) => item.medicine.subcategoryId === Number(query.subcategoryId));
        }

        if (query.productFormId) {
          scoredItems = scoredItems.filter((item) => item.medicine.productFormId === Number(query.productFormId));
        }

        let formatted = scoredItems.map(({ medicine, score, matchType }) => ({
          ...formatProduct(medicine, { compactImages }),
          searchScore: score,
          searchMatchType: matchType,
        }));

        if (query.minPrice !== undefined && !isNaN(Number(query.minPrice))) {
          formatted = formatted.filter((p) => p.price >= Number(query.minPrice));
        }
        if (query.maxPrice !== undefined && !isNaN(Number(query.maxPrice))) {
          formatted = formatted.filter((p) => p.price <= Number(query.maxPrice));
        }

        if (query.sort === 'price_asc') {
          formatted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
        } else if (query.sort === 'price_desc') {
          formatted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
        } else if (query.sort === 'newest') {
          formatted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        const total = formatted.length;
        const pagedRows = formatted.slice(pagination.offset, pagination.offset + pagination.limit);

        const response = paginatedResponse(pagedRows, total, pagination);
        response.search = {
          query: query.search,
          spellingSuggestion: searchResult.spellingSuggestion,
          categorySuggestions: searchResult.categorySuggestions,
          suggestedSearchTerms: searchResult.suggestedSearchTerms || [],
          expandedSynonyms: searchResult.expandedSynonyms,
        };

        if (total === 0) {
          const related = await this.getSuggestedProductsForEmptySearch(searchResult.categorySuggestions);
          response.search.relatedProducts = related;
        }

        return response;
      }
    }

    const where = {
      isCustomerVisible: true,
    };
    const clauses = [];

    if (query.mainCategoryId || query.category) {
      const catParam = query.mainCategoryId || query.category;
      if (!isNaN(Number(catParam))) {
        where.mainCategoryId = Number(catParam);
      } else {
        const cat = await InventoryCategory.findOne({
          where: {
            [Op.or]: [
              { slug: catParam.toLowerCase() },
              { name: catParam },
              { path: catParam.toLowerCase() },
              { slug: { [Op.like]: `%${catParam.toLowerCase()}%` } },
              { name: { [Op.like]: `%${catParam}%` } },
            ],
          },
        });
        if (cat) {
          clauses.push({ [Op.or]: [
            { mainCategoryId: cat.id },
            { subcategoryId: cat.id },
            { productFormId: cat.id },
            { category: cat.name },
          ] });
        } else {
          where.category = { [Op.like]: `%${catParam}%` };
        }
      }
    }

    if (query.subcategoryId || query.subcategory) {
      const subParam = query.subcategoryId || query.subcategory;
      if (!isNaN(Number(subParam))) {
        where.subcategoryId = Number(subParam);
      } else {
        clauses.push({ subcategoryId: {
          [Op.in]: (await InventoryCategory.findAll({
            where: { [Op.or]: [{ slug: subParam }, { path: subParam }] },
            attributes: ['id'],
          })).map((category) => category.id),
        } });
      }
    }

    if (query.productFormId || query.form) {
      const formParam = query.productFormId || query.form;
      if (!isNaN(Number(formParam))) {
        where.productFormId = Number(formParam);
      }
    }

    if (query.prescriptionRequired !== undefined && query.prescriptionRequired !== '') {
      where.prescriptionRequired = String(query.prescriptionRequired) === 'true';
    }

    let order = [['name', 'ASC']];
    if (query.sort === 'price_asc') {
      order = [['basePrice', 'ASC'], ['name', 'ASC']];
    } else if (query.sort === 'price_desc') {
      order = [['basePrice', 'DESC'], ['name', 'ASC']];
    } else if (query.sort === 'newest') {
      order = [['createdAt', 'DESC']];
    }

    if (clauses.length > 0) where[Op.and] = clauses;
    const requiresDerivedFiltering = (query.minPrice !== undefined && !isNaN(Number(query.minPrice)))
      || (query.maxPrice !== undefined && !isNaN(Number(query.maxPrice)))
      || query.sort === 'price_asc'
      || query.sort === 'price_desc';

    if (requiresDerivedFiltering) {
      return this.listProductsWithDerivedFilters(where, query, pagination);
    }

    const { count, rows } = await Medicine.findAndCountAll({
      where,
      include: [
        { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'ProductForm', attributes: ['id', 'name', 'slug'] },
      ],
      order,
      distinct: true,
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return paginatedResponse(
      rows.map((medicine) => formatProduct(medicine, { compactImages })),
      count,
      pagination
    );
  }

  async listProductsWithDerivedFilters(where, query, pagination) {
    const isPriceSort = query.sort === 'price_asc' || query.sort === 'price_desc';
    const maxRetainedRows = pagination.offset + pagination.limit;
    if (isPriceSort && pagination.offset > 5000) {
      throw new BadRequestException('Price-sorted product pages cannot exceed the supported depth');
    }

    const minPrice = query.minPrice !== undefined && !isNaN(Number(query.minPrice))
      ? Number(query.minPrice)
      : null;
    const maxPrice = query.maxPrice !== undefined && !isNaN(Number(query.maxPrice))
      ? Number(query.maxPrice)
      : null;
    const chunkSize = 200;
    const pageRows = [];
    let rankedRows = [];
    let matchedCount = 0;
    let offset = 0;
    const comparePrice = query.sort === 'price_desc'
      ? (left, right) => right.price - left.price || left.name.localeCompare(right.name)
      : (left, right) => left.price - right.price || left.name.localeCompare(right.name);

    while (true) {
      const rows = await Medicine.findAll({
        where,
        attributes: ['id', 'name', 'basePrice'],
        include: [{
          model: Batch,
          attributes: ['quantity', 'expiryDate', 'sellingPrice', 'status'],
          where: activeBatchWhere(),
          required: false,
        }],
        order: [['name', 'ASC'], ['id', 'ASC']],
        limit: chunkSize,
        offset,
      });
      if (rows.length === 0) break;

      for (const medicine of rows) {
        const plain = medicine.get({ plain: true });
        const price = calculateProductPrice(plain);
        if ((minPrice !== null && price < minPrice) || (maxPrice !== null && price > maxPrice)) continue;

        if (isPriceSort) {
          rankedRows.push({ id: plain.id, name: plain.name, price });
        } else if (matchedCount >= pagination.offset && pageRows.length < pagination.limit) {
          pageRows.push({ id: plain.id });
        }
        matchedCount += 1;
      }

      if (isPriceSort && rankedRows.length > maxRetainedRows * 2) {
        rankedRows.sort(comparePrice);
        rankedRows = rankedRows.slice(0, maxRetainedRows);
      }
      if (rows.length < chunkSize) break;
      offset += rows.length;
    }

    let selectedRows = pageRows;
    if (isPriceSort) {
      rankedRows.sort(comparePrice);
      selectedRows = rankedRows.slice(pagination.offset, pagination.offset + pagination.limit);
    }
    if (selectedRows.length === 0) return paginatedResponse([], matchedCount, pagination);

    const ids = selectedRows.map((row) => row.id);
    const selectedMedicines = await Medicine.findAll({
      where: { id: { [Op.in]: ids } },
      include: [
        { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'ProductForm', attributes: ['id', 'name', 'slug'] },
      ],
    });
    const compactImages = String(query.compactImages || '').toLowerCase() === 'true';
    const medicineById = new Map(selectedMedicines.map((medicine) => [Number(medicine.id), medicine]));
    const formattedRows = ids
      .map((id) => medicineById.get(Number(id)))
      .filter(Boolean)
      .map((medicine) => formatProduct(medicine, { compactImages }));
    return paginatedResponse(formattedRows, matchedCount, pagination);
  }

  async getProductImage(id, req, res) {
    const medicineId = Number(id);
    if (!Number.isInteger(medicineId) || medicineId <= 0) {
      throw new NotFoundException('Product image not found');
    }

    const medicine = await Medicine.findByPk(medicineId, {
      attributes: ['id', 'imageUrl', 'updatedAt'],
    });
    if (!medicine || typeof medicine.imageUrl !== 'string' || !medicine.imageUrl.trim()) {
      throw new NotFoundException('Product image not found');
    }

    const rawUrl = medicine.imageUrl.trim();
    if (/^https?:\/\//i.test(rawUrl)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.redirect(302, rawUrl);
    }

    const parsed = parseImageDataUri(rawUrl);
    if (!parsed) {
      throw new NotFoundException('Product image not found');
    }

    res.setHeader('Content-Type', parsed.contentType);
    res.setHeader('Content-Length', String(parsed.buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', parsed.etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (req?.headers?.['if-none-match'] === parsed.etag) {
      return res.status(304).end();
    }

    return res.status(200).send(parsed.buffer);
  }

  async getProduct(id) {
    const medicine = await Medicine.findByPk(id, {
      include: [
        { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory' },
        { model: InventoryCategory, as: 'Subcategory' },
        { model: InventoryCategory, as: 'ProductForm' },
      ],
    });
    if (!medicine || medicine.isCustomerVisible === false) {
      throw new NotFoundException('Product not found');
    }
    return formatProduct(medicine);
  }

  async getPopularProducts(limit = 8) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 8;
    const medicines = await Medicine.findAll({
      where: { isCustomerVisible: true },
      include: [{ model: Batch, where: activeBatchWhere(), required: false }],
      limit: safeLimit,
    });
    const formatted = medicines.map(formatProduct);
    return formatted;
  }

  async getCategories() {
    const categories = await InventoryCategory.findAll({
      where: { level: 1 },
      include: [
        {
          model: InventoryCategory,
          as: 'Children',
          where: { level: 2 },
          required: false,
          include: [
            {
              model: InventoryCategory,
              as: 'Children',
              where: { level: 3 },
              required: false,
            },
          ],
        },
      ],
      order: [['id', 'ASC']],
    });
    return categories;
  }

  async getSuggestedProductsForEmptySearch(categorySuggestions = []) {
    try {
      const includes = [
        { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug'] },
      ];
      let candidates = [];

      if (categorySuggestions.length > 0) {
        const orClauses = categorySuggestions.map((cat) =>
          searchService.buildCaseInsensitiveLike('category', `%${cat}%`)
        );
        candidates = await Medicine.findAll({
          where: {
            isCustomerVisible: true,
            [Op.or]: orClauses,
          },
          include: includes,
          limit: 12,
        });
      }

      if (candidates.length === 0) {
        candidates = await Medicine.findAll({
          where: { isCustomerVisible: true },
          include: includes,
          limit: 12,
        });
      }

      candidates.sort((a, b) => {
        const aInStock = searchService.calculateAvailableStock(a) > 0 ? 1 : 0;
        const bInStock = searchService.calculateAvailableStock(b) > 0 ? 1 : 0;
        if (bInStock !== aInStock) return bInStock - aInStock;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

      return candidates.slice(0, 6).map(formatProduct);
    } catch (err) {
      return [];
    }
  }

  async getAutocomplete(query) {
    return searchService.getAutocompleteSuggestions(query?.q || query?.search, query?.limit ? Number(query.limit) : 8);
  }

  async getProductAlternatives(id) {
    const result = await searchService.getProductAlternatives(id);
    if (!result) {
      throw new NotFoundException('Product not found');
    }
    return {
      targetProduct: result.targetProduct,
      directEquivalents: result.directEquivalents.map((alt) => ({
        ...alt,
        medicine: formatProduct(alt.medicine),
      })),
      differentStrengthOrForm: result.differentStrengthOrForm.map((alt) => ({
        ...alt,
        medicine: formatProduct(alt.medicine),
      })),
      relatedTherapeutic: result.relatedTherapeutic.map((alt) => ({
        ...alt,
        medicine: formatProduct(alt.medicine),
      })),
    };
  }

  async recordSearchClick(body) {
    return searchService.recordSearchClick(body || {});
  }

  async getSearchAnalytics(query) {
    return searchService.getSearchAnalyticsSummary(query?.days ? Number(query.days) : 30);
  }

  async createOrder(payload, user = null) {
    if (!this.getPaymentReadiness().available) {
      throw new ServiceUnavailableException('Online checkout is unavailable until a payment provider is configured');
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) throw new BadRequestException('Order must contain at least one item');
    if (!payload.customerName || !payload.customerPhone) {
      throw new BadRequestException('Customer name and phone number are required');
    }
    const phone = validateAndNormalizePhone(payload.customerPhone);
    if (!phone.valid) throw new BadRequestException(phone.error);
    const email = validateAndNormalizeOptionalEmail(payload.customerEmail);
    if (!email.valid) throw new BadRequestException(email.error);

    const deliveryMethod = payload.deliveryMethod || 'delivery';
    if (!['delivery', 'pickup'].includes(deliveryMethod)) {
      throw new BadRequestException('Invalid delivery method');
    }
    if (deliveryMethod === 'delivery' && !String(payload.deliveryAddress || '').trim()) {
      throw new BadRequestException('A delivery address is required');
    }
    const paymentMethod = payload.paymentMethod || 'Mobile Money';
    if (!['Online Gateway', 'Mobile Money', 'Cash on Delivery', 'Bank Transfer'].includes(paymentMethod)) {
      throw new BadRequestException('Invalid payment method');
    }

    const groupedItems = new Map();
    for (const item of items) {
      const medicineId = Number(item.id || item.medicineId);
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isInteger(medicineId) || medicineId <= 0) {
        throw new BadRequestException('A valid product is required for each order item');
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('Order quantities must be positive whole numbers');
      }
      const current = groupedItems.get(medicineId);
      groupedItems.set(medicineId, {
        medicineId,
        quantity: quantity + (current?.quantity || 0),
      });
    }

    return sequelize.transaction(async (transaction) => {
      const orderNumber = `ORD-${randomBytes(10).toString('hex').toUpperCase()}`;
      const preparedItems = [];
      let calculatedSubtotal = 0;
      const today = new Date().toISOString().slice(0, 10);

      for (const { medicineId, quantity } of groupedItems.values()) {
        const medicine = await Medicine.findByPk(medicineId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!medicine || medicine.isCustomerVisible === false) {
          throw new NotFoundException('This product is not available for customer orders');
        }
        if (medicine.prescriptionRequired) {
          throw new BadRequestException('Prescription-required products must be reviewed by a pharmacist before checkout');
        }

        const batches = await Batch.findAll({
          where: activeBatchWhere({ medicineId }),
          order: [['expiryDate', 'ASC'], ['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const saleableBatches = batches.filter((batch) => (
          String(batch.expiryDate) >= today && Number(batch.quantity || 0) > 0
        ));
        const physicalQuantity = batches.length > 0
          ? saleableBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
          : Number(medicine.totalQuantity || 0);
        const reservedQuantity = batches.length > 0
          ? saleableBatches.reduce((sum, batch) => sum + Number(batch.reservedQuantity || 0), 0)
          : Number(medicine.reservedQuantity || 0);
        const availableQuantity = Math.max(0, physicalQuantity - reservedQuantity);
        const itemPrice = calculateProductPrice({ basePrice: medicine.basePrice, Batches: batches });
        if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
          throw new BadRequestException(`A valid selling price is not configured for ${medicine.name}`);
        }

        let quantityToReserve = Math.min(availableQuantity, quantity);
        const allocations = [];
        for (const batch of saleableBatches) {
          if (quantityToReserve <= 0) break;
          const freeQuantity = Math.max(
            0,
            Number(batch.quantity || 0) - Number(batch.reservedQuantity || 0)
          );
          const allocation = Math.min(freeQuantity, quantityToReserve);
          if (allocation <= 0) continue;
          await batch.update({
            reservedQuantity: Number(batch.reservedQuantity || 0) + allocation,
          }, { transaction });
          allocations.push({ batchId: batch.id, quantity: allocation });
          quantityToReserve -= allocation;
        }
        const reservedForItem = Math.min(availableQuantity, quantity);
        const preorderQuantity = quantity - reservedForItem;
        if (reservedForItem > 0) {
          await medicine.update({
            reservedQuantity: Number(medicine.reservedQuantity || 0) + reservedForItem,
          }, { transaction });
          if (batches.length === 0) allocations.push({ batchId: null, quantity: reservedForItem });
        }

        calculatedSubtotal += itemPrice * quantity;
        preparedItems.push({
          medicine,
          quantity,
          unitPrice: itemPrice,
          totalPrice: itemPrice * quantity,
          reservedQuantity: reservedForItem,
          preorderQuantity,
          allocations,
        });
      }

      let customerId = null;
      if (user) {
        let existingCustomer = await Customer.findOne({ where: { userId: user.id }, transaction });
        if (!existingCustomer) {
          existingCustomer = await Customer.create({
            name: payload.customerName,
            phone: payload.customerPhone,
            email: payload.customerEmail || null,
            address: payload.deliveryAddress || null,
            userId: user.id,
          }, { transaction });
        }
        customerId = existingCustomer.id;
      }

      const deliveryFee = 0;
      const order = await Order.create({
        orderNumber,
        customerId,
        userId: user ? user.id : null,
        customerName: String(payload.customerName).trim(),
        customerPhone: phone.normalized,
        customerEmail: email.normalized,
        deliveryMethod,
        deliveryProvider: deliveryMethod === 'delivery' ? 'Yango' : null,
        deliveryAddress: payload.deliveryAddress || null,
        deliveryProvince: payload.deliveryProvince || null,
        deliveryCity: payload.deliveryCity || null,
        deliveryArea: payload.deliveryArea || null,
        deliveryLandmark: payload.deliveryLandmark || null,
        paymentMethod,
        paymentStatus: 'Pending',
        orderStatus: 'Order Placed',
        subtotal: calculatedSubtotal,
        deliveryFee,
        totalAmount: calculatedSubtotal + deliveryFee,
        items: [],
        prescriptionReference: null,
        notes: payload.notes || null,
        date: new Date(),
      }, { transaction });

      const orderItems = [];
      for (const prepared of preparedItems) {
        const item = await OrderItem.create({
          orderId: order.id,
          medicineId: prepared.medicine.id,
          productName: prepared.medicine.name,
          quantity: prepared.quantity,
          reservedQuantity: prepared.reservedQuantity,
          preorderQuantity: prepared.preorderQuantity,
          unitPrice: prepared.unitPrice,
          totalPrice: prepared.totalPrice,
          fulfillmentStatus: prepared.preorderQuantity > 0 ? 'Awaiting Stock' : 'Awaiting Payment',
          outstandingPreorderQuantity: prepared.preorderQuantity,
        }, { transaction });
        for (const allocation of prepared.allocations) {
          await OrderItemReservation.create({
            orderItemId: item.id,
            batchId: allocation.batchId,
            quantity: allocation.quantity,
          }, { transaction });
        }
        if (prepared.preorderQuantity > 0) {
          await ReplenishmentTask.create({
            orderItemId: item.id,
            outstandingQuantity: prepared.preorderQuantity,
            status: 'Open',
          }, { transaction });
        }
        orderItems.push({
          id: prepared.medicine.id,
          orderItemId: item.id,
          name: prepared.medicine.name,
          quantity: prepared.quantity,
          reservedQuantity: prepared.reservedQuantity,
          preorderQuantity: prepared.preorderQuantity,
          outstandingPreorderQuantity: prepared.preorderQuantity,
          fulfillmentStatus: item.fulfillmentStatus,
          estimatedFulfillmentAt: null,
          price: prepared.unitPrice,
          total: prepared.totalPrice,
          dosage: prepared.medicine.dosage,
          strength: prepared.medicine.strength,
          imageUrl: prepared.medicine.imageUrl,
          prescriptionRequired: false,
        });
      }
      await order.update({ items: orderItems }, { transaction });
      return { success: true, order };
    }).catch((error) => {
      if (error instanceof HttpException) throw error;
      console.error('Order creation error:', error?.name || 'UnknownError');
      throw new InternalServerErrorException('Failed to place order. Please try again.');
    });
  }

  async handlePaymentCallback(payload, signature, rawBody) {
    const secret = process.env.ORDER_PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Online payment confirmation is not configured');
    }
    if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string') {
      throw new BadRequestException('A signed payment callback is required');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const suppliedSignature = signature.replace(/^sha256=/i, '');
    if (!/^[a-f0-9]{64}$/i.test(suppliedSignature)) {
      throw new BadRequestException('Invalid payment callback signature');
    }
    const supplied = Buffer.from(suppliedSignature, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new BadRequestException('Invalid payment callback signature');
    }

    const eventId = typeof payload?.eventId === 'string' ? payload.eventId.trim() : '';
    const orderNumber = typeof payload?.orderNumber === 'string' ? payload.orderNumber.trim() : '';
    const transactionReference = typeof payload?.transactionReference === 'string'
      ? payload.transactionReference.trim()
      : '';
    const eventType = payload?.eventType;
    if (!eventId || eventId.length > 128 || !orderNumber || !transactionReference
      || transactionReference.length > 120
      || !['payment.succeeded', 'payment.failed', 'refund.completed'].includes(eventType)) {
      throw new BadRequestException('Invalid payment callback details');
    }
    const amountMinor = Number(payload.amountMinor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || payload.currency !== 'ZMW') {
      throw new BadRequestException('Invalid payment callback amount or currency');
    }

    return sequelize.transaction(async (transaction) => {
      const duplicate = await OrderPaymentEvent.findOne({ where: { eventId }, transaction });
      if (duplicate) return { success: true, duplicate: true };

      const order = await Order.findOne({
        where: { orderNumber },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw new NotFoundException('Order not found');
      if (amountMinor !== Math.round(Number(order.totalAmount || 0) * 100)) {
        throw new ConflictException('Payment amount does not match the order total');
      }

      if (eventType === 'payment.succeeded') {
        if (order.paymentStatus === 'Paid') {
          throw new ConflictException('Order already has a confirmed payment');
        }
        if (order.orderStatus === 'Cancelled') {
          throw new ConflictException('A cancelled order cannot be paid');
        }
        await order.update({
          paymentStatus: 'Paid',
          gatewayPaymentReference: transactionReference,
          paymentConfirmedAt: new Date(),
        }, { transaction });
        const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction });
        const fulfillmentById = new Map();
        for (const item of orderItems) {
          const fulfillmentStatus = Number(item.outstandingPreorderQuantity) > 0
            ? 'Awaiting Stock'
            : 'Awaiting Fulfillment';
          await item.update({ fulfillmentStatus }, { transaction });
          fulfillmentById.set(Number(item.id), fulfillmentStatus);
        }
        await order.update({
          items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
            ...item,
            fulfillmentStatus: fulfillmentById.get(Number(item.orderItemId)) || item.fulfillmentStatus,
          })),
        }, { transaction });
      } else if (eventType === 'payment.failed') {
        if (order.paymentStatus === 'Paid') {
          throw new ConflictException('A confirmed payment cannot be marked failed');
        }
        await this.releaseOrderReservations(order, transaction);
        await order.update({
          paymentStatus: 'Failed',
          orderStatus: 'Cancelled',
          cancellationReason: 'Payment was declined or failed at the provider',
          cancelledAt: new Date(),
        }, { transaction });
      } else {
        if (order.refundStatus !== 'Pending') {
          throw new ConflictException('Order has no pending refund');
        }
        await order.update({
          refundStatus: 'Completed',
          refundReference: transactionReference,
          paymentStatus: 'Refunded',
        }, { transaction });
      }

      await OrderPaymentEvent.create({
        eventId,
        orderId: order.id,
        eventType,
        receivedAt: new Date(),
      }, { transaction });
      return { success: true, order };
    });
  }

  getPaymentReadiness() {
    return {
      available: process.env.NODE_ENV === 'test' && Boolean(process.env.ORDER_PAYMENT_WEBHOOK_SECRET),
      reason: 'No payment initiation provider is configured',
    };
  }

  async allocateReceivedStock(medicineId, batch, transaction) {
    if (isBatchInactive(batch) || String(batch.expiryDate) < new Date().toISOString().slice(0, 10)) {
      return 0;
    }

    const medicine = await Medicine.findByPk(medicineId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!medicine) throw new NotFoundException('Medicine not found for received stock');

    const pendingItems = await OrderItem.findAll({
      where: {
        medicineId,
        outstandingPreorderQuantity: { [Op.gt]: 0 },
      },
      include: [{
        model: Order,
        required: true,
        where: { orderStatus: { [Op.ne]: 'Cancelled' } },
      }],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let remainingStock = Math.max(
      0,
      Number(batch.quantity || 0) - Number(batch.reservedQuantity || 0)
    );
    let batchReserved = Number(batch.reservedQuantity || 0);
    let medicineReserved = Number(medicine.reservedQuantity || 0);
    let totalAllocated = 0;
    const affectedOrderIds = new Set();

    for (const item of pendingItems) {
      if (remainingStock <= 0) break;
      const outstanding = Number(item.outstandingPreorderQuantity || 0);
      const allocation = Math.min(outstanding, remainingStock);
      if (allocation <= 0) continue;

      const nextOutstanding = outstanding - allocation;
      const nextReserved = Number(item.reservedQuantity || 0) + allocation;
      await OrderItemReservation.create({
        orderItemId: item.id,
        batchId: batch.id,
        quantity: allocation,
      }, { transaction });
      await item.update({
        reservedQuantity: nextReserved,
        outstandingPreorderQuantity: nextOutstanding,
        fulfillmentStatus: nextOutstanding > 0 ? 'Awaiting Stock' : 'Awaiting Fulfillment',
        estimatedFulfillmentAt: nextOutstanding > 0 ? item.estimatedFulfillmentAt : null,
      }, { transaction });

      const task = await ReplenishmentTask.findOne({
        where: { orderItemId: item.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (task) {
        await task.update({
          outstandingQuantity: nextOutstanding,
          status: nextOutstanding > 0 ? task.status : 'Received',
        }, { transaction });
      }

      const order = item.Order;
      await order.update({
        items: (Array.isArray(order.items) ? order.items : []).map((orderItem) => (
          Number(orderItem.orderItemId) === Number(item.id)
            ? {
              ...orderItem,
              reservedQuantity: nextReserved,
              outstandingPreorderQuantity: nextOutstanding,
              fulfillmentStatus: nextOutstanding > 0 ? 'Awaiting Stock' : 'Awaiting Fulfillment',
              estimatedFulfillmentAt: nextOutstanding > 0
                ? orderItem.estimatedFulfillmentAt
                : null,
            }
            : orderItem
        )),
      }, { transaction });

      affectedOrderIds.add(order.id);
      remainingStock -= allocation;
      batchReserved += allocation;
      medicineReserved += allocation;
      totalAllocated += allocation;
    }

    if (totalAllocated > 0) {
      await batch.update({ reservedQuantity: batchReserved }, { transaction });
      await medicine.update({ reservedQuantity: medicineReserved }, { transaction });
    }

    const notifyOrders = [];
    for (const orderId of affectedOrderIds) {
      const remainingItems = await OrderItem.count({
        where: {
          orderId,
          outstandingPreorderQuantity: { [Op.gt]: 0 },
        },
        transaction,
      });
      if (remainingItems === 0) {
        const order = await Order.findByPk(orderId, { transaction });
        if (order?.customerEmail) notifyOrders.push(order);
      }
    }

    if (notifyOrders.length > 0) {
      transaction.afterCommit(async () => {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RECEIPT_FROM_EMAIL;
        if (!apiKey || !from) {
          console.warn(JSON.stringify({
            event: 'order_preorder_availability_notification_skipped',
            reason: 'email_provider_not_configured',
            orderCount: notifyOrders.length,
          }));
          return;
        }
        for (const order of notifyOrders) {
          try {
            await sendReceiptEmail('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from,
                to: [order.customerEmail],
                subject: `MediQuick order ${order.orderNumber}: products available`,
                text: `The products for your MediQuick order ${order.orderNumber} are now available. Our team will prepare your order and notify you when it is ready.`,
              }),
              signal: AbortSignal.timeout(10000),
            });
          } catch (error) {
            console.error(JSON.stringify({
              event: 'order_preorder_availability_notification_failed',
              orderId: order.id,
              errorName: error?.name || 'UnknownError',
            }));
          }
        }
      });
    }

    return totalAllocated;
  }

  async releaseOrderReservations(order, transaction) {
    const items = await OrderItem.findAll({
      where: { orderId: order.id },
      include: [{ model: OrderItemReservation, as: 'Reservations' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const item of items) {
      for (const reservation of item.Reservations || []) {
        const quantity = Number(reservation.quantity);
        const medicine = await Medicine.findByPk(item.medicineId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!medicine || Number(medicine.reservedQuantity || 0) < quantity) {
          throw new ConflictException('Order reservation is inconsistent; inventory was not changed');
        }
        if (reservation.batchId !== null) {
          const batch = await Batch.findByPk(reservation.batchId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!batch || Number(batch.reservedQuantity || 0) < quantity) {
            throw new ConflictException('Reserved batch is missing or inconsistent');
          }
          await batch.update({ reservedQuantity: Number(batch.reservedQuantity) - quantity }, { transaction });
        }
        await medicine.update({
          reservedQuantity: Number(medicine.reservedQuantity || 0) - quantity,
        }, { transaction });
      }
      await item.update({
        fulfillmentStatus: 'Cancelled',
        reservedQuantity: 0,
        outstandingPreorderQuantity: 0,
      }, { transaction });
      const task = await ReplenishmentTask.findOne({ where: { orderItemId: item.id }, transaction });
      if (task && task.status !== 'Received') {
        await task.update({ status: 'Cancelled', outstandingQuantity: 0 }, { transaction });
      }
    }
    const cancelledItemIds = new Set(items.map((item) => Number(item.id)));
    await order.update({
      items: (Array.isArray(order.items) ? order.items : []).map((item) => (
        cancelledItemIds.has(Number(item.orderItemId))
          ? {
            ...item,
            fulfillmentStatus: 'Cancelled',
            reservedQuantity: 0,
            outstandingPreorderQuantity: 0,
          }
          : item
      )),
    }, { transaction });
  }

  async consumeOrderReservations(order, transaction) {
    const items = await OrderItem.findAll({
      where: { orderId: order.id },
      include: [{ model: OrderItemReservation, as: 'Reservations' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (items.length === 0) throw new ConflictException('Order has no fulfillment items');
    if (items.some((item) => Number(item.outstandingPreorderQuantity) > 0)) {
      throw new ConflictException('This mixed order must wait until every preorder item is in stock');
    }

    for (const item of items) {
      const reservations = item.Reservations || [];
      const reserved = reservations.reduce((sum, reservation) => sum + Number(reservation.quantity), 0);
      if (reserved !== Number(item.quantity)) {
        throw new ConflictException(`Reserved stock is incomplete for ${item.productName}`);
      }
      let totalCost = 0;
      const allocatedBatches = [];
      for (const reservation of reservations) {
        const quantity = Number(reservation.quantity);
        const medicine = await Medicine.findByPk(item.medicineId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!medicine || Number(medicine.reservedQuantity || 0) < quantity) {
          throw new ConflictException(`Reserved stock is inconsistent for ${item.productName}`);
        }
        if (reservation.batchId !== null) {
          const batch = await Batch.findByPk(reservation.batchId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!batch || Number(batch.quantity || 0) < quantity
            || Number(batch.reservedQuantity || 0) < quantity) {
            throw new ConflictException(`Reserved batch is unavailable for ${item.productName}`);
          }
          const nextQuantity = Number(batch.quantity) - quantity;
          await batch.update({
            quantity: nextQuantity,
            reservedQuantity: Number(batch.reservedQuantity) - quantity,
            status: resolveBatchStatus(nextQuantity, batch.status),
          }, { transaction });
          totalCost += Number(batch.costPrice || 0) * quantity;
          allocatedBatches.push(batch.id);
          await InventoryMovement.create({
            medicineId: medicine.id,
            batchId: batch.id,
            movementType: 'SALE',
            quantityChange: -quantity,
            referenceType: 'ONLINE_ORDER',
            referenceId: order.id,
            reason: `Order ${order.orderNumber}`,
          }, { transaction });
        } else {
          if (Number(medicine.totalQuantity || 0) < quantity) {
            throw new ConflictException(`Reserved stock is unavailable for ${item.productName}`);
          }
          await InventoryMovement.create({
            medicineId: medicine.id,
            batchId: null,
            movementType: 'SALE',
            quantityChange: -quantity,
            referenceType: 'ONLINE_ORDER',
            referenceId: order.id,
            reason: `Order ${order.orderNumber}`,
          }, { transaction });
        }
        await medicine.update({
          reservedQuantity: Number(medicine.reservedQuantity || 0) - quantity,
        }, { transaction });
      }

      const medicine = await Medicine.findByPk(item.medicineId, { transaction });
      const batches = await Batch.findAll({
        where: activeBatchWhere({ medicineId: item.medicineId }),
        transaction,
      });
      if (batches.length > 0) {
        await medicine.update({
          totalQuantity: batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0),
        }, { transaction });
      } else {
        await medicine.update({
          totalQuantity: Math.max(0, Number(medicine.totalQuantity || 0) - Number(item.quantity)),
        }, { transaction });
      }

      const existingSale = await Sales.findOne({
        where: { receiptNumber: order.orderNumber, medicineId: item.medicineId },
        transaction,
      });
      if (!existingSale) {
        await Sales.create({
          name: item.productName,
          medicineId: item.medicineId,
          customerId: order.customerId,
          batchId: allocatedBatches.length === 1 ? allocatedBatches[0] : null,
          quantity: item.quantity,
          pricePerUnit: item.unitPrice,
          totalPrice: item.totalPrice,
          totalPriceMinor: Math.round(Number(item.totalPrice) * 100),
          totalCost,
          totalCostMinor: batches.length > 0 ? Math.round(totalCost * 100) : null,
          paymentMethod: order.paymentMethod,
          receiptNumber: order.orderNumber,
          date: new Date(),
        }, { transaction });
      }
      await item.update({
        fulfillmentStatus: 'Processing',
        reservedQuantity: 0,
      }, { transaction });
    }

    await order.update({
      items: (Array.isArray(order.items) ? order.items : []).map((orderItem) => ({
        ...orderItem,
        reservedQuantity: 0,
        fulfillmentStatus: 'Processing',
      })),
    }, { transaction });
  }

  async listOrders(query = {}, user = null) {
    const pagination = parsePagination(query);
    const where = {};
    const isStaff = ['admin', 'manager', 'user'].includes(user?.role);

    if (isStaff) {
      // Staff can view the complete fulfillment queue.
    } else if (user && user.role === 'customer') {
      where.userId = user.id;
    } else {
      // Guest tracking by orderNumber & phone
      if (query.orderNumber && query.phone) {
        where.orderNumber = query.orderNumber.trim();
        const cleanPhone = String(query.phone).replace(/\D/g, '').slice(-9);
        if (cleanPhone.length < 7) {
          throw new BadRequestException('Order tracking requires at least 7 phone digits');
        }
        where.customerPhone = { [Op.like]: `%${cleanPhone}%` };
      } else {
        throw new BadRequestException('Order tracking requires order number and phone');
      }
    }

    if (query.status) {
      where.orderStatus = query.status;
    }
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (isStaff && query.filter) {
      const filters = {
        new: { orderStatus: 'Order Placed', paymentStatus: 'Pending' },
        paid: { paymentStatus: 'Paid' },
        processing: { orderStatus: { [Op.in]: ['Confirmed', 'Preparing'] } },
        'ready-pickup': { orderStatus: 'Ready', deliveryMethod: 'pickup' },
        'ready-dispatch': { orderStatus: 'Ready', deliveryMethod: 'delivery' },
        'out-for-delivery': { orderStatus: 'Out for Delivery' },
        delivered: { orderStatus: 'Delivered' },
        cancelled: { orderStatus: 'Cancelled' },
      };
      if (filters[query.filter]) Object.assign(where, filters[query.filter]);
      else if (['preorders', 'awaiting-stock'].includes(query.filter)) {
        const matchingItems = await OrderItem.findAll({
          where: query.filter === 'preorders'
            ? { preorderQuantity: { [Op.gt]: 0 } }
            : { outstandingPreorderQuantity: { [Op.gt]: 0 } },
          attributes: ['orderId'],
        });
        where.id = { [Op.in]: [...new Set(matchingItems.map((item) => item.orderId))] };
        if (!query.status) {
          where.orderStatus = { [Op.ne]: 'Cancelled' };
        }
      } else {
        throw new BadRequestException('Invalid order queue filter');
      }
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      order: [['date', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    if (!isStaff) {
      return paginatedResponse(rows.map((order) => ({
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        date: order.date,
        totalAmount: order.totalAmount,
        deliveryMethod: order.deliveryMethod,
        pickupReference: order.deliveryMethod === 'pickup' && order.orderStatus === 'Ready'
          ? order.pickupReference
          : null,
        trackingLink: order.trackingLink,
        items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          preorderQuantity: item.preorderQuantity || 0,
          outstandingPreorderQuantity: item.outstandingPreorderQuantity || 0,
          fulfillmentStatus: item.fulfillmentStatus,
          estimatedFulfillmentAt: item.estimatedFulfillmentAt || null,
        })),
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
      })), count, pagination);
    }

    return paginatedResponse(rows, count, pagination);
  }

  async getOrder(idOrNumber) {
    const order = await Order.findOne({ where: { id: Number(idOrNumber) } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateOrderStatus(id, status, reason = '', user = null, metadata = {}) {
    const validStatuses = ['Order Placed', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid order status');
    }
    const cancellationReason = typeof reason === 'string' ? reason.trim() : '';
    if (status === 'Cancelled' && !cancellationReason) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.orderStatus === 'Cancelled') {
        throw new OrderStateException('This order has already been cancelled');
      }
      if (order.orderStatus === status) return order;
      if (
        order.orderStatus === 'Order Placed'
        && ['Preparing', 'Ready', 'Out for Delivery', 'Delivered'].includes(status)
      ) {
        throw new OrderStateException('Confirm the order before continuing fulfillment');
      }
      const allowedNextStatuses = {
        'Order Placed': ['Confirmed', 'Cancelled'],
        Confirmed: ['Preparing', 'Cancelled'],
        Preparing: ['Ready', 'Cancelled'],
        Ready: ['Out for Delivery', 'Cancelled'],
        'Out for Delivery': ['Delivered'],
      };
      if (!(allowedNextStatuses[order.orderStatus] || []).includes(status)) {
        throw new OrderStateException(`Cannot move an order from ${order.orderStatus} to ${status}`);
      }
      const updates = { orderStatus: status };
      if (status === 'Out for Delivery') {
        if (order.deliveryMethod !== 'delivery') {
          throw new OrderStateException('Only home-delivery orders can be dispatched');
        }
        const yangoReference = typeof metadata.yangoReference === 'string'
          ? metadata.yangoReference.trim()
          : '';
        const yangoFee = Number(metadata.yangoFee);
        const trackingLink = typeof metadata.trackingLink === 'string'
          ? metadata.trackingLink.trim()
          : '';
        if (!yangoReference || yangoReference.length > 120
          || !Number.isFinite(yangoFee) || yangoFee < 0) {
          throw new BadRequestException('A Yango reference and actual non-negative delivery fee are required');
        }
        if (trackingLink && !/^https?:\/\/\S+$/i.test(trackingLink)) {
          throw new BadRequestException('Tracking link must be an HTTP(S) URL');
        }
        updates.deliveryProvider = 'Yango';
        updates.yangoReference = yangoReference;
        updates.yangoRiderDetails = typeof metadata.yangoRiderDetails === 'string'
          ? metadata.yangoRiderDetails.trim().slice(0, 1000)
          : null;
        updates.yangoFee = yangoFee;
        updates.trackingLink = trackingLink || null;
      }
      if (status === 'Delivered') updates.deliveredAt = new Date();
      if (status === 'Confirmed') {
        if (order.paymentStatus !== 'Paid' && await OrderItem.count({
          where: { orderId: order.id },
          transaction,
        })) {
          throw new ConflictException('Payment must be verified before an order can be confirmed');
        }
        const structuredItemCount = await OrderItem.count({
          where: { orderId: order.id },
          transaction,
        });
        if (structuredItemCount > 0) {
          if (order.paymentStatus !== 'Paid') {
            throw new ConflictException('Payment must be verified before an order can be confirmed');
          }
          await this.consumeOrderReservations(order, transaction);
        } else {
        const orderItems = Array.isArray(order.items) ? order.items : [];
        if (orderItems.length === 0) {
          throw new ConflictException('This order has no items to confirm');
        }

        const groupedItems = new Map();
        for (const item of orderItems) {
          const medicineId = Number(item.id || item.medicineId);
          const requestedQuantity = Number(item.quantity);
          if (!Number.isInteger(medicineId) || medicineId <= 0
            || !Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
            throw new ConflictException('This order contains invalid item details and cannot be confirmed');
          }
          const existing = groupedItems.get(medicineId);
          if (existing) {
            existing.requestedQuantity += requestedQuantity;
          } else {
            groupedItems.set(medicineId, { item, medicineId, requestedQuantity });
          }
        }

        const today = new Date().toISOString().slice(0, 10);
        for (const { item, medicineId, requestedQuantity } of groupedItems.values()) {
          const medicine = await Medicine.findByPk(medicineId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!medicine) {
            throw new ConflictException(`Product ${item.name || medicineId} is no longer available to confirm`);
          }

          const batches = await Batch.findAll({
            where: activeBatchWhere({ medicineId }),
            order: [['expiryDate', 'ASC'], ['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          const saleableBatches = batches.filter((batch) => (
            String(batch.expiryDate) >= today && Number(batch.quantity || 0) > 0
          ));
          const existingMovements = await InventoryMovement.findAll({
            where: {
              medicineId,
              referenceType: 'ONLINE_ORDER',
              reason: `Order ${order.orderNumber}`,
            },
            transaction,
          });
          const alreadyAllocated = existingMovements.reduce((sum, movement) => (
            Number(movement.quantityChange) < 0
              ? sum + Math.abs(Number(movement.quantityChange))
              : sum
          ), 0);
          const availableStock = batches.length > 0
            ? saleableBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
            : Math.max(0, Number(medicine.totalQuantity || 0));
          const additionalQuantity = Math.max(0, requestedQuantity - alreadyAllocated);

          if (availableStock < additionalQuantity) {
            throw new InsufficientStockException(
              `Insufficient stock to confirm ${item.name || medicine.name}. `
              + `Required: ${requestedQuantity}, available: ${alreadyAllocated + availableStock}.`
            );
          }

          let remainingToAllocate = additionalQuantity;
          if (batches.length > 0) {
            for (const batch of saleableBatches) {
              if (remainingToAllocate <= 0) break;
              const deduction = Math.min(Number(batch.quantity || 0), remainingToAllocate);
              if (deduction <= 0) continue;
              const nextQty = Number(batch.quantity) - deduction;
              await batch.update({
                quantity: nextQty,
                status: resolveBatchStatus(nextQty, batch.status),
              }, { transaction });
              await InventoryMovement.create({
                medicineId,
                batchId: batch.id,
                movementType: 'SALE',
                quantityChange: -deduction,
                referenceType: 'ONLINE_ORDER',
                reason: `Order ${order.orderNumber}`,
              }, { transaction });
              remainingToAllocate -= deduction;
            }
            const updatedBatches = await Batch.findAll({
              where: activeBatchWhere({ medicineId }),
              transaction,
            });
            await medicine.update({
              totalQuantity: updatedBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0),
            }, { transaction });
          } else if (additionalQuantity > 0) {
            await medicine.update({
              totalQuantity: Math.max(0, Number(medicine.totalQuantity || 0) - additionalQuantity),
            }, { transaction });
            await InventoryMovement.create({
              medicineId,
              batchId: null,
              movementType: 'SALE',
              quantityChange: -additionalQuantity,
              referenceType: 'ONLINE_ORDER',
              reason: `Order ${order.orderNumber}`,
            }, { transaction });
          }
        }
        }
      }
      if (status === 'Cancelled') {
        if (!user || !['admin', 'manager', 'user'].includes(user.role)) {
          throw new ForbiddenException('Staff authorization is required to cancel an order');
        }
        const structuredItemCount = await OrderItem.count({
          where: { orderId: order.id },
          transaction,
        });
        if (structuredItemCount > 0) {
          if (order.orderStatus !== 'Order Placed') {
            throw new ConflictException('Only an order not yet in fulfillment can be cancelled');
          }
          await this.releaseOrderReservations(order, transaction);
          if (order.paymentStatus === 'Paid') updates.refundStatus = 'Pending';
          updates.cancellationReason = cancellationReason;
          updates.cancelledByUserId = user.id;
          updates.cancelledAt = new Date();
        } else {
        const orderMovements = await InventoryMovement.findAll({
          where: {
            referenceType: 'ONLINE_ORDER',
            reason: `Order ${order.orderNumber}`,
          },
          order: [['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const restoredTotals = new Map();

        for (const movement of orderMovements) {
          const quantityToRestore = Math.abs(Number(movement.quantityChange || 0));
          if (Number(movement.quantityChange) >= 0 || quantityToRestore === 0) continue;
          if (!Number.isInteger(quantityToRestore)) {
            throw new ConflictException('Order inventory movements contain an invalid quantity');
          }

          const medicine = await Medicine.findByPk(movement.medicineId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!medicine) {
            throw new ConflictException('An original order product is missing; inventory was not restored');
          }

          if (movement.batchId !== null) {
            const batch = await Batch.findByPk(movement.batchId, {
              transaction,
              lock: transaction.LOCK.UPDATE,
            });
            if (!batch || Number(batch.medicineId) !== Number(medicine.id)) {
              throw new ConflictException('An original inventory batch is missing; inventory was not restored');
            }
            const restoredQuantity = Number(batch.quantity || 0) + quantityToRestore;
            const nextStatus = batch.status === 'archived' || batch.status === 'deleted'
              ? 'active'
              : resolveBatchStatus(restoredQuantity, batch.status);
            await batch.update({
              quantity: restoredQuantity,
              status: nextStatus,
            }, { transaction });
          } else {
            restoredTotals.set(
              medicine.id,
              (restoredTotals.get(medicine.id) || 0) + quantityToRestore
            );
          }

          await InventoryMovement.create({
            medicineId: medicine.id,
            batchId: movement.batchId,
            movementType: 'RETURN',
            quantityChange: quantityToRestore,
            referenceType: 'ONLINE_ORDER_CANCELLATION',
            referenceId: order.id,
            reason: `Cancellation of order ${order.orderNumber}: ${cancellationReason}`,
          }, { transaction });
        }

        for (const [medicineId, quantityToRestore] of restoredTotals) {
          const medicine = await Medicine.findByPk(medicineId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          await medicine.update({
            totalQuantity: Math.max(0, Number(medicine.totalQuantity || 0)) + quantityToRestore,
          }, { transaction });
        }

        const batchedMedicineIds = new Set(
          orderMovements
            .filter((movement) => (
              Number(movement.quantityChange) < 0 && movement.batchId !== null
            ))
            .map((movement) => Number(movement.medicineId))
        );
        for (const medicineId of batchedMedicineIds) {
          const medicine = await Medicine.findByPk(medicineId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          const batches = await Batch.findAll({ where: activeBatchWhere({ medicineId }), transaction });
          await medicine.update({
            totalQuantity: batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
              + (restoredTotals.get(medicineId) || 0),
          }, { transaction });
        }

        updates.cancellationReason = cancellationReason;
        updates.cancelledByUserId = user.id;
        updates.cancelledAt = new Date();
        }
      }

      if (status === 'Ready' && order.deliveryMethod === 'pickup') {
        updates.pickupReference = randomBytes(8).toString('hex').toUpperCase();
        updates.pickupReadyAt = new Date();
      }
      if (['Preparing', 'Ready', 'Out for Delivery', 'Delivered'].includes(status)) {
        const structuredItems = await OrderItem.findAll({
          where: { orderId: order.id },
          transaction,
        });
        const nextFulfillmentStatus = status === 'Preparing'
          ? 'Processing'
          : status === 'Ready'
            ? 'Ready'
            : status === 'Out for Delivery'
              ? 'Out for Delivery'
              : 'Delivered';
        for (const item of structuredItems) {
          await item.update({ fulfillmentStatus: nextFulfillmentStatus }, { transaction });
        }
        if (structuredItems.length > 0) {
          const itemStatusById = new Map(
            structuredItems.map((item) => [Number(item.id), nextFulfillmentStatus])
          );
          await order.update({
            items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
              ...item,
              fulfillmentStatus: itemStatusById.get(Number(item.orderItemId)) || item.fulfillmentStatus,
            })),
          }, { transaction });
        }
      }

      await order.update(updates, { transaction });
      return order;
    });
  }

  async recordPickupHandover(id, pickupReference, user) {
    if (!user || !['admin', 'manager', 'user'].includes(user.role)) {
      throw new ForbiddenException('Staff authorization is required to hand over an order');
    }
    const reference = typeof pickupReference === 'string' ? pickupReference.trim() : '';
    if (!reference) throw new BadRequestException('Pickup reference is required');
    return sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.deliveryMethod !== 'pickup' || order.orderStatus !== 'Ready') {
        throw new ConflictException('Only a ready store-pickup order can be handed over');
      }
      if (order.paymentStatus !== 'Paid') {
        throw new ConflictException('Payment must be verified before pickup handover');
      }
      if (!order.pickupReference || order.pickupReference !== reference) {
        throw new ConflictException('Pickup reference does not match');
      }
      const handedOverAt = new Date();
      await order.update({
        orderStatus: 'Delivered',
        handedOverAt,
        handedOverByUserId: user.id,
        deliveredAt: handedOverAt,
      }, { transaction });
      await OrderItem.update(
        { fulfillmentStatus: 'Delivered' },
        { where: { orderId: order.id }, transaction }
      );
      await order.update({
        items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
          ...item,
          fulfillmentStatus: 'Delivered',
        })),
      }, { transaction });
      return order;
    });
  }

  async listReplenishmentTasks(query = {}) {
    const where = {};
    if (query.status) where.status = query.status;
    const tasks = await ReplenishmentTask.findAll({
      where,
      include: [{
        model: OrderItem,
        include: [
          { model: Order, attributes: ['id', 'orderNumber', 'orderStatus', 'paymentStatus'] },
          { model: Medicine, attributes: ['id', 'name'] },
        ],
      }],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
      limit: 200,
    });
    return tasks.map((task) => {
      const row = task.get({ plain: true });
      return {
        id: row.id,
        outstandingQuantity: row.outstandingQuantity,
        status: row.status,
        supplierConfirmedAt: row.supplierConfirmedAt,
        estimatedFulfillmentAt: row.estimatedFulfillmentAt,
        orderNumber: row.OrderItem?.Order?.orderNumber || null,
        orderStatus: row.OrderItem?.Order?.orderStatus || null,
        paymentStatus: row.OrderItem?.Order?.paymentStatus || null,
        medicineId: row.OrderItem?.medicineId || null,
        productName: row.OrderItem?.productName || null,
      };
    });
  }

  async updateReplenishmentEstimate(id, payload, user) {
    if (!user || !['admin', 'manager', 'user'].includes(user.role)) {
      throw new ForbiddenException('Staff authorization is required to update replenishment estimates');
    }
    const supplierConfirmedAt = new Date(payload.supplierConfirmedAt);
    const estimatedFulfillmentAt = new Date(payload.estimatedFulfillmentAt);
    if (Number.isNaN(supplierConfirmedAt.getTime()) || Number.isNaN(estimatedFulfillmentAt.getTime())
      || supplierConfirmedAt > new Date() || estimatedFulfillmentAt <= new Date()
      || estimatedFulfillmentAt <= supplierConfirmedAt) {
      throw new BadRequestException('Provide a supplier-confirmed date and a later estimated fulfillment date');
    }
    return sequelize.transaction(async (transaction) => {
      const task = await ReplenishmentTask.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!task || task.status === 'Cancelled' || task.status === 'Received') {
        throw new NotFoundException('Open replenishment task not found');
      }
      const item = await OrderItem.findByPk(task.orderItemId, { transaction });
      const order = await Order.findByPk(item.orderId, { transaction });
      await task.update({
        status: 'Ordered',
        supplierConfirmedAt,
        estimatedFulfillmentAt,
        updatedByUserId: user.id,
      }, { transaction });
      await item.update({ estimatedFulfillmentAt }, { transaction });
      await order.update({
        items: (Array.isArray(order.items) ? order.items : []).map((orderItem) => (
          Number(orderItem.orderItemId) === Number(item.id)
            ? { ...orderItem, estimatedFulfillmentAt: estimatedFulfillmentAt.toISOString() }
            : orderItem
        )),
      }, { transaction });
      return task;
    });
  }

  async getOrderFulfillmentReport(query = {}) {
    const where = {};
    if (query.from || query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      if (!query.from || !query.to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
        throw new BadRequestException('Provide a valid from/to date range');
      }
      where.date = { [Op.gte]: from, [Op.lt]: to };
    }
    const orders = await Order.findAll({ where, order: [['date', 'ASC']] });
    const orderIds = orders.map((order) => order.id);
    const itemRows = orderIds.length
      ? await OrderItem.findAll({ where: { orderId: { [Op.in]: orderIds } } })
      : [];
    const tasks = orderIds.length
      ? await ReplenishmentTask.findAll({
        include: [{ model: OrderItem, where: { orderId: { [Op.in]: orderIds } } }],
      })
      : [];
    const paidOrders = orders.filter((order) => order.paymentStatus === 'Paid');
    const paidOrderIds = new Set(paidOrders.map((order) => Number(order.id)));
    const paidItems = itemRows.filter((item) => paidOrderIds.has(Number(item.orderId)));
    const outstandingTasks = tasks.filter((task) => !['Received', 'Cancelled'].includes(task.status));
    const delivered = orders.filter((order) => order.deliveredAt && order.date);
    const fulfillmentHours = delivered.map((order) => (
      Math.max(0, new Date(order.deliveredAt).getTime() - new Date(order.date).getTime()) / 3600000
    ));
    return {
      onlineSales: paidOrders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
      preorderSales: paidItems.reduce((sum, item) => (
        sum + Number(item.unitPrice || 0) * Number(item.preorderQuantity || 0)
      ), 0),
      outstandingPreorderValue: outstandingTasks.reduce((sum, task) => (
        sum + Number(task.outstandingQuantity || 0) * Number(task.OrderItem?.unitPrice || 0)
      ), 0),
      stockAwaitingReplenishment: outstandingTasks.reduce(
        (sum, task) => sum + Number(task.outstandingQuantity || 0),
        0
      ),
      pickupOrders: orders.filter((order) => order.deliveryMethod === 'pickup').length,
      yangoDeliveryOrders: orders.filter((order) => order.deliveryProvider === 'Yango').length,
      deliveryCosts: orders.reduce((sum, order) => sum + Number(order.yangoFee || 0), 0),
      averageFulfillmentHours: fulfillmentHours.length
        ? fulfillmentHours.reduce((sum, value) => sum + value, 0) / fulfillmentHours.length
        : null,
    };
  }

  async uploadPrescription(payload, user = null) {
    if (!payload.patientName || !payload.patientPhone) {
      throw new BadRequestException('Patient name and phone number are required');
    }

    const prescriptionNumber = `RX-${randomBytes(16).toString('hex').toUpperCase()}`;
    let customerId = null;

    if (user) {
      const customer = await Customer.findOne({ where: { userId: user.id } });
      if (customer) customerId = customer.id;
    }

    const prescription = await Prescription.create({
      prescriptionNumber,
      customerId,
      patientName: payload.patientName,
      patientPhone: payload.patientPhone,
      doctorName: payload.doctorName || null,
      prescriber: payload.prescriber || payload.doctorName || 'Self/Prescription Upload',
      insurance: payload.insurance || 'Self-Pay',
      medications: payload.medications || 'Prescription Document Uploaded',
      imagePath: validatePrescriptionFile(payload.fileData),
      deliveryPreference: payload.deliveryPreference || 'delivery',
      deliveryAddress: payload.deliveryAddress || null,
      notes: payload.notes || null,
      status: 'Pending', // Corresponds to 'Submitted' in customer tracking flow
      date: new Date().toISOString().split('T')[0],
    });

    return {
      success: true,
      prescriptionNumber,
      referenceNumber: prescriptionNumber,
    };
  }

  async trackPrescription(ref) {
    const prescription = await Prescription.findOne({
      where: { prescriptionNumber: ref },
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found with reference ' + ref);
    }
    return {
      prescriptionNumber: prescription.prescriptionNumber,
      status: prescription.status,
      date: prescription.date,
      dueDate: prescription.dueDate,
      deliveryPreference: prescription.deliveryPreference,
    };
  }

  async getCustomerPrescriptions(user, query = {}) {
    if (!user) throw new BadRequestException('Authentication required');
    const customer = await Customer.findOne({ where: { userId: user.id } });
    const where = {};
    if (customer) {
      where[Op.or] = [{ customerId: customer.id }, { patientPhone: customer.phone }];
    } else {
      where.patientName = user.username;
    }
    const pagination = parsePagination(query);
    const result = await Prescription.findAndCountAll({
      where,
      attributes: {
        exclude: ['imagePath'],
        include: [[fn('LENGTH', col('imagePath')), 'documentSize']],
      },
      order: [['createdAt', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });
    const rows = result.rows.map((prescription) => ({
      ...prescription.get({ plain: true }),
      imagePath: null,
      hasDocument: Number(prescription.get('documentSize') || 0) > 0,
    }));
    return paginatedResponse(rows, result.count, pagination);
  }

  async getCustomerPrescriptionDocument(id, user) {
    if (!user) throw new BadRequestException('Authentication required');
    const customer = await Customer.findOne({ where: { userId: user.id } });
    const where = { id };
    if (customer) {
      where[Op.or] = [{ customerId: customer.id }, { patientPhone: customer.phone }];
    } else {
      where.patientName = user.username;
    }
    const prescription = await Prescription.findOne({
      where,
      attributes: ['id', 'prescriptionNumber', 'imagePath'],
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    return {
      id: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      imagePath: prescription.imagePath || null,
    };
  }

  async createSupportInquiry(payload) {
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
    const inquiryType =
      typeof payload?.inquiryType === 'string' && payload.inquiryType.trim()
        ? payload.inquiryType.trim().slice(0, 100)
        : 'Help finding product';

    if (!name || !payload?.phone || !message) {
      throw new BadRequestException('Name, phone number, and message are required');
    }

    const phoneResult = validateAndNormalizePhone(payload.phone, payload.countryCode);
    if (!phoneResult.valid) {
      throw new BadRequestException(phoneResult.error);
    }

    const emailResult = validateAndNormalizeOptionalEmail(payload.email);
    if (!emailResult.valid) {
      throw new BadRequestException(emailResult.error);
    }

    const inquiry = await SupportInquiry.create({
      inquiryType,
      name: name.slice(0, 120),
      phone: phoneResult.normalized,
      email: emailResult.normalized,
      message: message.slice(0, 2000),
      status: 'New',
    });
    return { success: true, inquiry };
  }

  async listSupportInquiries(query = {}) {
    const pagination = parsePagination(query);
    const where = {};
    const statuses = ['New', 'Contacted', 'Resolved'];

    if (query.status) {
      if (!statuses.includes(query.status)) {
        throw new BadRequestException('Status must be New, Contacted, or Resolved');
      }
      where.status = query.status;
    }

    if (query.search !== undefined && String(query.search).trim().length > 200) {
      throw new BadRequestException('Search must be 200 characters or fewer');
    }
    const search = String(query.search || '').trim();
    if (search) {
      const pattern = `%${search}%`;
      where[Op.or] = [
        { name: { [Op.like]: pattern } },
        { phone: { [Op.like]: pattern } },
        { email: { [Op.like]: pattern } },
        { inquiryType: { [Op.like]: pattern } },
        { message: { [Op.like]: pattern } },
      ];
    }

    const { rows, count } = await SupportInquiry.findAndCountAll({
      where,
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return paginatedResponse(rows, count, pagination);
  }

  async updateSupportInquiryStatus(id, status) {
    const inquiryId = Number(id);
    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
      throw new BadRequestException('Inquiry ID must be a positive integer');
    }
    if (!['New', 'Contacted', 'Resolved'].includes(status)) {
      throw new BadRequestException('Status must be New, Contacted, or Resolved');
    }

    const inquiry = await SupportInquiry.findByPk(inquiryId);
    if (!inquiry) {
      throw new NotFoundException('Support inquiry not found');
    }
    await inquiry.update({ status });
    return inquiry;
  }
}

Injectable()(StoreService);
module.exports = StoreService;
