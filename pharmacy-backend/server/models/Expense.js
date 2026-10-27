const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category: {
    type: DataTypes.STRING, // e.g., "Payroll", "Rent", "Utilities", "Operations"
    allowNull: false
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  amountMinor: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  voidedAt: { type: DataTypes.DATE, allowNull: true },
  voidedByUserId: { type: DataTypes.INTEGER, allowNull: true },
  voidReason: { type: DataTypes.TEXT, allowNull: true },
  correctedAt: { type: DataTypes.DATE, allowNull: true },
  correctedByUserId: { type: DataTypes.INTEGER, allowNull: true },
  correctionReason: { type: DataTypes.TEXT, allowNull: true },
  description: {
    type: DataTypes.STRING
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Expense;
