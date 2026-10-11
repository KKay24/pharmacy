async function columnExists(queryInterface, tableName, columnName) {
  const tableDefinition = await queryInterface.describeTable(tableName);
  return Boolean(tableDefinition[columnName]);
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  if (!(await columnExists(queryInterface, tableName, columnName))) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

module.exports = {
  version: '014',
  description: 'Add cashier user IDs and auditable sale reversal fields',
  async up({ queryInterface, DataTypes }) {
    await addColumnIfMissing(queryInterface, 'Sales', 'soldByUserId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'Sales', 'saleStatus', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'COMPLETED',
    });
    await addColumnIfMissing(queryInterface, 'Sales', 'reversedAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Sales', 'reversedByUserId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'Sales', 'reversalReason', {
      type: DataTypes.TEXT,
      allowNull: true,
    });

    const indexes = await queryInterface.showIndex('Sales');
    if (!indexes.some((index) => index.name === 'sales_cashier_user_idx')) {
      await queryInterface.addIndex('Sales', ['soldByUserId'], { name: 'sales_cashier_user_idx' });
    }
  },
};
