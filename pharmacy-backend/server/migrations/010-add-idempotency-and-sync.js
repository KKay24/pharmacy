async function columnExists(queryInterface, tableName, columnName) {
  try {
    const tableDefinition = await queryInterface.describeTable(tableName);
    return Boolean(tableDefinition[columnName]);
  } catch (error) {
    return false;
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  const name = options.name || `${tableName}_${fields.join('_')}_idx`;
  if (indexes.some((index) => index.name === name)) return;
  await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  version: '010',
  description: 'Add clientTransactionId for offline idempotency and synchronization to Sales and InventoryMovements',
  async up({ queryInterface, DataTypes }) {
    if (!(await columnExists(queryInterface, 'Sales', 'clientTransactionId'))) {
      await queryInterface.addColumn('Sales', 'clientTransactionId', {
        type: DataTypes.STRING(128),
        allowNull: true,
      });
    }

    await addIndexIfMissing(queryInterface, 'Sales', ['clientTransactionId'], {
      name: 'sales_client_transaction_id_unique',
      unique: true,
    });

    if (!(await columnExists(queryInterface, 'InventoryMovements', 'clientTransactionId'))) {
      await queryInterface.addColumn('InventoryMovements', 'clientTransactionId', {
        type: DataTypes.STRING(128),
        allowNull: true,
      });
    }

    await addIndexIfMissing(queryInterface, 'InventoryMovements', ['clientTransactionId'], {
      name: 'inventory_movements_client_transaction_id_idx',
    });
  },
};
