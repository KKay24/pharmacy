const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    unique: true
  },
  email: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.STRING
  },
  loyaltyPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalPurchases: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  allergies: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  chronicConditions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  insuranceProvider: {
    type: DataTypes.STRING,
    allowNull: true
  },
  insuranceNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT
  }
});

module.exports = Customer;
