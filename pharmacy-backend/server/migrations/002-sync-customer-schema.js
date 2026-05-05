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
  version: '002',
  description: 'Sync Schema evolution for multiple tables (Customers, Prescriptions, Sales)',
  async up({ queryInterface, DataTypes }) {
    // 1. Sync Customers
    await ensureColumns(queryInterface, 'Customers', {
      phone: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      address: { type: DataTypes.STRING, allowNull: true },
      loyaltyPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalPurchases: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      allergies: { type: DataTypes.TEXT, allowNull: true },
      chronicConditions: { type: DataTypes.TEXT, allowNull: true },
      insuranceProvider: { type: DataTypes.STRING, allowNull: true },
      insuranceNumber: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    });

    // 2. Sync Prescriptions
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

    // 3. Sync Sales
    await ensureColumns(queryInterface, 'Sales', {
      medicineId: { type: DataTypes.INTEGER, allowNull: true },
      customerId: { type: DataTypes.INTEGER, allowNull: true },
      taxAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      discount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      totalCost: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    });

    // 4. Sync Medicines
    await ensureColumns(queryInterface, 'Medicines', {
        totalQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        lowStockThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    });
  },
};
