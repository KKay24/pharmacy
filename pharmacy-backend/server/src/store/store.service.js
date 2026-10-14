const {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} = require('@nestjs/common');
const { randomBytes } = require('node:crypto');
const { Op } = require('sequelize');
const {
  Batch,
  Customer,
  InventoryCategory,
  InventoryMovement,
  Medicine,
  Order,
  Prescription,
  Sales,
  SupportInquiry,
  User,
  sequelize,
} = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');

function validatePrescriptionFile(fileData) {
  if (!fileData) return null;
  if (typeof fileData !== 'string') {
    throw new BadRequestException('Prescription file must be a supported image or PDF');
  }

  const match = fileData.match(/^data:(image\/(?:jpeg|png)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || Buffer.from(match[2], 'base64').byteLength > 5 * 1024 * 1024) {
    throw new BadRequestException('Prescription file must be a PNG, JPEG, or PDF under 5 MB');
  }
  return fileData;
}

function calculateProductPrice(medicine) {
  if (Array.isArray(medicine.Batches) && medicine.Batches.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const validBatches = medicine.Batches
      .filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate >= today && Number(batch.sellingPrice) > 0)
      .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
    if (validBatches.length > 0) {
      return Number(validBatches[0].sellingPrice);
    }
    const configuredBatch = medicine.Batches
      .filter((batch) => Number(batch.sellingPrice) > 0)
      .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)))[0];
    if (configuredBatch) {
      return Number(configuredBatch.sellingPrice);
    }
  }
  return Number(medicine.basePrice || 0);
}

function formatProduct(medicine) {
  const plain = typeof medicine.get === 'function' ? medicine.get({ plain: true }) : medicine;
  const price = calculateProductPrice(plain);

  return {
    id: plain.id,
    name: plain.name,
    genericName: plain.genericName,
    brandName: plain.brandName,
    category: plain.category,
    strength: plain.strength,
    dosage: plain.dosage,
    manufacturer: plain.manufacturer,
    imageUrl: plain.imageUrl,
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
  };
}

