module.exports = {
  version: '007',
  description: 'Add audit log records',
  async up({ queryInterface, DataTypes }) {
    const tables = await queryInterface.showAllTables();
    const exists = tables.some((table) => {
      const name = typeof table === 'string' ? table : table.tableName || table.name;
      return name.toLowerCase() === 'auditlogs';
    });
    if (exists) return;

    await queryInterface.createTable('AuditLogs', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING, allowNull: false },
      resource: { type: DataTypes.STRING, allowNull: false },
      method: { type: DataTypes.STRING, allowNull: false },
      path: { type: DataTypes.STRING, allowNull: false },
      statusCode: { type: DataTypes.INTEGER, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
  },
};