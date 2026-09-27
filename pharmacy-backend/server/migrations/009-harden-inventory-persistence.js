const { QueryTypes } = require('sequelize');
const { buildProductKey } = require('../src/inventory/product-identity');

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : table.tableName || table.name;
    return name.toLowerCase() === tableName.toLowerCase();
  });
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((index) => index.name === options.name)) return;
  await queryInterface.addIndex(tableName, fields, options);
}

async function assertNoDuplicateBatchKeys(sequelize) {
  const duplicateBatchKeys = await sequelize.query(
    'SELECT "medicineId", "batchNumber", COUNT(*) AS "count" FROM "Batches" GROUP BY "medicineId", "batchNumber" HAVING COUNT(*) > 1',
    { type: QueryTypes.SELECT }
  );

  if (duplicateBatchKeys.length > 0) {
    throw new Error(
      'Cannot safely add the Batches (medicineId, batchNumber) unique index because duplicate batch keys exist. ' +
      'Run `npm run audit:inventory-duplicates` and merge those batches manually before rerunning migrations.'
    );
  }
}

async function backfillUnambiguousProductKeys(queryInterface, sequelize) {
  const medicines = await sequelize.query(
    'SELECT "id", "name", "genericName", "strength", "dosage", "manufacturer" FROM "Medicines"',
    { type: QueryTypes.SELECT }
  );
  const groups = new Map();

  for (const medicine of medicines) {
    const productKey = buildProductKey(medicine);
    if (!productKey) continue;
    const group = groups.get(productKey) || [];
    group.push(medicine);
    groups.set(productKey, group);
  }

  let ambiguousGroupCount = 0;
  for (const [productKey, group] of groups.entries()) {
    // Leaving ambiguous legacy records NULL is deliberate: it preserves all
    // quantities, batches, sales, and foreign keys while blocking new duplicates.
    if (group.length !== 1) {
      ambiguousGroupCount += 1;
      continue;
    }

    await queryInterface.bulkUpdate('Medicines', { productKey }, { id: group[0].id });
  }

  if (ambiguousGroupCount > 0) {
    console.warn(
      `Inventory migration found ${ambiguousGroupCount} ambiguous legacy medicine identity group(s); ` +
      'their productKey values were intentionally left NULL for manual review.'
    );
  }
}

module.exports = {
  version: '009',
  description: 'Harden product identity, batch uniqueness, indexes, and inventory movement history',
  async up({ queryInterface, sequelize, DataTypes }) {
    // Preflight before any schema work that depends on batch-key uniqueness.
    await assertNoDuplicateBatchKeys(sequelize);

    const medicineColumns = await queryInterface.describeTable('Medicines');
    if (!medicineColumns.productKey) {
      await queryInterface.addColumn('Medicines', 'productKey', {
        type: DataTypes.STRING(64),
        allowNull: true,
      });
    }

    await backfillUnambiguousProductKeys(queryInterface, sequelize);

    await addIndexIfMissing(queryInterface, 'Medicines', ['productKey'], {
      name: 'medicines_product_key_unique',
      unique: true,
    });
    await addIndexIfMissing(queryInterface, 'Medicines', ['name'], {
      name: 'medicines_name_idx',
    });
    await addIndexIfMissing(queryInterface, 'Medicines', ['genericName'], {
      name: 'medicines_generic_name_idx',
    });
    await addIndexIfMissing(queryInterface, 'Medicines', ['createdAt'], {
      name: 'medicines_created_at_idx',
    });
    await addIndexIfMissing(queryInterface, 'Batches', ['medicineId', 'batchNumber'], {
      name: 'batches_medicine_batch_number_unique',
      unique: true,
    });
    await addIndexIfMissing(queryInterface, 'Batches', ['batchNumber'], {
      name: 'batches_batch_number_idx',
    });

    if (!(await tableExists(queryInterface, 'InventoryMovements'))) {
      await queryInterface.createTable('InventoryMovements', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        medicineId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Medicines', key: 'id' },
          onDelete: 'SET NULL',
        },
        batchId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Batches', key: 'id' },
          onDelete: 'SET NULL',
        },
        movementType: { type: DataTypes.STRING, allowNull: false },
        quantityChange: { type: DataTypes.INTEGER, allowNull: false },
        referenceType: { type: DataTypes.STRING, allowNull: true },
        referenceId: { type: DataTypes.INTEGER, allowNull: true },
        reason: { type: DataTypes.TEXT, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }

    await addIndexIfMissing(queryInterface, 'InventoryMovements', ['medicineId', 'createdAt'], {
      name: 'inventory_movements_medicine_created_at_idx',
    });
    await addIndexIfMissing(queryInterface, 'InventoryMovements', ['batchId', 'createdAt'], {
      name: 'inventory_movements_batch_created_at_idx',
    });
    await addIndexIfMissing(queryInterface, 'InventoryMovements', ['movementType', 'createdAt'], {
      name: 'inventory_movements_type_created_at_idx',
    });
  },
};
