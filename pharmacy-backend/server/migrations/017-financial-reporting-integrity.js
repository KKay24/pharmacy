async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => String(typeof table === 'string' ? table : table.tableName || table.name).toLowerCase() === tableName.toLowerCase());
}

async function columnExists(queryInterface, tableName, columnName) {
  return Boolean((await queryInterface.describeTable(tableName))[columnName]);
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  if (!(await columnExists(queryInterface, tableName, columnName))) await queryInterface.addColumn(tableName, columnName, definition);
}

async function addIndexIfMissing(queryInterface, tableName, fields, name) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === name)) await queryInterface.addIndex(tableName, fields, { name });
}

module.exports = {
  version: '017',
  description: 'Add exact financial amounts, refunds, and cash drawer reconciliations',
  async up({ queryInterface, sequelize, DataTypes }) {
    await addColumnIfMissing(queryInterface, 'Sales', 'totalPriceMinor', { type: DataTypes.BIGINT, allowNull: true });
    await addColumnIfMissing(queryInterface, 'Sales', 'totalCostMinor', { type: DataTypes.BIGINT, allowNull: true });
    await addColumnIfMissing(queryInterface, 'Expenses', 'amountMinor', { type: DataTypes.BIGINT, allowNull: true });

    // Existing sales keep their known revenue. A legacy zero cost is deliberately left
    // unknown: treating it as verified zero would overstate gross profit.
    await sequelize.query('UPDATE "Sales" SET "totalPriceMinor" = ROUND("totalPrice" * 100) WHERE "totalPriceMinor" IS NULL AND "totalPrice" IS NOT NULL');
    await sequelize.query('UPDATE "Sales" SET "totalCostMinor" = ROUND("totalCost" * 100) WHERE "totalCostMinor" IS NULL AND "totalCost" IS NOT NULL AND "totalCost" <> 0');
    await sequelize.query('UPDATE "Expenses" SET "amountMinor" = ROUND("amount" * 100) WHERE "amountMinor" IS NULL AND "amount" IS NOT NULL');

    if (!(await tableExists(queryInterface, 'SaleRefunds'))) {
      await queryInterface.createTable('SaleRefunds', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        saleId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Sales', key: 'id' }, onDelete: 'RESTRICT' },
        amountMinor: { type: DataTypes.BIGINT, allowNull: false },
        method: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'CONFIRMED' },
        financialDate: { type: DataTypes.DATE, allowNull: false },
        reason: { type: DataTypes.TEXT, allowNull: false },
        processedByUserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'RESTRICT' },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }
    await addIndexIfMissing(queryInterface, 'SaleRefunds', ['saleId'], 'sale_refunds_sale_id_idx');
    await addIndexIfMissing(queryInterface, 'SaleRefunds', ['financialDate'], 'sale_refunds_financial_date_idx');

    if (!(await tableExists(queryInterface, 'CashDrawerReconciliations'))) {
      await queryInterface.createTable('CashDrawerReconciliations', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        businessDate: { type: DataTypes.STRING(10), allowNull: false, unique: true },
        expectedCashMinor: { type: DataTypes.BIGINT, allowNull: false },
        countedCashMinor: { type: DataTypes.BIGINT, allowNull: false },
        varianceMinor: { type: DataTypes.BIGINT, allowNull: false },
        notes: { type: DataTypes.TEXT, allowNull: true },
        closedByUserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'RESTRICT' },
        closedAt: { type: DataTypes.DATE, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }
    await addIndexIfMissing(queryInterface, 'CashDrawerReconciliations', ['businessDate'], 'cash_drawer_reconciliations_business_date_idx');
  },
};
