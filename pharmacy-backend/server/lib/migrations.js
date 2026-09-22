const { DataTypes, QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const migrationDefinitions = [
  require('../migrations/001-initial-schema'),
  require('../migrations/002-sync-customer-schema'),
  require('../migrations/003-sync-prescription-sales'),
  require('../migrations/006-add-password-bootstrap-flag'),
];

function normalizeTableName(table) {
  if (typeof table === 'string') {
    return table;
  }

  if (table && typeof table === 'object') {
    return table.tableName || table.name;
  }

  return '';
}

async function ensureMigrationsTable(queryInterface) {
  const tables = await queryInterface.showAllTables();
  const hasTable = tables
    .map(normalizeTableName)
    .some((table) => table.toLowerCase() === 'schemamigrations');

  if (!hasTable) {
    await queryInterface.createTable('SchemaMigrations', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      version: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      executedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }
}

async function runMigrations() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureMigrationsTable(queryInterface);

  const appliedRows = await sequelize.query(
    'SELECT version FROM "SchemaMigrations"',
    { type: QueryTypes.SELECT }
  );
  const appliedVersions = new Set(appliedRows.map((row) => row.version));

  for (const migration of migrationDefinitions) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    await migration.up({ queryInterface, sequelize, DataTypes });
    await queryInterface.bulkInsert('SchemaMigrations', [
      {
        version: migration.version,
        description: migration.description,
        executedAt: new Date(),
      },
    ]);
  }
}

module.exports = {
  runMigrations,
};
