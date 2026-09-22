const { Injectable, InternalServerErrorException } = require('@nestjs/common');
const { Sales, Medicine, Batch, sequelize } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');

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

  async create(payload) {
    const transaction = await sequelize.transaction();
    try {
      const items = Array.isArray(payload) ? payload : [payload];
      const createdSales = [];
      for (const item of items) {
        const quantity = Number(item.quantity);
        const medicine = item.medicineId
          ? await Medicine.findByPk(item.medicineId, { include: [Batch] })
          : await Medicine.findOne({ where: { name: item.name }, include: [Batch] });
        if (!medicine) throw new Error(`Product not found: ${item.name}`);

        const batches = medicine.Batches.sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate));
        let remaining = quantity;
        let totalCost = 0;
        for (const batch of batches) {
          if (remaining <= 0) break;
          if (batch.quantity <= 0) continue;
          const deduction = Math.min(batch.quantity, remaining);
          batch.quantity -= deduction;
          await batch.save({ transaction });
          totalCost += batch.costPrice * deduction;
          remaining -= deduction;
        }
        if (remaining > 0) throw new Error(`Not enough stock for ${medicine.name}`);

        createdSales.push(await Sales.create({
          name: medicine.name,
          medicineId: medicine.id,
          customerId: item.customerId || null,
          quantity,
          totalPrice: Number(item.totalPrice),
          totalCost,
          paymentMethod: item.paymentMethod || 'Cash',
          receiptNumber: item.receiptNumber || null,
          date: new Date(),
        }, { transaction }));
      }
      await transaction.commit();
      return Array.isArray(payload) ? createdSales : createdSales[0];
    } catch (error) {
      await transaction.rollback();
      throw new InternalServerErrorException(error.message || 'Failed to record sale');
    }
  }
}

Injectable()(SalesService);
module.exports = SalesService;