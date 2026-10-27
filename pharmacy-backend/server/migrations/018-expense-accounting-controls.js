async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

module.exports = {
  version: '018',
  description: 'Add auditable expense posting, correction, and void controls',
  async up({ queryInterface, DataTypes }) {
    await addColumnIfMissing(queryInterface, 'Expenses', 'createdByUserId', { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' });
    await addColumnIfMissing(queryInterface, 'Expenses', 'voidedAt', { type: DataTypes.DATE, allowNull: true });
    await addColumnIfMissing(queryInterface, 'Expenses', 'voidedByUserId', { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' });
    await addColumnIfMissing(queryInterface, 'Expenses', 'voidReason', { type: DataTypes.TEXT, allowNull: true });
    await addColumnIfMissing(queryInterface, 'Expenses', 'correctedAt', { type: DataTypes.DATE, allowNull: true });
    await addColumnIfMissing(queryInterface, 'Expenses', 'correctedByUserId', { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' });
    await addColumnIfMissing(queryInterface, 'Expenses', 'correctionReason', { type: DataTypes.TEXT, allowNull: true });
  },
};