class StoreService {
  async listProducts(query = {}) {
    const pagination = parsePagination(query);
    const where = {
      isCustomerVisible: true,
    };
    const clauses = [];

    if (query.search) {
      const search = String(query.search).trim();
      clauses.push({ [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { genericName: { [Op.like]: `%${search}%` } },
        { brandName: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ] });
    }

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

    const { count, rows } = await Medicine.findAndCountAll({
      where,
      include: [
        { model: Batch },
        { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug'] },
        { model: InventoryCategory, as: 'ProductForm', attributes: ['id', 'name', 'slug'] },
      ],
      order: requiresDerivedFiltering ? [['name', 'ASC']] : order,
      distinct: true,
      ...(requiresDerivedFiltering ? {} : { limit: pagination.limit, offset: pagination.offset }),
    });

    let formattedRows = rows.map(formatProduct);

    if (query.minPrice !== undefined && !isNaN(Number(query.minPrice))) {
      formattedRows = formattedRows.filter((p) => p.price >= Number(query.minPrice));
    }
    if (query.maxPrice !== undefined && !isNaN(Number(query.maxPrice))) {
      formattedRows = formattedRows.filter((p) => p.price <= Number(query.maxPrice));
    }
    if (query.sort === 'price_asc') {
      formattedRows.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    } else if (query.sort === 'price_desc') {
      formattedRows.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    }

    if (requiresDerivedFiltering) {
      const total = formattedRows.length;
      formattedRows = formattedRows.slice(pagination.offset, pagination.offset + pagination.limit);
      return paginatedResponse(formattedRows, total, pagination);
    }

    return paginatedResponse(formattedRows, count, pagination);
  }

  async getProduct(id) {
    const medicine = await Medicine.findByPk(id, {
      include: [
        { model: Batch },
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
    const medicines = await Medicine.findAll({
      where: { isCustomerVisible: true },
      include: [{ model: Batch }],
      limit: Number(limit),
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

  async createOrder(payload, user = null) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }
    if (!payload.customerName || !payload.customerPhone) {
      throw new BadRequestException('Customer name and phone number are required');
    }
    const deliveryMethod = payload.deliveryMethod || 'delivery';
    if (!['delivery', 'pickup'].includes(deliveryMethod)) {
      throw new BadRequestException('Invalid delivery method');
    }
    const paymentMethod = payload.paymentMethod || 'Mobile Money';
    if (!['Mobile Money', 'Cash on Delivery', 'Bank Transfer'].includes(paymentMethod)) {
      throw new BadRequestException('Invalid payment method');
    }

    const transaction = await sequelize.transaction();
    try {
      const orderNumber = `ORD-${randomBytes(10).toString('hex').toUpperCase()}`;
      let calculatedSubtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const medicineId = item.id || item.medicineId;
        const requestedQuantity = Number(item.quantity ?? 1);
        if (!Number.isInteger(Number(medicineId)) || Number(medicineId) <= 0) {
          throw new BadRequestException('A valid product is required for each order item');
        }
        if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
          throw new BadRequestException(`Invalid quantity for ${item.name}`);
        }

        const medicine = await Medicine.findByPk(medicineId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!medicine) {
          throw new NotFoundException(`Product not found: ${item.name || medicineId}`);
        }
        if (medicine.isCustomerVisible === false) {
          throw new NotFoundException('This product is not available for customer orders');
        }
        if (medicine.prescriptionRequired) {
          throw new BadRequestException('Prescription-required products must be reviewed by a pharmacist before checkout');
        }

        const batches = await Batch.findAll({
          where: { medicineId: medicine.id },
          order: [['expiryDate', 'ASC'], ['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const today = new Date().toISOString().slice(0, 10);
        const saleableBatches = batches.filter((batch) => (
          String(batch.expiryDate) >= today && Number(batch.quantity || 0) > 0
        ));
        const availableStock = batches.length > 0
          ? saleableBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
          : Number(medicine.totalQuantity || 0);
        // Record the full requested order; inventory deductions are limited to saleable stock.
        let itemPrice = calculateProductPrice({
          basePrice: medicine.basePrice,
          Batches: batches,
        });
        if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
          throw new BadRequestException(`A valid selling price is not configured for ${medicine.name}`);
        }
        calculatedSubtotal += itemPrice * requestedQuantity;

        // Deduct batches if batches exist
        let remainingToDeduct = requestedQuantity;
        let totalCost = 0;
        const deductions = [];
        const unbatchedQuantityToDeduct = batches.length === 0
          ? Math.min(Math.max(availableStock, 0), requestedQuantity)
          : 0;

        for (const batch of saleableBatches) {
          if (remainingToDeduct <= 0) break;
          const currentBatchQty = Number(batch.quantity || 0);
          if (currentBatchQty <= 0) continue;
          const deduct = Math.min(currentBatchQty, remainingToDeduct);
          deductions.push({ batch, deduct });
          totalCost += Number(batch.costPrice || 0) * deduct;
          remainingToDeduct -= deduct;
        }

        for (const { batch, deduct } of deductions) {
          await batch.update({ quantity: Number(batch.quantity) - deduct }, { transaction });
          await InventoryMovement.create({
            medicineId: medicine.id,
            batchId: batch.id,
            movementType: 'SALE',
            quantityChange: -deduct,
            referenceType: 'ONLINE_ORDER',
            reason: `Order ${orderNumber}`,
          }, { transaction });
        }
        if (batches.length === 0) {
          if (unbatchedQuantityToDeduct > 0) {
            await InventoryMovement.create({
              medicineId: medicine.id,
              batchId: null,
              movementType: 'SALE',
              quantityChange: -unbatchedQuantityToDeduct,
              referenceType: 'ONLINE_ORDER',
              reason: `Order ${orderNumber}`,
            }, { transaction });
          }
        }

        const newMedicineTotal = batches.length > 0
          ? batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
          : Math.max(0, Number(medicine.totalQuantity || 0) - unbatchedQuantityToDeduct);
        await medicine.update({ totalQuantity: newMedicineTotal }, { transaction });

        // Record line item in Sales table for unified accounting/reporting
        await Sales.create({
          name: medicine.name,
          medicineId: medicine.id,
          batchId: deductions.length > 0 ? deductions[0].batch.id : null,
          quantity: requestedQuantity,
          pricePerUnit: itemPrice,
          totalPrice: itemPrice * requestedQuantity,
          totalCost,
          paymentMethod,
          receiptNumber: orderNumber,
          date: new Date(),
        }, { transaction });

        verifiedItems.push({
          id: medicine.id,
          name: medicine.name,
          quantity: requestedQuantity,
          price: itemPrice,
          total: itemPrice * requestedQuantity,
          dosage: medicine.dosage,
          strength: medicine.strength,
          imageUrl: medicine.imageUrl,
          prescriptionRequired: medicine.prescriptionRequired,
        });
      }

      const deliveryFee = deliveryMethod === 'pickup' ? 0 : 25;
      const totalAmount = calculatedSubtotal + deliveryFee;

      // Link to customer record if exists or create one
      let customerId = null;
      if (user) {
        let existingCustomer = await Customer.findOne({
          where: { userId: user.id },
          transaction,
        });
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

      const order = await Order.create({
        orderNumber,
        customerId,
        userId: user ? user.id : null,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerEmail: payload.customerEmail || null,
        deliveryMethod,
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
        totalAmount,
        items: verifiedItems,
        prescriptionReference: payload.prescriptionReference || null,
        notes: payload.notes || null,
        date: new Date(),
      }, { transaction });

      await transaction.commit();
      return { success: true, order };
    } catch (error) {
      await transaction.rollback();
      if (error instanceof HttpException) throw error;
      console.error('Order creation error:', error);
      throw new InternalServerErrorException('Failed to place order. Please try again.');
    }
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
        where.customerPhone = { [Op.like]: `%${cleanPhone}%` };
      } else {
        throw new BadRequestException('Order tracking requires order number and phone');
      }
    }

    if (query.status) {
      where.orderStatus = query.status;
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
        date: order.date,
        totalAmount: order.totalAmount,
        deliveryMethod: order.deliveryMethod,
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

  async updateOrderStatus(id, status, reason = '', user = null) {
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
        throw new ConflictException('This order has already been cancelled');
      }
      if (order.orderStatus === status) return order;
      if (
        order.orderStatus === 'Order Placed'
        && ['Preparing', 'Ready', 'Out for Delivery', 'Delivered'].includes(status)
      ) {
        throw new ConflictException('Confirm the order before continuing fulfillment');
      }

      const updates = { orderStatus: status };
      if (status === 'Confirmed') {
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
            where: { medicineId },
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
            throw new ConflictException(
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
              await batch.update({ quantity: Number(batch.quantity) - deduction }, { transaction });
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
              where: { medicineId },
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
      if (status === 'Cancelled') {
        if (!user || !['admin', 'manager', 'user'].includes(user.role)) {
          throw new ForbiddenException('Staff authorization is required to cancel an order');
        }
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
            await batch.update({
              quantity: Number(batch.quantity || 0) + quantityToRestore,
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
          const batches = await Batch.findAll({ where: { medicineId }, transaction });
          await medicine.update({
            totalQuantity: batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
              + (restoredTotals.get(medicineId) || 0),
          }, { transaction });
        }

        updates.cancellationReason = cancellationReason;
        updates.cancelledByUserId = user.id;
        updates.cancelledAt = new Date();
      }

      await order.update(updates, { transaction });
      return order;
    });
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

  async getCustomerPrescriptions(user) {
    if (!user) throw new BadRequestException('Authentication required');
    const customer = await Customer.findOne({ where: { userId: user.id } });
    const where = {};
    if (customer) {
      where[Op.or] = [{ customerId: customer.id }, { patientPhone: customer.phone }];
    } else {
      where.patientName = user.username;
    }
    return Prescription.findAll({ where, order: [['createdAt', 'DESC']] });
  }

  async createSupportInquiry(payload) {
    if (!payload.name || !payload.phone || !payload.message) {
      throw new BadRequestException('Name, phone number, and message are required');
    }
    const inquiry = await SupportInquiry.create({
      inquiryType: payload.inquiryType || 'Help finding product',
      name: payload.name,
      phone: payload.phone,
      email: payload.email || null,
      message: payload.message,
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
