const { Injectable, InternalServerErrorException } = require('@nestjs/common');
const { Medicine, Batch, sequelize } = require('../../models');

class InventoryService {
  async list() {
    return Medicine.findAll({ order: [['name', 'ASC']], include: [{ model: Batch }] });
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
      const { items, supplier, warehouse, invoiceNumber, receivedDate } = body;
      if (!Array.isArray(items)) throw new Error('Items must be an array');
      const createdItems = [];

      for (const item of items) {
        let medicine = await Medicine.findOne({ where: { name: item.name } });
        if (!medicine) {
          medicine = await Medicine.create({
            name: item.name,
            genericName: item.genericName,
            category: item.category,
            dosage: item.dosage,
            strength: item.strength,
            supplier: supplier || item.supplier,
            manufacturer: item.manufacturer,
            barcode: item.barcode,
            lowStockThreshold: item.threshold || 10,
          }, { transaction });
        }
        const batch = await Batch.create({
          medicineId: medicine.id,
          batchNumber: item.batchNumber || `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          quantity: Number(item.quantity),
          expiryDate: item.expiryDate,
          costPrice: Number(item.costPrice),
          sellingPrice: Number(item.sellingPrice),
          warehouse,
          invoiceNumber,
          receivedDate: receivedDate || new Date(),
        }, { transaction });
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
      let medicine = await Medicine.findOne({ where: { name: body.name } });
      if (!medicine) {
        medicine = await Medicine.create({
          name: body.name,
          genericName: body.genericName,
          category: body.category,
          dosage: body.dosage,
          strength: body.strength,
          supplier: body.supplier,
          manufacturer: body.manufacturer,
          barcode: body.barcode,
          imageUrl: body.imageUrl,
          lowStockThreshold: body.threshold || 10,
        }, { transaction });
      }
      if (body.batchNumber && body.quantity) {
        await Batch.create({
          medicineId: medicine.id,
          batchNumber: body.batchNumber,
          quantity: Number(body.quantity),
          expiryDate: body.expiryDate,
          costPrice: Number(body.costPrice),
          sellingPrice: Number(body.sellingPrice),
        }, { transaction });
      }
      await transaction.commit();
      return Medicine.findByPk(medicine.id, { include: [Batch] });
    } catch (error) {
      await transaction.rollback();
      throw new InternalServerErrorException(error.message || 'Failed to add inventory');
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
            expiryDate: new Date(),
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
          await Batch.update({
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            warehouse: batch.warehouse,
          }, { where: { id: batch.id } });
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