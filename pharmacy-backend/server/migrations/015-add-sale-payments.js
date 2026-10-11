async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => (
    (typeof table === 'string' ? table : table.tableName || table.name).toLowerCase() === tableName.toLowerCase()
  ));
}

module.exports = {
  version: '015',
  description: 'Persist confirmed cash and cashier-verified POS payment allocations',
  async up({ queryInterface, DataTypes }) {
    if (!(await tableExists(queryInterface, 'SalePayments'))) {
      await queryInterface.createTable('SalePayments', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        saleId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'Sales', key: 'id' },
          onDelete: 'CASCADE',
        },
        method: { type: DataTypes.STRING, allowNull: false },
        amountMinor: { type: DataTypes.INTEGER, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false },
        transactionReference: { type: DataTypes.STRING, allowNull: true },
        confirmedByUserId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onDelete: 'RESTRICT',
        },
        confirmedAt: { type: DataTypes.DATE, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }

    const indexes = await queryInterface.showIndex('SalePayments');
    if (!indexes.some((index) => index.name === 'sale_payments_sale_id_idx')) {
      await queryInterface.addIndex('SalePayments', ['saleId'], { name: 'sale_payments_sale_id_idx' });
    }
  },
};
