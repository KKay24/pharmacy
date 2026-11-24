async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  if (await columnExists(queryInterface, tableName, columnName)) return;
  await queryInterface.addColumn(tableName, columnName, definition);
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((index) => index.name === options.name)) return;
  await queryInterface.addIndex(tableName, fields, options);
}

module.exports = {
  version: '021',
  description: 'Add batch lifecycle status, soft-deletion audit metadata, and creation traceability',
  async up({ queryInterface, sequelize, DataTypes }) {
    await addColumnIfMissing(queryInterface, 'Batches', 'quantityReceived', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'status', {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'active',
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'supplier', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'manufacturingDate', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'supplierBatchNumber', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'createdByUserId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'createdByUsername', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'deletedAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'deletedByUserId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'deletedByUsername', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Batches', 'deletionReason', {
      type: DataTypes.TEXT,
      allowNull: true,
    });

    // Idempotent backfill for existing batches (preserves all existing quantities & history)
    await sequelize.query(
      'UPDATE "Batches" SET "quantityReceived" = "quantity" WHERE "quantityReceived" IS NULL'
    );
    await sequelize.query(
      'UPDATE "Batches" SET "status" = \'depleted\' WHERE ("status" IS NULL OR "status" = \'active\') AND COALESCE("quantity", 0) <= 0'
    );
    await sequelize.query(
      'UPDATE "Batches" SET "status" = \'active\' WHERE "status" IS NULL AND COALESCE("quantity", 0) > 0'
    );

    await addIndexIfMissing(queryInterface, 'Batches', ['medicineId', 'status'], {
      name: 'batches_medicine_status_idx',
    });
  },
};
