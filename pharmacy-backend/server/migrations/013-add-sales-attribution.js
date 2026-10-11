async function columnExists(queryInterface, tableName, columnName) {
  const tableDefinition = await queryInterface.describeTable(tableName);
  return Boolean(tableDefinition[columnName]);
}

module.exports = {
  version: '013',
  description: 'Record the staff username for each sale',
  async up({ queryInterface, DataTypes }) {
    if (!(await columnExists(queryInterface, 'Sales', 'soldBy'))) {
      await queryInterface.addColumn('Sales', 'soldBy', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  },
};
