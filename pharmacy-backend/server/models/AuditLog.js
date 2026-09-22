const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  userId: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: false },
  resource: { type: DataTypes.STRING, allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false },
  path: { type: DataTypes.STRING, allowNull: false },
  statusCode: { type: DataTypes.INTEGER, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  ipAddress: { type: DataTypes.STRING, allowNull: true },
});

module.exports = AuditLog;