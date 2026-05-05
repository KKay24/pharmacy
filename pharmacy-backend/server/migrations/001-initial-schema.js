async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const normalized = typeof table === 'string'
      ? table
      : table.tableName || table.name;
    return normalized.toLowerCase() === tableName.toLowerCase();
  });
}

async function ensureColumns(queryInterface, tableName, columns) {
  const existingColumns = await queryInterface.describeTable(tableName);

  for (const [columnName, definition] of Object.entries(columns)) {
    if (!existingColumns[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  }
}

module.exports = {
  version: '001',
  description: 'Create core pharmacy schema',
  async up({ queryInterface, DataTypes }) {
    const timestampColumns = {
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    };

    if (!(await tableExists(queryInterface, 'Users'))) {
      await queryInterface.createTable('Users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        role: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'user',
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        lastLogin: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        locations: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'active',
        },
        ...timestampColumns,
      });
    } else {
      await ensureColumns(queryInterface, 'Users', {
        email: { type: DataTypes.STRING, allowNull: true },
        lastLogin: { type: DataTypes.DATE, allowNull: true },
        locations: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
      });
    }

    if (!(await tableExists(queryInterface, 'Suppliers'))) {
      await queryInterface.createTable('Suppliers', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        contactPerson: { type: DataTypes.STRING },
        email: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        taxId: { type: DataTypes.STRING, allowNull: true },
        paymentTerms: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Immediate' },
        balanceOwed: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
        ...timestampColumns,
      });
    } else {
      await ensureColumns(queryInterface, 'Suppliers', {
        email: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        taxId: { type: DataTypes.STRING, allowNull: true },
        paymentTerms: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Immediate' },
        balanceOwed: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
      });
    }

    if (!(await tableExists(queryInterface, 'Medicines'))) {
      await queryInterface.createTable('Medicines', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: { type: DataTypes.STRING, allowNull: false },
        genericName: { type: DataTypes.STRING, allowNull: true },
        category: { type: DataTypes.STRING, allowNull: true },
        strength: { type: DataTypes.STRING, allowNull: true },
        dosage: { type: DataTypes.STRING, allowNull: true },
        supplier: { type: DataTypes.STRING, allowNull: true },
        manufacturer: { type: DataTypes.STRING, allowNull: true },
        prescriptionRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        barcode: { type: DataTypes.STRING, allowNull: true },
        lowStockThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
        imageUrl: { type: DataTypes.STRING, allowNull: true },
        totalQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestampColumns,
      });
    } else {
      await ensureColumns(queryInterface, 'Medicines', {
        genericName: { type: DataTypes.STRING, allowNull: true },
        category: { type: DataTypes.STRING, allowNull: true },
        strength: { type: DataTypes.STRING, allowNull: true },
        dosage: { type: DataTypes.STRING, allowNull: true },
        supplier: { type: DataTypes.STRING, allowNull: true },
        manufacturer: { type: DataTypes.STRING, allowNull: true },
        prescriptionRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        barcode: { type: DataTypes.STRING, allowNull: true },
        lowStockThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
        imageUrl: { type: DataTypes.STRING, allowNull: true },
        totalQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      });
    }

    if (!(await tableExists(queryInterface, 'Batches'))) {
      await queryInterface.createTable('Batches', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        medicineId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'Medicines', key: 'id' },
          onDelete: 'CASCADE',
        },
        supplierId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Suppliers', key: 'id' },
          onDelete: 'SET NULL',
        },
        batchNumber: { type: DataTypes.STRING, allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        expiryDate: { type: DataTypes.DATEONLY, allowNull: false },
        costPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        sellingPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        warehouse: { type: DataTypes.STRING, allowNull: true },
        invoiceNumber: { type: DataTypes.STRING, allowNull: true },
        receivedDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        ...timestampColumns,
      });
    } else {
      await ensureColumns(queryInterface, 'Batches', {
        supplierId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Suppliers', key: 'id' },
          onDelete: 'SET NULL',
        },
        warehouse: { type: DataTypes.STRING, allowNull: true },
        invoiceNumber: { type: DataTypes.STRING, allowNull: true },
        receivedDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }

    if (!(await tableExists(queryInterface, 'Customers'))) {
      await queryInterface.createTable('Customers', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: { type: DataTypes.STRING, allowNull: false },
        phone: { type: DataTypes.STRING, allowNull: true, unique: true },
        email: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.STRING, allowNull: true },
        loyaltyPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        totalPurchases: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        allergies: { type: DataTypes.TEXT, allowNull: true },
        chronicConditions: { type: DataTypes.TEXT, allowNull: true },
        insuranceProvider: { type: DataTypes.STRING, allowNull: true },
        insuranceNumber: { type: DataTypes.STRING, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        ...timestampColumns,
      });
    } else {
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
    }

    if (!(await tableExists(queryInterface, 'Prescriptions'))) {
      await queryInterface.createTable('Prescriptions', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        customerId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Customers', key: 'id' },
          onDelete: 'SET NULL',
        },
        patientName: { type: DataTypes.STRING, allowNull: false },
        doctorName: { type: DataTypes.STRING, allowNull: true },
        prescriber: { type: DataTypes.STRING, allowNull: true },
        doctorLicense: { type: DataTypes.STRING, allowNull: true },
        insurance: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Self-Pay' },
        medications: { type: DataTypes.TEXT, allowNull: true },
        imagePath: { type: DataTypes.STRING, allowNull: true },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
        dueDate: { type: DataTypes.DATEONLY, allowNull: true },
        date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        ...timestampColumns,
      });
    }

    if (!(await tableExists(queryInterface, 'Expenses'))) {
      await queryInterface.createTable('Expenses', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        category: { type: DataTypes.STRING, allowNull: false },
        amount: { type: DataTypes.FLOAT, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: true },
        date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        ...timestampColumns,
      });
    }

    if (!(await tableExists(queryInterface, 'Sales'))) {
      await queryInterface.createTable('Sales', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        batchId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Batches', key: 'id' },
          onDelete: 'SET NULL',
        },
        medicineId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Medicines', key: 'id' },
          onDelete: 'SET NULL',
        },
        customerId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Customers', key: 'id' },
          onDelete: 'SET NULL',
        },
        name: { type: DataTypes.STRING, allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        pricePerUnit: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        totalPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        totalCost: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        taxAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        discount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        paymentMethod: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Cash' },
        receiptNumber: { type: DataTypes.STRING, allowNull: true },
        date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        ...timestampColumns,
      });
    } else {
      await ensureColumns(queryInterface, 'Sales', {
        medicineId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Medicines', key: 'id' },
          onDelete: 'SET NULL',
        },
      });
    }
  },
};
