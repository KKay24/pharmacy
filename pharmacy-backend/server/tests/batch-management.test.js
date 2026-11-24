const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-batch-mgmt-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'batch-management.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'batch-management-test-secret-12345';

let sequelize;
let Batch;
let InventoryCategory;
let InventoryMovement;
let Medicine;
let Sales;
let User;
let InventoryService;
let SalesService;
let AuthService;
let InventoryController;
let hashPassword;
let Permissions;
let PERMISSIONS_KEY;

describe('MediQuick Batch Management (auto-generation, safeguards, history, consistency)', () => {
  let inventoryService;
  let salesService;
  let authService;
  let adminUser;
  let managerUser;
  let mainCategoryId;

  before(async () => {
    const { ensureApplicationReady } = require('../src/app.module');
    await ensureApplicationReady();

    const models = require('../models');
    sequelize = models.sequelize;
    Batch = models.Batch;
    InventoryCategory = models.InventoryCategory;
    InventoryMovement = models.InventoryMovement;
    Medicine = models.Medicine;
    Sales = models.Sales;
    User = models.User;

    InventoryService = require('../src/inventory/inventory.service');
    SalesService = require('../src/sales/sales.service');
    AuthService = require('../src/auth/auth.service');
    InventoryController = require('../src/inventory/inventory.controller');
    ({ hashPassword } = require('../lib/auth/passwords'));
    ({ Permissions, PERMISSIONS_KEY } = require('../src/auth/permissions'));

    inventoryService = new InventoryService();
    salesService = new SalesService();
    authService = new AuthService();

    adminUser = await User.create({
      username: 'pharmacy-admin',
      email: 'pharmacy-admin@example.test',
      password: hashPassword('BatchAdminPassword123!'),
      role: 'admin',
      status: 'active',
    });

    managerUser = await User.create({
      username: 'stock-manager',
      email: 'stock-manager@example.test',
      password: hashPassword('BatchManagerPassword123!'),
      role: 'manager',
      status: 'active',
    });

    const category = await InventoryCategory.findOne({ where: { level: 1 } });
    mainCategoryId = category.id;
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('1, 2, 3, 4: Adding stock auto-generates unique MQ-PRODUCTID-YYYYMMDD-HHMMSS-USERID batches and preserves existing batches', async () => {
    const created = await inventoryService.add({
      name: 'VIT C PLUS',
      genericName: 'Ascorbic Acid',
      strength: '500mg',
      mainCategoryId,
      supplier: 'MedSupply Ltd',
      quantity: 10,
      costPrice: 4.4,
      sellingPrice: 8.5,
      expiryDate: '2028-10-28',
      manufacturingDate: '2026-10-28',
      supplierBatchNumber: 'SUP-VC-001',
      warehouse: 'Head Office',
    }, adminUser);

    assert.equal(created.Batches.length, 1);
    const firstBatch = created.Batches[0];
    const adminUserCode = `USER${String(adminUser.id).padStart(2, '0')}`;
    const expectedPattern = new RegExp(`^MQ-${created.id}-\\d{8}-\\d{6}-${adminUserCode}(?:-[A-Z0-9]{2,8})?$`);
    assert.match(firstBatch.batchNumber, expectedPattern);
    assert.equal(Number(firstBatch.quantity), 10);
    assert.equal(Number(firstBatch.quantityReceived), 10);
    assert.equal(firstBatch.status, 'active');
    assert.equal(Number(firstBatch.createdByUserId), Number(adminUser.id));
    assert.equal(firstBatch.createdByUsername, adminUser.username);
    assert.equal(firstBatch.supplier, 'MedSupply Ltd');
    assert.equal(firstBatch.supplierBatchNumber, 'SUP-VC-001');
    assert.equal(firstBatch.manufacturingDate, '2026-10-28');

    // Add a second batch via addBatchToMedicine with managerUser
    const afterSecondAdd = await inventoryService.addBatchToMedicine(created.id, {
      quantity: 15,
      costPrice: 5.0,
      sellingPrice: 9.0,
      expiryDate: '2029-01-15',
      supplier: 'PharmaDirect',
      supplierBatchNumber: 'SUP-VC-002',
      warehouse: 'Warehouse A',
    }, managerUser);

    assert.equal(afterSecondAdd.Batches.length, 2);
    assert.equal(Number(afterSecondAdd.totalQuantity), 25);

    const unchangedFirst = afterSecondAdd.Batches.find((b) => b.id === firstBatch.id);
    const secondBatch = afterSecondAdd.Batches.find((b) => b.id !== firstBatch.id);
    assert.equal(unchangedFirst.batchNumber, firstBatch.batchNumber);
    assert.equal(Number(unchangedFirst.quantity), 10);
    assert.equal(Number(unchangedFirst.costPrice), 4.4);

    const managerUserCode = `USER${String(managerUser.id).padStart(2, '0')}`;
    assert.match(secondBatch.batchNumber, new RegExp(`^MQ-${created.id}-\\d{8}-\\d{6}-${managerUserCode}(?:-[A-Z0-9]{2,8})?$`));
    assert.notEqual(secondBatch.batchNumber, firstBatch.batchNumber);
    assert.equal(Number(secondBatch.quantityReceived), 15);
    assert.equal(secondBatch.createdByUsername, managerUser.username);

    // Increase totalQuantity via update() — must create a 3rd new batch and leave batches 1 & 2 untouched
    const afterQtyIncrease = await inventoryService.update(created.id, {
      totalQuantity: 32,
      costPrice: 5.25,
      sellingPrice: 9.5,
      supplier: 'Restock Partner',
      expiryDate: '2029-06-30',
    }, adminUser);

    assert.equal(afterQtyIncrease.Batches.length, 3);
    assert.equal(Number(afterQtyIncrease.totalQuantity), 32);

    const batch1After = afterQtyIncrease.Batches.find((b) => b.id === firstBatch.id);
    const batch2After = afterQtyIncrease.Batches.find((b) => b.id === secondBatch.id);
    const batch3 = afterQtyIncrease.Batches.find((b) => b.id !== firstBatch.id && b.id !== secondBatch.id);

    assert.equal(Number(batch1After.quantity), 10);
    assert.equal(Number(batch1After.costPrice), 4.4);
    assert.equal(Number(batch2After.quantity), 15);
    assert.equal(Number(batch2After.costPrice), 5.0);

    assert.ok(batch3);
    assert.equal(Number(batch3.quantity), 7);
    assert.equal(Number(batch3.quantityReceived), 7);
    assert.equal(Number(batch3.costPrice), 5.25);
    assert.equal(batch3.createdByUsername, adminUser.username);
    assert.match(batch3.batchNumber, expectedPattern);
    assert.equal(new Set(afterQtyIncrease.Batches.map((b) => b.batchNumber)).size, 3);
  });

  test('5, 6, 8: Soft deletion preserves history, blocks batches used in completed sales, supports archive/reversal, and keeps totals consistent', async () => {
    const product = await inventoryService.add({
      name: 'Amoxicillin Safeguard',
      genericName: 'Amoxicillin',
      strength: '250mg',
      mainCategoryId,
      supplier: 'SafePharma',
      quantity: 12,
      costPrice: 3.0,
      sellingPrice: 6.0,
      expiryDate: '2028-05-01',
    }, adminUser);

    const withSecond = await inventoryService.addBatchToMedicine(product.id, {
      quantity: 8,
      costPrice: 3.5,
      sellingPrice: 6.5,
      expiryDate: '2028-12-01',
    }, managerUser);

    const firstBatch = withSecond.Batches.find((b) => Number(b.quantity) === 12);
    const secondBatch = withSecond.Batches.find((b) => Number(b.quantity) === 8);
    assert.equal(Number(withSecond.totalQuantity), 20);

    // Complete a sale of 12 units (depletes firstBatch via FEFO)
    const saleRows = await salesService.create({
      items: [{
        medicineId: product.id,
        name: product.name,
        quantity: 12,
        totalPrice: 72,
        paymentMethod: 'Cash',
        receiptNumber: 'RCPT-BATCH-SAFE-01',
        clientTransactionId: 'txn-batch-safe-001',
      }],
    }, adminUser);
    assert.equal(saleRows.length, 1);

    const firstBatchAfterSale = await Batch.findByPk(firstBatch.id);
    assert.equal(Number(firstBatchAfterSale.quantity), 0);
    assert.equal(firstBatchAfterSale.status, 'depleted');

    const medAfterSale = await Medicine.findByPk(product.id);
    assert.equal(Number(medAfterSale.totalQuantity), 8);

    // Attempting to delete firstBatch MUST be blocked with 409 Conflict because it was used in a completed sale
    await assert.rejects(
      () => inventoryService.removeBatch(product.id, firstBatch.id, { reason: 'Attempt to delete sold batch' }, adminUser),
      (error) => error.getStatus?.() === 409 && /completed sales/i.test(error.message)
    );

    // Unused secondBatch CAN be soft-deleted with audit trail
    const afterDeleteUnused = await inventoryService.removeBatch(
      product.id,
      secondBatch.id,
      { reason: 'Damaged carton in storage' },
      managerUser
    );
    assert.equal(afterDeleteUnused.Batches.some((b) => b.id === secondBatch.id), false);
    assert.equal(Number(afterDeleteUnused.totalQuantity), 0);

    // Soft-deleted batch still exists in DB and batchHistory with full audit metadata
    const deletedRow = await Batch.findByPk(secondBatch.id);
    assert.ok(deletedRow);
    assert.equal(deletedRow.status, 'deleted');
    assert.equal(Number(deletedRow.quantity), 0);
    assert.equal(Number(deletedRow.quantityReceived), 8);
    assert.equal(Number(deletedRow.deletedByUserId), Number(managerUser.id));
    assert.equal(deletedRow.deletedByUsername, managerUser.username);
    assert.equal(deletedRow.deletionReason, 'Damaged carton in storage');
    assert.ok(deletedRow.deletedAt);

    // Sales must NOT be able to sell from the soft-deleted batch
    await assert.rejects(
      () => salesService.create({
        items: [{
          medicineId: product.id,
          name: product.name,
          quantity: 1,
          totalPrice: 6,
          paymentMethod: 'Cash',
          clientTransactionId: 'txn-batch-safe-002',
        }],
      }, adminUser),
      (error) => error.getStatus?.() === 409 || error.getStatus?.() === 400
    );

    // Depleted batch with completed sales CAN be archived safely
    const afterArchive = await inventoryService.archiveBatch(
      product.id,
      firstBatch.id,
      { reason: 'Depleted batch archived after audit' },
      adminUser
    );
    assert.equal(afterArchive.Batches.length, 0);
    assert.equal(Number(afterArchive.totalQuantity), 0);

    const archivedRow = await Batch.findByPk(firstBatch.id);
    assert.equal(archivedRow.status, 'archived');
    assert.equal(archivedRow.deletedByUsername, adminUser.username);

    // Batch history endpoint returns ALL batches (active, depleted, archived, deleted) + movements
    const history = await inventoryService.batchHistory(product.id);
    assert.equal(history.batches.length, 2);
    assert.ok(history.batches.some((b) => b.id === firstBatch.id && b.status === 'archived'));
    assert.ok(history.batches.some((b) => b.id === secondBatch.id && b.status === 'deleted'));
    assert.ok(history.movements.some((m) => m.referenceType === 'BATCH_DELETE'));
    assert.ok(history.movements.some((m) => m.referenceType === 'BATCH_ARCHIVE'));

    // Reversing the completed sale restores firstBatch stock & reactivates it, then allows deletion cleanly
    const reversal = await salesService.reverseSale(
      saleRows[0].id,
      'Customer returned unopened pack',
      adminUser
    );
    assert.equal(reversal.saleStatus, 'REVERSED');

    const restoredFirst = await Batch.findByPk(firstBatch.id);
    assert.equal(Number(restoredFirst.quantity), 12);
    assert.equal(restoredFirst.status, 'active');

    const medAfterReversal = await Medicine.findByPk(product.id);
    assert.equal(Number(medAfterReversal.totalQuantity), 12);

    // Now that the sale is reversed, soft deletion succeeds without losing the sales record
    const afterPostReversalDelete = await inventoryService.removeBatch(
      product.id,
      firstBatch.id,
      { reason: 'Quarantined returned stock' },
      adminUser
    );
    assert.equal(Number(afterPostReversalDelete.totalQuantity), 0);
    const preservedSale = await Sales.findByPk(saleRows[0].id);
    assert.ok(preservedSale);
    assert.equal(preservedSale.saleStatus, 'REVERSED');
  });

  test('7: Concurrent multi-user stock additions generate unique batch numbers without collisions', async () => {
    const product = await inventoryService.add({
      name: 'Paracetamol Concurrency Test',
      genericName: 'Paracetamol',
      strength: '500mg',
      mainCategoryId,
      quantity: 5,
      costPrice: 1.5,
      sellingPrice: 3.0,
      expiryDate: '2029-03-01',
    }, adminUser);

    // Trigger 6 concurrent stock additions across both users in the exact same second
    const operations = [
      inventoryService.addBatchToMedicine(product.id, { quantity: 4, costPrice: 1.5, sellingPrice: 3.0 }, adminUser),
      inventoryService.addBatchToMedicine(product.id, { quantity: 6, costPrice: 1.6, sellingPrice: 3.1 }, managerUser),
      inventoryService.addBatchToMedicine(product.id, { quantity: 3, costPrice: 1.5, sellingPrice: 3.0 }, adminUser),
      inventoryService.addBatchToMedicine(product.id, { quantity: 7, costPrice: 1.7, sellingPrice: 3.2 }, managerUser),
      inventoryService.addBatchToMedicine(product.id, { quantity: 2, costPrice: 1.5, sellingPrice: 3.0 }, adminUser),
      inventoryService.addBatchToMedicine(product.id, { quantity: 8, costPrice: 1.8, sellingPrice: 3.3 }, managerUser),
    ];

    const settled = await Promise.all(operations);
    assert.equal(settled.length, 6);

    const allBatches = await Batch.findAll({ where: { medicineId: product.id } });
    assert.equal(allBatches.length, 7);

    const uniqueNumbers = new Set(allBatches.map((b) => b.batchNumber));
    assert.equal(uniqueNumbers.size, 7, 'Every concurrent stock addition must get a unique batch number');

    const refreshedMedicine = await Medicine.findByPk(product.id);
    const expectedTotal = 5 + 4 + 6 + 3 + 7 + 2 + 8;
    const batchSum = allBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
    assert.equal(batchSum, expectedTotal);
    assert.equal(Number(refreshedMedicine.totalQuantity), expectedTotal);
  });

  test('Controller enforces INVENTORY_WRITE on batch delete/archive and user deletion preserves batch username audit', async () => {
    const deletePermissions = Reflect.getMetadata(PERMISSIONS_KEY, InventoryController.prototype.removeBatch);
    const archivePermissions = Reflect.getMetadata(PERMISSIONS_KEY, InventoryController.prototype.archiveBatch);
    const historyPermissions = Reflect.getMetadata(PERMISSIONS_KEY, InventoryController.prototype.batchHistory);

    assert.deepEqual(deletePermissions, [Permissions.INVENTORY_WRITE]);
    assert.deepEqual(archivePermissions, [Permissions.INVENTORY_WRITE]);
    assert.deepEqual(historyPermissions, [Permissions.INVENTORY_READ]);

    // Deleting a user who created a batch must preserve createdByUsername while clearing createdByUserId
    const tempManager = await User.create({
      username: 'temp-batch-creator',
      email: 'temp-batch-creator@example.test',
      password: hashPassword('TempCreatorPass123!'),
      role: 'manager',
      status: 'active',
    });

    const prod = await inventoryService.add({
      name: 'Audit Retention Syrup',
      genericName: 'Cetirizine',
      strength: '5mg/5ml',
      mainCategoryId,
      quantity: 4,
      costPrice: 10,
      sellingPrice: 18,
      expiryDate: '2029-04-01',
    }, tempManager);

    const batchId = prod.Batches[0].id;
    await authService.deleteUser(tempManager.id, adminUser);

    const preservedBatch = await Batch.findByPk(batchId);
    assert.equal(preservedBatch.createdByUserId, null);
    assert.equal(preservedBatch.createdByUsername, 'temp-batch-creator');

    const movements = await InventoryMovement.findAll({ where: { batchId } });
    assert.ok(movements.length >= 1);
  });

  test('Migration 021 is idempotent and backfills legacy batches without data loss', async () => {
    const { DataTypes } = require('sequelize');
    const migration021 = require('../migrations/021-batch-lifecycle-and-traceability');
    const queryInterface = sequelize.getQueryInterface();

    const prod = await inventoryService.add({
      name: 'Legacy Backfill Check',
      genericName: 'Vitamin D3',
      strength: '1000IU',
      mainCategoryId,
      quantity: 9,
      costPrice: 2,
      sellingPrice: 5,
      expiryDate: '2029-09-01',
    }, adminUser);

    const batchId = prod.Batches[0].id;
    // Simulate a legacy row missing quantityReceived before migration backfill
    await sequelize.query(
      'UPDATE "Batches" SET "quantityReceived" = NULL WHERE "id" = :batchId',
      { replacements: { batchId } }
    );

    // Running migration 021 again must be idempotent and backfill quantityReceived
    await migration021.up({ queryInterface, sequelize, DataTypes });
    await migration021.up({ queryInterface, sequelize, DataTypes });

    const backfilled = await Batch.findByPk(batchId);
    assert.equal(Number(backfilled.quantityReceived), 9);
    assert.equal(backfilled.status, 'active');
  });
});
