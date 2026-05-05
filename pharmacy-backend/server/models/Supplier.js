const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Supplier = sequelize.define('Supplier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contactPerson: {
    type: DataTypes.STRING
  },
  email: {
    type: DataTypes.STRING,
    validate: { isEmail: true }
  },
  phone: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  paymentTerms: {
    type: DataTypes.STRING, // e.g., "Net 30", "Immediate"
    defaultValue: "Immediate"
  },
  balanceOwed: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  rating: {
    type: DataTypes.INTEGER,
    defaultValue: 5 // 1-5 stars
  }
});

module.exports = Supplier;
