const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Medicine = sequelize.define('Medicine', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  genericName: {
    type: DataTypes.STRING
  },
  category: {
    type: DataTypes.STRING
  },
  strength: {
    type: DataTypes.STRING // e.g., "500mg"
  },
  dosage: {
    type: DataTypes.STRING // e.g., "Tablet", "Syrup"
  },
  supplier: { // Default/Preferred supplier
    type: DataTypes.STRING
  },
  manufacturer: {
    type: DataTypes.STRING
  },
  prescriptionRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  barcode: { // Global barcode for the product
    type: DataTypes.STRING
  },
  lowStockThreshold: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  totalQuantity: { // Aggegrated from batches, updated via hooks or logic
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

module.exports = Medicine;
