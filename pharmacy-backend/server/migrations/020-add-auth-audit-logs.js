async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : table.tableName || table.name;
    return String(name || '').toLowerCase() === tableName.toLowerCase();
  });
}

async function ensureIndex(queryInterface, tableName, fields, options) {
  try {
    const existingIndexes = await queryInterface.showIndex(tableName);
    const exists = existingIndexes.some((idx) => idx.name === options.name);
    if (!exists) {
      await queryInterface.addIndex(tableName, fields, options);
    }
  } catch (error) {
    // Ignore duplicate index errors across dialects
    if (!/already exists|duplicate/i.test(error.message || '')) {
      throw error;
    }
  }
}

module.exports = {
  version: '020',
  description: 'Add persistent authentication audit logs with IP, device, geolocation, and suspicious activity indicators',
  async up({ queryInterface, DataTypes }) {
    const exists = await tableExists(queryInterface, 'AuthAuditLogs');
    if (!exists) {
      await queryInterface.createTable('AuthAuditLogs', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        attemptedEmail: { type: DataTypes.STRING(255), allowNull: false },
        ipAddress: { type: DataTypes.STRING(64), allowNull: false },
        userAgent: { type: DataTypes.STRING(512), allowNull: true },
        deviceType: { type: DataTypes.STRING(32), allowNull: true },
        operatingSystem: { type: DataTypes.STRING(64), allowNull: true },
        browser: { type: DataTypes.STRING(64), allowNull: true },
        status: { type: DataTypes.STRING(16), allowNull: false },
        failureReason: { type: DataTypes.STRING(64), allowNull: true },
        geoCountry: { type: DataTypes.STRING(100), allowNull: true },
        geoRegion: { type: DataTypes.STRING(100), allowNull: true },
        geoCity: { type: DataTypes.STRING(100), allowNull: true },
        geoIsp: { type: DataTypes.STRING(150), allowNull: true },
        suspicious: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        suspiciousFlags: { type: DataTypes.JSON, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }

    await ensureIndex(queryInterface, 'AuthAuditLogs', ['createdAt'], {
      name: 'idx_auth_audit_created_at',
    });
    await ensureIndex(queryInterface, 'AuthAuditLogs', ['ipAddress', 'createdAt'], {
      name: 'idx_auth_audit_ip_created_at',
    });
    await ensureIndex(queryInterface, 'AuthAuditLogs', ['attemptedEmail', 'createdAt'], {
      name: 'idx_auth_audit_email_created_at',
    });
    await ensureIndex(queryInterface, 'AuthAuditLogs', ['status', 'createdAt'], {
      name: 'idx_auth_audit_status_created_at',
    });
    await ensureIndex(queryInterface, 'AuthAuditLogs', ['userId', 'createdAt'], {
      name: 'idx_auth_audit_user_created_at',
    });
  },
};
