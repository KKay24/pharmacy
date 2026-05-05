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
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Sales;
