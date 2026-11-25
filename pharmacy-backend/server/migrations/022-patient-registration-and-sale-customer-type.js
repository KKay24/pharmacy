const { QueryTypes } = require('sequelize');

async function ensureColumns(queryInterface, tableName, columns) {
  const existing = await queryInterface.describeTable(tableName);
  for (const [columnName, definition] of Object.entries(columns)) {
    if (!existing[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
    }
  }
}

async function ensureIndex(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((idx) => idx.name === options.name);
  if (!exists) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}

function splitFullName(fullName) {
  const cleaned = typeof fullName === 'string' ? fullName.trim().replace(/\s+/g, ' ') : '';
  if (!cleaned) return { firstName: null, lastName: null };
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

module.exports = {
  version: '022',
  description: 'Add patient registration profile fields, patientCode, and sale customerType',
  async up({ queryInterface, sequelize, DataTypes }) {
    await ensureColumns(queryInterface, 'Customers', {
      patientCode: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      firstName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    });

    await ensureColumns(queryInterface, 'Sales', {
      customerType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'WALK_IN',
      },
    });

    const customers = await sequelize.query(
      'SELECT "id", "name", "firstName", "lastName", "patientCode" FROM "Customers"',
      { type: QueryTypes.SELECT }
    );

    for (const row of customers) {
      const nextCode = row.patientCode || `MQP-${String(row.id).padStart(6, '0')}`;
      const split = splitFullName(row.name);
      const nextFirstName = row.firstName || split.firstName;
      const nextLastName = row.lastName || split.lastName;

      if (
        nextCode !== row.patientCode
        || nextFirstName !== row.firstName
        || nextLastName !== row.lastName
      ) {
        await sequelize.query(
          'UPDATE "Customers" SET "patientCode" = :patientCode, "firstName" = :firstName, "lastName" = :lastName WHERE "id" = :id',
          {
            replacements: {
              id: row.id,
              patientCode: nextCode,
              firstName: nextFirstName,
              lastName: nextLastName,
            },
          }
        );
      }
    }

    await sequelize.query(
      'UPDATE "Sales" SET "customerType" = \'REGISTERED\' WHERE "customerId" IS NOT NULL AND ("customerType" IS NULL OR "customerType" = \'\' OR "customerType" = \'WALK_IN\')'
    );
    await sequelize.query(
      'UPDATE "Sales" SET "customerType" = \'WALK_IN\' WHERE "customerId" IS NULL AND ("customerType" IS NULL OR "customerType" = \'\')'
    );

    await ensureIndex(queryInterface, 'Customers', ['patientCode'], {
      name: 'customers_patient_code_unique',
      unique: true,
    });

    await ensureIndex(queryInterface, 'Sales', ['customerType'], {
      name: 'sales_customer_type_idx',
    });
  },
};
