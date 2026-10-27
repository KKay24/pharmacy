const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

module.exports = sequelize.define('SaleRefund', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  saleId: { type: DataTypes.INTEGER, allowNull: false },
  amountMinor: { type: DataTypes.BIGINT, allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'CONFIRMED' },
  financialDate: { type: DataTypes.DATE, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  processedByUserId: { type: DataTypes.INTEGER, allowNull: false },
});
