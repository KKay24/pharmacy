const { Injectable, InternalServerErrorException } = require('@nestjs/common');
const { Medicine, Batch, sequelize } = require('../../models');
const { paginatedResponse, parsePagination } = require('../common/pagination');

function sanitizeDate(value, defaultDate) {
  if (value && typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
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

class InventoryService {
  async list(query) {
    const pagination = parsePagination(query);
    const result = await Medicine.findAndCountAll({
      order: [['name', 'ASC']],
      include: [{ model: Batch }],
      distinct: true,
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return paginatedResponse(result.rows, result.count, pagination);
  }

  async lowStock() {
    const medicines = await Medicine.findAll({ include: [Batch] });
    return medicines.filter((medicine) => {
      const total = medicine.Batches.reduce((sum, batch) => sum + batch.quantity, 0);
      return total <= medicine.lowStockThreshold;
    });
  }

  async addBatch(body) {
    const transaction = await sequelize.transaction();
    try {
      const metadata = body.metadata || {};
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) throw new Error('Items array is required and must not be empty');

      const supplier = body.supplier || metadata.supplier || null;
      const warehouse = body.warehouse || metadata.warehouse || null;
      const invoiceNumber = body.invoiceNumber || metadata.invoiceNumber || null;
      const rawReceivedDate = body.receivedDate || metadata.orderDate || metadata.receivedDate;
      const receivedDate = sanitizeDate(rawReceivedDate, getTodayDate());
      const defaultExpiry = getDefaultExpiryDate();

      const createdItems = [];

      for (const item of items) {
        const name = (item.name || '').trim();
        if (!name) continue;

        let medicine = await Medicine.findOne({ where: { name }, transaction });
        if (!medicine) {
          medicine = await Medicine.create({
            name,
            genericName: item.genericName || null,
            category: item.category || null,
            dosage: item.dosage || null,
            strength: item.strength || null,
            supplier: supplier || item.supplier || null,
            manufacturer: item.manufacturer || null,
            barcode: item.barcode || null,
            imageUrl: item.imageUrl || null,
            lowStockThreshold: Number(item.threshold) || 10,
            totalQuantity: 0,
          }, { transaction });
        }

        const quantity = Math.max(0, parseInt(item.quantity, 10) || 0);
        const costPrice = Math.max(0, parseFloat(item.costPrice) || 0);
        const sellingPrice = Math.max(0, parseFloat(item.sellingPrice) || 0);
        const batchNumber = (item.batchNumber && typeof item.batchNumber === 'string' && item.batchNumber.trim())
          ? item.batchNumber.trim()
          : `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const expiryDate = sanitizeDate(item.expiryDate, defaultExpiry);

        const batch = await Batch.create({
          medicineId: medicine.id,
          batchNumber,
          quantity,
          expiryDate,
          costPrice,
          sellingPrice,
          warehouse,
          invoiceNumber,
          receivedDate,
        }, { transaction });

        await medicine.increment('totalQuantity', { by: quantity, transaction });
        createdItems.push({ medicine, batch });
      }

      await transaction.commit();
      return { success: true, count: createdItems.length };
    } catch (error) {
      await transaction.rollback();
      throw new InternalServerErrorException(error.message || 'Failed to process batch inventory');
    }
  }

  async add(body) {
    const transaction = await sequelize.transaction();
    try {
      const name = (body.name || '').trim();
      if (!name) throw new Error('Medicine name is required');

      let medicine = await Medicine.findOne({ where: { name }, transaction });
      if (!medicine) {
        medicine = await Medicine.create({
          name,
          genericName: body.genericName || null,
          category: body.category || null,
          dosage: body.dosage || null,
          strength: body.strength || null,
          supplier: body.supplier || null,
          manufacturer: body.manufacturer || null,
          barcode: body.barcode || null,
          imageUrl: body.imageUrl || null,
          lowStockThreshold: Number(body.threshold) || 10,
          totalQuantity: 0,
        }, { transaction });
      }

      if (body.batchNumber && body.quantity) {
        const quantity = Math.max(0, parseInt(body.quantity, 10) || 0);
        const costPrice = Math.max(0, parseFloat(body.costPrice) || 0);
        const sellingPrice = Math.max(0, parseFloat(body.sellingPrice) || 0);
        const expiryDate = sanitizeDate(body.expiryDate, getDefaultExpiryDate());
        const receivedDate = sanitizeDate(body.receivedDate, getTodayDate());
        const batchNumber = String(body.batchNumber).trim();

        await Batch.create({
          medicineId: medicine.id,
          batchNumber,
          quantity,
          expiryDate,
          costPrice,
          sellingPrice,
          warehouse: body.warehouse || null,
          invoiceNumber: body.invoiceNumber || null,
          receivedDate,
        }, { transaction });

        await medicine.increment('totalQuantity', { by: quantity, transaction });
      }

      await transaction.commit();
      return Medicine.findByPk(medicine.id, { include: [Batch] });
    } catch (error) {
      await transaction.rollback();
      throw new InternalServerErrorException(error.message || 'Failed to add inventory item');
    }
  }

  async update(id, body) {
    await Medicine.update(body, { where: { id } });
    if (body.sellingPrice !== undefined) await Batch.update({ sellingPrice: body.sellingPrice }, { where: { medicineId: id } });
    if (body.costPrice !== undefined) await Batch.update({ costPrice: body.costPrice }, { where: { medicineId: id } });

    if (body.totalQuantity !== undefined) {
      const medicine = await Medicine.findByPk(id, { include: [Batch] });
      if (medicine) {
        const currentTotal = medicine.Batches.reduce((sum, batch) => sum + batch.quantity, 0);
        const newTotal = Number(body.totalQuantity);
        const difference = newTotal - currentTotal;
        if (difference !== 0) {
          await Batch.create({
            medicineId: id,
            batchNumber: `ADJ-${Date.now()}`,
            quantity: difference,
            expiryDate: getDefaultExpiryDate(),
            costPrice: body.costPrice || 0,
            sellingPrice: body.sellingPrice || 0,
          });
          medicine.totalQuantity = newTotal;
          await medicine.save();
        }
      }
    }

    if (Array.isArray(body.Batches)) {
      for (const batch of body.Batches) {
        if (batch.id) {
          const updateData = {
            batchNumber: batch.batchNumber,
            warehouse: batch.warehouse,
          };
          if (batch.expiryDate) {
            updateData.expiryDate = sanitizeDate(batch.expiryDate, getDefaultExpiryDate());
          }
          await Batch.update(updateData, { where: { id: batch.id } });
        }
      }
    }
    return Medicine.findByPk(id, { include: [Batch] });
  }

  async remove(id) {
    await Medicine.destroy({ where: { id } });
    return { message: 'Medicine deleted' };
  }
}

Injectable()(InventoryService);
module.exports = InventoryService;