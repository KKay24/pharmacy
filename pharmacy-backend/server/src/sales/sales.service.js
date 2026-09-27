const {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} = require('@nestjs/common');
const { Batch, InventoryMovement, Medicine, Sales, sequelize } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');
const { normalizeIdentityValue } = require('../inventory/product-identity');

function rethrowSalesPersistenceError(error) {
  if (error instanceof HttpException) throw error;
  console.error('Sale persistence operation failed:', error?.name || 'UnknownError', error?.parent?.code || '');
  throw new InternalServerErrorException('Failed to record sale');
}

class SalesService {
  async list(query) {
    const pagination = parsePagination(query);
    const result = await Sales.findAndCountAll({
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

  async create(payload) {
    const rawItems = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.items) ? payload.items : [payload]);
    const batchTxId = !Array.isArray(payload) ? (payload?.clientTransactionId || null) : null;
    const items = rawItems.map((item, index) => {
      const txId = item.clientTransactionId || (batchTxId ? `${batchTxId}_${index}` : null);
      return { ...item, clientTransactionId: txId };
    });

    // Fast-path: if all items already exist under their clientTransactionId, return them immediately
    const clientTxIds = items.map((i) => i.clientTransactionId).filter(Boolean);
    if (clientTxIds.length > 0 && clientTxIds.length === items.length) {
      const existingRows = await Sales.findAll({
        where: { clientTransactionId: clientTxIds },
      });
      if (existingRows.length === items.length) {
        return Array.isArray(payload) || Array.isArray(payload?.items) ? existingRows : existingRows[0];
      }
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
          quantity,
          pricePerUnit: totalPrice / quantity,
          totalPrice,
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

      // If race condition on duplicate clientTransactionId, return existing records
      if (error?.name === 'SequelizeUniqueConstraintError' && clientTxIds.length > 0) {
        const existing = await Sales.findAll({ where: { clientTransactionId: clientTxIds } });
        if (existing.length > 0) {
          return Array.isArray(payload) || Array.isArray(payload?.items) ? existing : existing[0];
        }
      }

      rethrowSalesPersistenceError(error);
    }
  }
}

Injectable()(SalesService);
module.exports = SalesService;
