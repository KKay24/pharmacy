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
  // SHA-256 of the normalized product identity. The database migration owns the
  // unique index; keeping this nullable preserves ambiguous legacy rows safely.
  productKey: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  mainCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'InventoryCategories', key: 'id' },
  },
  subcategoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'InventoryCategories', key: 'id' },
  },
  productFormId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'InventoryCategories', key: 'id' },
  },
  genericName: {
    type: DataTypes.STRING
  },
  brandName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  packSize: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  unitOfMeasure: {
    type: DataTypes.STRING,
    allowNull: true,
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
  },
  isCustomerVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  warnings: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  basePrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  }
});

module.exports = Medicine;
