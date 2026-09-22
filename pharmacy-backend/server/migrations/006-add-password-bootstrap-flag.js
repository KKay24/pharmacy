async function ensureColumns(queryInterface, tableName, columns) {
  const existingColumns = await queryInterface.describeTable(tableName);

  for (const [columnName, definition] of Object.entries(columns)) {
    if (!existingColumns[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  }
}

module.exports = {
  version: '006',
  description: 'Add password bootstrap change flag',
  async up({ queryInterface, DataTypes }) {
    await ensureColumns(queryInterface, 'Users', {
      mustChangePassword: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });
  },
};