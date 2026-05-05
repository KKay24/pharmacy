async function ensureColumns(queryInterface, tableName, columns) {
  const existingColumns = await queryInterface.describeTable(tableName);

  for (const [columnName, definition] of Object.entries(columns)) {
    if (!existingColumns[columnName]) {
      console.log(`Adding column ${columnName} to ${tableName}...`);
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  }
}

module.exports = {
  version: '003',
  description: 'Sync Prescriptions and Sales schema evolution',
  async up({ queryInterface, DataTypes }) {
    // 1. Sync Prescriptions
    await ensureColumns(queryInterface, 'Prescriptions', {
      customerId: { type: DataTypes.INTEGER, allowNull: true },
      prescriber: { type: DataTypes.STRING, allowNull: true },
      doctorName: { type: DataTypes.STRING, allowNull: true },
      doctorLicense: { type: DataTypes.STRING, allowNull: true },
      insurance: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Self-Pay' },
      medications: { type: DataTypes.TEXT, allowNull: true },
      imagePath: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true },
    });

    // 2. Sync Sales
    await ensureColumns(queryInterface, 'Sales', {
      medicineId: { type: DataTypes.INTEGER, allowNull: true },
      customerId: { type: DataTypes.INTEGER, allowNull: true },
      taxAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      discount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      totalCost: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    });
  },
};
