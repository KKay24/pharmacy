const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-taxonomy-migration-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'migration.sqlite');

const { DataTypes } = require('sequelize');
const { Batch, InventoryCategory, Medicine, sequelize } = require('../models');
const previousMigrations = [
  require('../migrations/001-initial-schema'),
  require('../migrations/002-sync-customer-schema'),
  require('../migrations/003-sync-prescription-sales'),
  require('../migrations/004-update-medicine-image-type'),
  require('../migrations/005-fix-image-column'),
  require('../migrations/006-add-password-bootstrap-flag'),
  require('../migrations/007-add-audit-logs'),
  require('../migrations/008-add-query-performance-indexes'),
  require('../migrations/009-harden-inventory-persistence'),
  require('../migrations/010-add-idempotency-and-sync'),
];
const taxonomyMigration = require('../migrations/011-add-product-taxonomy');

test('taxonomy migration maps recognized legacy records and preserves unclassified products and batches', async () => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    await sequelize.authenticate();
    for (const migration of previousMigrations) {
      await migration.up({ queryInterface, sequelize, DataTypes });
    }

    const recognizedProduct = await Medicine.create({
      name: 'Legacy Amoxicillin',
      genericName: 'Amoxicillin',
      category: 'Antibiotics',
      dosage: 'Syrup',
      strength: '125 mg/5 mL',
      totalQuantity: 9,
    });
    const unclassifiedProduct = await Medicine.create({
      name: 'Legacy Tablet Label',
      category: 'Tablets',
      dosage: '500 mg',
      totalQuantity: 5,
    });
    const preservedBatch = await Batch.create({
      medicineId: unclassifiedProduct.id,
      batchNumber: 'LEGACY-KEEP-001',
      quantity: 5,
      expiryDate: '2028-12-31',
      costPrice: 2,
      sellingPrice: 4,
    });

    await taxonomyMigration.up({ queryInterface, sequelize, DataTypes });

    const mapped = await Medicine.findByPk(recognizedProduct.id);
    const retained = await Medicine.findByPk(unclassifiedProduct.id);
    const retainedBatch = await Batch.findByPk(preservedBatch.id);
    const categories = await InventoryCategory.findAll();
    const antibiotics = categories.find((category) => category.path === 'medicines/antibiotics');
    const syrup = categories.find((category) => category.path === 'medicines/antibiotics/syrup');

    assert.equal(mapped.category, 'Antibiotics');
    assert.equal(mapped.dosage, 'Syrup');
    assert.equal(Number(mapped.mainCategoryId), Number(categories.find((category) => category.path === 'medicines').id));
    assert.equal(Number(mapped.subcategoryId), Number(antibiotics.id));
    assert.equal(Number(mapped.productFormId), Number(syrup.id));
    assert.equal(retained.category, 'Tablets');
    assert.equal(retained.dosage, '500 mg');
    assert.equal(retained.mainCategoryId, null);
    assert.equal(retainedBatch.batchNumber, 'LEGACY-KEEP-001');
    assert.equal(retainedBatch.quantity, 5);
  } finally {
    await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
