const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuthAuditLog = sequelize.define('AuthAuditLog', {
  userId: { type: DataTypes.INTEGER, allowNull: true },
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
}, {
  tableName: 'AuthAuditLogs',
});

module.exports = AuthAuditLog;
