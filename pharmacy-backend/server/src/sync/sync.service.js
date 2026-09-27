const {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} = require('@nestjs/common');
const { Batch, InventoryMovement, Medicine, Sales, sequelize } = require('../../models');
const SalesService = require('../sales/sales.service');
const InventoryService = require('../inventory/inventory.service');
const { ROLE_PERMISSIONS, Permissions } = require('../auth/permissions');

class SyncService {
  constructor(salesService, inventoryService) {
    this.salesService = salesService;
    this.inventoryService = inventoryService;
  }

  async processSync(body, user) {
    const rawOps = Array.isArray(body)
      ? body
      : (Array.isArray(body?.operations) ? body.operations : [body]);
    const operations = rawOps.filter(Boolean);
    const results = [];

    const userPermissions = new Set(
      user?.role ? (ROLE_PERMISSIONS[user.role] || []) : Object.values(Permissions)
    );

    for (const op of operations) {
      const clientTransactionId = op.clientTransactionId || op.idempotencyKey || null;
      const type = (op.type || 'SALE').toUpperCase();

      if (!clientTransactionId) {
        results.push({
          clientTransactionId: null,
          type,
          status: 'error',
          message: 'Missing clientTransactionId for sync operation',
        });
        continue;
      }

      // 1. Permission check
      if (type === 'SALE' && !userPermissions.has(Permissions.SALES_WRITE)) {
        results.push({
          clientTransactionId,
          type,
          status: 'error',
          message: 'User does not have permission to sync sales',
        });
        continue;
      }

      if ((type === 'RESTOCK' || type === 'ADJUSTMENT') && !userPermissions.has(Permissions.INVENTORY_WRITE)) {
        results.push({
          clientTransactionId,
          type,
          status: 'error',
          message: 'User does not have permission to modify inventory stock',
        });
        continue;
      }

      // 2. Process by type with conflict detection
      try {
        if (type === 'SALE') {
          const result = await this.syncSale(op, clientTransactionId);
          results.push(result);
        } else if (type === 'RESTOCK' || type === 'ADD_BATCH') {
          const result = await this.syncRestock(op, clientTransactionId);
          results.push(result);
        } else if (type === 'ADJUSTMENT' || type === 'STOCK_ADJUSTMENT') {
          const result = await this.syncAdjustment(op, clientTransactionId);
          results.push(result);
        } else {
          results.push({
            clientTransactionId,
            type,
            status: 'error',
            message: `Unsupported operation type: ${type}`,
          });
        }
      } catch (err) {
        console.error(`Sync error on operation ${clientTransactionId}:`, err.message);
        results.push({
          clientTransactionId,
          type,
          status: 'error',
          message: err.message || 'Internal sync failure',
        });
      }
    }

    return {
      success: true,
      processedCount: results.length,
      syncedCount: results.filter((r) => r.status === 'synced' || r.status === 'already_synced').length,
      conflictCount: results.filter((r) => r.status === 'conflict').length,
      errorCount: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  async syncSale(op, clientTransactionId) {
    // 1. Idempotency check: see if already synced
    const existing = await Sales.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { clientTransactionId },
          { clientTransactionId: { [sequelize.Sequelize.Op.like]: `${clientTransactionId}_%` } },
        ],
      },
    });

    if (existing.length > 0) {
      return {
        clientTransactionId,
        type: 'SALE',
        status: 'already_synced',
        data: existing,
      };
    }

    // 2. Validate inventory conflict before mutating
    const rawItems = Array.isArray(op.payload)
      ? op.payload
      : (Array.isArray(op.payload?.items) ? op.payload.items : [op.payload]);

    const transaction = await sequelize.transaction();
    try {
      // Validate all items have sufficient server stock
      for (const item of rawItems) {
        const medicine = await this.salesService.findMedicineForSale(item, transaction);
        if (!medicine) {
          await transaction.rollback();
          return {
            clientTransactionId,
            type: 'SALE',
            status: 'conflict',
            message: `Product not found: ${item.name || item.medicineId}`,
          };
        }

        const batches = await Batch.findAll({
          where: { medicineId: medicine.id },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const available = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
        const reqQty = Number(item.quantity || 0);

        if (available < reqQty) {
          await transaction.rollback();
          return {
            clientTransactionId,
            type: 'SALE',
            status: 'conflict',
            message: `Insufficient stock on server for ${medicine.name}. Requested: ${reqQty}, Available on server: ${available}`,
            requestedQuantity: reqQty,
            availableStock: available,
            medicineId: medicine.id,
            medicineName: medicine.name,
          };
        }
      }
      await transaction.rollback();
    } catch (validationErr) {
      await transaction.rollback();
      throw validationErr;
    }

    // 3. Delegate to salesService.create which executes the FIFO batch deduction idempotently
    const payloadWithId = Array.isArray(op.payload)
      ? op.payload.map((item, idx) => ({ ...item, clientTransactionId: `${clientTransactionId}_${idx}`, date: op.clientTimestamp || item.date }))
      : { ...op.payload, clientTransactionId, date: op.clientTimestamp || op.payload?.date };

    const created = await this.salesService.create(payloadWithId);
    return {
      clientTransactionId,
      type: 'SALE',
      status: 'synced',
      data: created,
    };
  }

  async syncRestock(op, clientTransactionId) {
    // Check if movement with this clientTransactionId already exists
    const existingMovement = await InventoryMovement.findOne({
      where: { clientTransactionId },
    });
    if (existingMovement) {
      return {
        clientTransactionId,
        type: 'RESTOCK',
        status: 'already_synced',
        data: existingMovement,
      };
    }

    const payload = op.payload || {};
    const result = await this.inventoryService.addBatch({
      ...payload,
      metadata: {
        ...(payload.metadata || {}),
        reason: `Offline restock sync (${clientTransactionId})`,
      },
    });

    // Tag created movements with clientTransactionId
    if (result?.items && Array.isArray(result.items)) {
      for (const item of result.items) {
        await InventoryMovement.update(
          { clientTransactionId },
          { where: { medicineId: item.medicineId, batchId: item.batchId, clientTransactionId: null } }
        );
      }
    }

    return {
      clientTransactionId,
      type: 'RESTOCK',
      status: 'synced',
      data: result,
    };
  }

  async syncAdjustment(op, clientTransactionId) {
    const existingMovement = await InventoryMovement.findOne({
      where: { clientTransactionId },
    });
    if (existingMovement) {
      return {
        clientTransactionId,
        type: 'ADJUSTMENT',
        status: 'already_synced',
        data: existingMovement,
      };
    }

    const payload = op.payload || {};
    const medicineId = payload.medicineId;
    const quantityChange = Number(payload.quantityChange || 0);

    if (!medicineId || !Number.isInteger(quantityChange) || quantityChange === 0) {
      return {
        clientTransactionId,
        type: 'ADJUSTMENT',
        status: 'error',
        message: 'Invalid adjustment payload: medicineId and non-zero integer quantityChange required',
      };
    }

    const transaction = await sequelize.transaction();
    try {
      const medicine = await Medicine.findByPk(medicineId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!medicine) {
        await transaction.rollback();
        return {
          clientTransactionId,
          type: 'ADJUSTMENT',
          status: 'conflict',
          message: `Medicine #${medicineId} not found on server`,
        };
      }

      const batches = await Batch.findAll({
        where: { medicineId },
        order: [['expiryDate', 'ASC'], ['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const currentTotal = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);

      if (quantityChange < 0 && currentTotal + quantityChange < 0) {
        await transaction.rollback();
        return {
          clientTransactionId,
          type: 'ADJUSTMENT',
          status: 'conflict',
          message: `Cannot reduce stock below zero. Current server stock: ${currentTotal}, adjustment: ${quantityChange}`,
          availableStock: currentTotal,
        };
      }

      // Apply adjustment to batches
      if (quantityChange > 0) {
        const batch = await Batch.create({
          medicineId,
          batchNumber: `ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          quantity: quantityChange,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          costPrice: 0,
          sellingPrice: batches[0]?.sellingPrice || 0,
        }, { transaction });

        await InventoryMovement.create({
          medicineId,
          batchId: batch.id,
          movementType: 'ADJUSTMENT',
          quantityChange,
          referenceType: 'MEDICINE',
          referenceId: medicineId,
          reason: payload.reason || `Offline adjustment (${clientTransactionId})`,
          clientTransactionId,
        }, { transaction });
      } else {
        let remaining = Math.abs(quantityChange);
        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduction = Math.min(Number(batch.quantity || 0), remaining);
          if (deduction === 0) continue;
          await batch.update({ quantity: Number(batch.quantity) - deduction }, { transaction });
          await InventoryMovement.create({
            medicineId,
            batchId: batch.id,
            movementType: 'ADJUSTMENT',
            quantityChange: -deduction,
            referenceType: 'MEDICINE',
            referenceId: medicineId,
            reason: payload.reason || `Offline adjustment (${clientTransactionId})`,
            clientTransactionId,
          }, { transaction });
          remaining -= deduction;
        }
      }

      await medicine.update({ totalQuantity: currentTotal + quantityChange }, { transaction });
      await transaction.commit();

      return {
        clientTransactionId,
        type: 'ADJUSTMENT',
        status: 'synced',
        serverStock: currentTotal + quantityChange,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

Injectable()(SyncService);
Inject(SalesService)(SyncService, undefined, 0);
Inject(InventoryService)(SyncService, undefined, 1);
module.exports = SyncService;
