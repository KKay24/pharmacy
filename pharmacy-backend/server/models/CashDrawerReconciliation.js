const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

module.exports = sequelize.define('CashDrawerReconciliation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessDate: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  expectedCashMinor: { type: DataTypes.BIGINT, allowNull: false },
  countedCashMinor: { type: DataTypes.BIGINT, allowNull: false },
  varianceMinor: { type: DataTypes.BIGINT, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  closedByUserId: { type: DataTypes.INTEGER, allowNull: false },
  closedAt: { type: DataTypes.DATE, allowNull: false },
});
