const {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} = require('@nestjs/common');
const { Batch, Customer, InventoryMovement, Medicine, Sales, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { paginatedResponse, parsePagination } = require('../common/pagination');
const { normalizeIdentityValue } = require('../inventory/product-identity');
const { buildReceiptEmailHtml, sendReceiptEmail } = require('./receipt-email');

function rethrowSalesPersistenceError(error) {
  if (error instanceof HttpException) throw error;
  console.error('Sale persistence operation failed:', error?.name || 'UnknownError', error?.parent?.code || '');
  throw new InternalServerErrorException('Failed to record sale');
}

class SalesService {
  async list(query) {
    const pagination = parsePagination(query);
    const where = {};
    if (query.from || query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      if (!query.from || !query.to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
        throw new BadRequestException('A valid sales date range is required');
      }
      where.date = { [Op.gte]: from, [Op.lt]: to };
    }
    const result = await Sales.findAndCountAll({
      where,
      include: [{ model: User, as: 'ReversedBy', attributes: ['username'], required: false }],
      order: [['date', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return paginatedResponse(result.rows, result.count, pagination);
  }

  async findMedicineForSale(item, transaction) {
    if (item.medicineId) {
      return Medicine.findByPk(item.medicineId, { transaction, lock: transaction.LOCK.UPDATE });
    }

    const requestedName = normalizeIdentityValue(item.name);
    if (!requestedName) throw new BadRequestException('Medicine ID or name is required');
    const candidates = await Medicine.findAll({ transaction, lock: transaction.LOCK.UPDATE });
    const matches = candidates.filter((medicine) => normalizeIdentityValue(medicine.name) === requestedName);
    if (matches.length > 1) {
      throw new BadRequestException('Multiple medicines share this name. Select the medicine before recording a sale.');
    }
    return matches[0] || null;
  }

  async findReceiptRows(id, options = {}) {
    const saleId = Number.parseInt(id, 10);
    if (!Number.isInteger(saleId) || saleId < 1) throw new BadRequestException('Invalid sale ID');
    const sale = await Sales.findByPk(saleId, options);
    if (!sale) throw new NotFoundException('Sale not found');
    return sale.receiptNumber
      ? Sales.findAll({
        where: { receiptNumber: sale.receiptNumber },
        order: [['id', 'ASC']],
        ...options,
      })
      : [sale];
  }

  async batchDeductionsForSale(sale, options = {}) {
    const movements = await InventoryMovement.findAll({
      where: {
        movementType: 'SALE',
        referenceType: 'SALE',
        referenceId: sale.id,
      },
      order: [['id', 'ASC']],
      ...options,
    });

    if (movements.length > 0) {
      const total = movements.reduce((sum, movement) => sum + Math.abs(Number(movement.quantityChange || 0)), 0);
      if (total !== Number(sale.quantity)) {
        throw new ConflictException(`Sale ${sale.id} has incomplete batch movement history and cannot be safely reversed`);
      }
      return movements.map((movement) => ({
        batchId: movement.batchId,
        quantity: Math.abs(Number(movement.quantityChange || 0)),
      }));
    }

    if (sale.batchId) {
      return [{ batchId: sale.batchId, quantity: Number(sale.quantity) }];
    }

    throw new ConflictException(`Sale ${sale.id} has no batch movement history and cannot be safely reversed`);
  }

  async reversalPreview(id) {
    const rows = await this.findReceiptRows(id);
    const inventoryImpact = [];
    for (const sale of rows) {
      const deductions = await this.batchDeductionsForSale(sale);
      for (const deduction of deductions) {
        const batch = await Batch.findByPk(deduction.batchId);
        if (!batch) throw new ConflictException(`Original batch ${deduction.batchId} no longer exists`);
        inventoryImpact.push({
          itemName: sale.name,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantity: deduction.quantity,
        });
      }
    }

    const customer = rows[0].customerId ? await Customer.findByPk(rows[0].customerId) : null;
    return {
      saleId: rows[0].id,
      receiptNumber: rows[0].receiptNumber || null,
      date: rows[0].date,
      soldBy: rows[0].soldBy || null,
      customerName: customer?.name || null,
      items: rows.map((sale) => ({
        name: sale.name,
        quantity: sale.quantity,
        pricePerUnit: sale.pricePerUnit,
        totalPrice: sale.totalPrice,
        saleStatus: sale.saleStatus || 'COMPLETED',
      })),
      total: rows.reduce((sum, sale) => sum + Number(sale.totalPrice || 0), 0),
      inventoryImpact,
    };
  }

  async reverseSale(id, reasonInput, actor) {
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (!reason) throw new BadRequestException('A reversal reason is required');
    if (!actor?.id) throw new BadRequestException('Authenticated administrator is required');

    const initialRows = await this.findReceiptRows(id);
    const transaction = await sequelize.transaction();
    try {
      const where = initialRows[0].receiptNumber
        ? { receiptNumber: initialRows[0].receiptNumber }
        : { id: initialRows[0].id };
      const rows = await Sales.findAll({
        where,
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (rows.length === 0) throw new NotFoundException('Sale not found');
      if (rows.some((sale) => (sale.saleStatus || 'COMPLETED') !== 'COMPLETED')) {
        throw new ConflictException('This sale has already been reversed or is not completed');
      }

      const batchTotals = new Map();
      const movementPlans = [];
      for (const sale of rows) {
        const deductions = await this.batchDeductionsForSale(sale, { transaction, lock: transaction.LOCK.UPDATE });
        for (const deduction of deductions) {
          const key = `${sale.medicineId}:${deduction.batchId}`;
          batchTotals.set(key, (batchTotals.get(key) || 0) + deduction.quantity);
          movementPlans.push({ sale, ...deduction });
        }
      }

      for (const [key, quantity] of batchTotals) {
        const [, batchIdValue] = key.split(':');
        const batchId = Number(batchIdValue);
        const batch = await Batch.findByPk(batchId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!batch) throw new ConflictException(`Original batch ${batchId} no longer exists`);
        await batch.update({ quantity: Number(batch.quantity) + quantity }, { transaction });
      }

      for (const { sale, batchId, quantity } of movementPlans) {
        await InventoryMovement.create({
          medicineId: sale.medicineId,
          batchId,
          movementType: 'SALE_REVERSAL',
          quantityChange: quantity,
          referenceType: 'SALE_REVERSAL',
          referenceId: sale.id,
          reason: `${sale.receiptNumber ? `Receipt ${sale.receiptNumber}. ` : ''}${reason}`,
        }, { transaction });
      }

      const medicineIds = [...new Set(rows.map((sale) => sale.medicineId).filter(Boolean))];
      for (const medicineId of medicineIds) {
        const totalQuantity = await Batch.sum('quantity', { where: { medicineId }, transaction });
        await Medicine.update({ totalQuantity: Number(totalQuantity || 0) }, { where: { id: medicineId }, transaction });
      }

      const reversedAt = new Date();
      await Sales.update({
        saleStatus: 'REVERSED',
        reversedAt,
        reversedByUserId: actor.id,
        reversalReason: reason,
      }, { where, transaction });

      await transaction.commit();
      return {
        receiptNumber: rows[0].receiptNumber || null,
        saleIds: rows.map((sale) => sale.id),
        saleStatus: 'REVERSED',
        reversedAt,
        reversedBy: actor.username,
        reversalReason: reason,
        inventoryRestored: movementPlans.map(({ sale, batchId, quantity }) => ({ saleId: sale.id, itemName: sale.name, batchId, quantity })),
        refundProcessed: false,
      };
    } catch (error) {
      await transaction.rollback();
      rethrowSalesPersistenceError(error);
    }
  }

  async emailReceipt(id, emailInput) {
    const email = typeof emailInput === 'string' ? emailInput.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid receipt email address is required');
    }
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECEIPT_FROM_EMAIL;
    if (!apiKey || !from) {
      throw new ConflictException('Receipt email is not configured on the server');
    }

    const rows = await this.findReceiptRows(id);
    if (rows.some((sale) => (sale.saleStatus || 'COMPLETED') !== 'COMPLETED')) {
      throw new ConflictException('A receipt cannot be emailed for a reversed sale');
    }
    const customer = rows[0].customerId ? await Customer.findByPk(rows[0].customerId) : null;
    const pharmacyName = process.env.PHARMACY_NAME || 'MediQuick Pharmacy';
    const pharmacyAddress = process.env.PHARMACY_ADDRESS || '';
    const pharmacyPhone = process.env.PHARMACY_PHONE || '';
    const html = buildReceiptEmailHtml({
      rows,
      customer,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
    });

    try {
      await sendReceiptEmail('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `MediQuick Pharmacy receipt ${rows[0].receiptNumber || ''}`.trim(),
          html,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error('Receipt email provider request failed:', error?.name || 'UnknownError');
      throw new InternalServerErrorException('Receipt email could not be sent');
    }
    return { success: true, message: 'Receipt email sent' };
  }

  async create(payload, actor) {
    const rawItems = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.items) ? payload.items : [payload]);
    const batchTxId = !Array.isArray(payload) ? (payload?.clientTransactionId || null) : null;
    const items = rawItems.map((item, index) => {
      const txId = item.clientTransactionId || (batchTxId ? `${batchTxId}_${index}` : null);
      return { ...item, clientTransactionId: txId };
    });

    if (items.length === 0 || items.some((item) => (
      typeof item.clientTransactionId !== 'string'
      || item.clientTransactionId.trim().length === 0
      || item.clientTransactionId.length > 128
    ))) {
      throw new BadRequestException('A clientTransactionId of 1 to 128 characters is required for every sale item');
    }

    const clientTxIds = items.map((item) => item.clientTransactionId);
    if (new Set(clientTxIds).size !== clientTxIds.length) {
      throw new BadRequestException('Each sale item must have a unique clientTransactionId');
    }

    const returnRows = (rows) => {
      const rowsByClientTxId = new Map(rows.map((row) => [row.clientTransactionId, row]));
      const orderedRows = clientTxIds.map((clientTransactionId) => rowsByClientTxId.get(clientTransactionId));
      return Array.isArray(payload) || Array.isArray(payload?.items) ? orderedRows : orderedRows[0];
    };
    const findExistingRows = () => Sales.findAll({
      where: { clientTransactionId: clientTxIds },
    });
    const existingRows = await findExistingRows();
    if (existingRows.length > 0) {
      if (existingRows.length !== items.length) {
        throw new ConflictException('This sale was only partially recorded. Contact an administrator before retrying.');
      }
      return returnRows(existingRows);
    }

    const receiptNumbers = [...new Set(items.map((item) => item.receiptNumber).filter(Boolean))];
    if (receiptNumbers.length > 1) {
      throw new BadRequestException('All items in a sale must use the same receipt number');
    }
    if (receiptNumbers.length === 1) {
      const receiptAlreadyUsed = await Sales.findOne({ where: { receiptNumber: receiptNumbers[0] } });
      if (receiptAlreadyUsed) throw new ConflictException('Receipt number is already in use');
    }

    const transaction = await sequelize.transaction();
    try {
      const createdSales = [];

      for (const item of items) {
        if (item.clientTransactionId) {
          const existing = await Sales.findOne({
            where: { clientTransactionId: item.clientTransactionId },
            transaction,
          });
          if (existing) {
            createdSales.push(existing);
            continue;
          }
        }

        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException('Sale quantity must be a positive whole number');
        }
        const totalPrice = Number(item.totalPrice);
        if (!Number.isFinite(totalPrice) || totalPrice < 0) {
          throw new BadRequestException('Sale total price must be a non-negative number');
        }
        const discount = Number(item.discount || 0);
        if (!Number.isFinite(discount) || discount < 0) {
          throw new BadRequestException('Sale discount must be a non-negative number');
        }

        const medicine = await this.findMedicineForSale(item, transaction);
        if (!medicine) throw new NotFoundException(`Product not found: ${item.name || item.medicineId}`);

        const batches = await Batch.findAll({
          where: { medicineId: medicine.id },
          order: [['expiryDate', 'ASC'], ['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const available = batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
        if (available < quantity) throw new BadRequestException(`Not enough stock for ${medicine.name}`);

        let remaining = quantity;
        let totalCost = 0;
        const deductions = [];
        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduction = Math.min(Number(batch.quantity || 0), remaining);
          if (deduction === 0) continue;
          deductions.push({ batch, deduction });
          totalCost += Number(batch.costPrice || 0) * deduction;
          remaining -= deduction;
        }

        const saleDate = item.date && !Number.isNaN(new Date(item.date).getTime())
          ? new Date(item.date)
          : new Date();

        const sale = await Sales.create({
          name: medicine.name,
          medicineId: medicine.id,
          batchId: deductions.length === 1 ? deductions[0].batch.id : null,
          customerId: item.customerId || null,
          soldBy: actor?.username || null,
          soldByUserId: actor?.id || null,
          saleStatus: 'COMPLETED',
          quantity,
          pricePerUnit: totalPrice / quantity,
          totalPrice,
          discount,
          totalCost,
          paymentMethod: item.paymentMethod || 'Cash',
          receiptNumber: item.receiptNumber || null,
          date: saleDate,
          clientTransactionId: item.clientTransactionId || null,
        }, { transaction });

        for (const { batch, deduction } of deductions) {
          await batch.update({ quantity: Number(batch.quantity) - deduction }, { transaction });
          await InventoryMovement.create({
            medicineId: medicine.id,
            batchId: batch.id,
            movementType: 'SALE',
            quantityChange: -deduction,
            referenceType: 'SALE',
            referenceId: sale.id,
            reason: item.receiptNumber ? `Receipt ${item.receiptNumber}` : null,
            clientTransactionId: item.clientTransactionId || null,
          }, { transaction });
        }
        await medicine.update({ totalQuantity: available - quantity }, { transaction });
        createdSales.push(sale);
      }

      await transaction.commit();
      return Array.isArray(payload) || Array.isArray(payload?.items) ? createdSales : createdSales[0];
    } catch (error) {
      await transaction.rollback();

      const isIdempotencyRace = error?.name === 'SequelizeUniqueConstraintError'
        || error?.name === 'SequelizeTimeoutError'
        || ['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(error?.parent?.code);
      if (isIdempotencyRace) {
        try {
          const existing = await findExistingRows();
          if (existing.length === items.length) {
            return returnRows(existing);
          }
          if (existing.length > 0) {
            throw new ConflictException('This sale was only partially recorded. Contact an administrator before retrying.');
          }
        } catch (lookupError) {
          if (lookupError instanceof HttpException) throw lookupError;
          console.error('Could not resolve an idempotent sale retry:', lookupError?.name || 'UnknownError');
        }
      }

      rethrowSalesPersistenceError(error);
    }
  }
}

Injectable()(SalesService);
module.exports = SalesService;
