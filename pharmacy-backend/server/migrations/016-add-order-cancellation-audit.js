async function addColumnIfMissing(queryInterface, DataTypes, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

module.exports = {
  version: '016',
  description: 'Record staff cancellation reasons and audit details for online orders',
  async up({ queryInterface, DataTypes }) {
    await addColumnIfMissing(queryInterface, DataTypes, 'Orders', 'cancellationReason', {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, DataTypes, 'Orders', 'cancelledByUserId', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, DataTypes, 'Orders', 'cancelledAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },
};
