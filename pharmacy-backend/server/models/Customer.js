const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  patientCode: {
    type: DataTypes.STRING(32),
    allowNull: true,
    unique: true,
  },
  firstName: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  lastName: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  gender: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true,
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
