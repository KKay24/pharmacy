async function columnExists(queryInterface, tableName, columnName) {
  const tableDefinition = await queryInterface.describeTable(tableName);
  return Boolean(tableDefinition[columnName]);
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((t) => (typeof t === 'string' ? t : t.tableName || t.name).toLowerCase() === tableName.toLowerCase());
}

async function addIndexIfMissing(queryInterface, tableName, fields, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  const name = options.name || `${tableName}_${fields.join('_')}_idx`;
  if (indexes.some((index) => index.name === name)) return;
  await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  version: '012',
  description: 'Add customer e-commerce fields, Orders table, and SupportInquiries table',
  async up({ queryInterface, DataTypes }) {
    // 1. Medicine e-commerce fields
    if (!(await columnExists(queryInterface, 'Medicines', 'isCustomerVisible'))) {
      await queryInterface.addColumn('Medicines', 'isCustomerVisible', {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Medicines', 'description'))) {
      await queryInterface.addColumn('Medicines', 'description', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Medicines', 'warnings'))) {
      await queryInterface.addColumn('Medicines', 'warnings', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Medicines', 'basePrice'))) {
      await queryInterface.addColumn('Medicines', 'basePrice', {
        type: DataTypes.FLOAT,
        defaultValue: 0.0,
      });
    }

    // 2. Customer userId field
    if (!(await columnExists(queryInterface, 'Customers', 'userId'))) {
      await queryInterface.addColumn('Customers', 'userId', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }

    // 3. Prescription customer fields
    if (!(await columnExists(queryInterface, 'Prescriptions', 'prescriptionNumber'))) {
      await queryInterface.addColumn('Prescriptions', 'prescriptionNumber', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Prescriptions', 'patientPhone'))) {
      await queryInterface.addColumn('Prescriptions', 'patientPhone', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Prescriptions', 'deliveryPreference'))) {
      await queryInterface.addColumn('Prescriptions', 'deliveryPreference', {
        type: DataTypes.STRING,
        defaultValue: 'delivery',
      });
    }
    if (!(await columnExists(queryInterface, 'Prescriptions', 'deliveryAddress'))) {
      await queryInterface.addColumn('Prescriptions', 'deliveryAddress', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Prescriptions', 'notes'))) {
      await queryInterface.addColumn('Prescriptions', 'notes', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }

    // 4. Orders table
    if (!(await tableExists(queryInterface, 'Orders'))) {
      await queryInterface.createTable('Orders', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        orderNumber: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        customerId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        customerName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        customerPhone: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        customerEmail: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        deliveryMethod: {
          type: DataTypes.STRING,
          defaultValue: 'delivery',
        },
        deliveryAddress: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        deliveryProvince: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        deliveryCity: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        deliveryArea: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        deliveryLandmark: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        paymentMethod: {
          type: DataTypes.STRING,
          defaultValue: 'Mobile Money',
        },
        paymentStatus: {
          type: DataTypes.STRING,
          defaultValue: 'Pending',
        },
        orderStatus: {
          type: DataTypes.STRING,
          defaultValue: 'Order Placed',
        },
        subtotal: {
          type: DataTypes.FLOAT,
          defaultValue: 0.0,
        },
        deliveryFee: {
          type: DataTypes.FLOAT,
          defaultValue: 0.0,
        },
        totalAmount: {
          type: DataTypes.FLOAT,
          defaultValue: 0.0,
        },
        items: {
          type: DataTypes.JSON,
          defaultValue: [],
        },
        prescriptionReference: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      });

      await addIndexIfMissing(queryInterface, 'Orders', ['orderNumber'], { unique: true });
      await addIndexIfMissing(queryInterface, 'Orders', ['customerId']);
      await addIndexIfMissing(queryInterface, 'Orders', ['userId']);
      await addIndexIfMissing(queryInterface, 'Orders', ['orderStatus']);
    }

    // 5. SupportInquiries table
    if (!(await tableExists(queryInterface, 'SupportInquiries'))) {
      await queryInterface.createTable('SupportInquiries', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        inquiryType: {
          type: DataTypes.STRING,
          defaultValue: 'Help finding product',
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          defaultValue: 'New',
        },
        date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      });
    }
  },
};
