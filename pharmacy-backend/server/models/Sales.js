const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Sales = sequelize.define('Sales', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batchId: {
    type: DataTypes.INTEGER,
    allowNull: true // Nullable for legacy sales
  },
  medicineId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true 
  },
  soldBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  soldByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'SET NULL',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  pricePerUnit: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalCost: { // COGS
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalPriceMinor: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  totalCostMinor: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  discount: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  paymentMethod: {
    type: DataTypes.STRING, // Cash, Card, Mobile
    defaultValue: 'Cash'
  },
  receiptNumber: {
    type: DataTypes.STRING
  },
  saleStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'COMPLETED',
  },
  reversedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reversedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'SET NULL',
  },
  reversalReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  clientTransactionId: {
    type: DataTypes.STRING(128),
    allowNull: true,
  }
});

module.exports = Sales;
