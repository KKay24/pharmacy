const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InventoryMovement = sequelize.define('InventoryMovement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  medicineId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Medicines', key: 'id' },
  },
  batchId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Batches', key: 'id' },
  },
  movementType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantityChange: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  referenceType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  clientTransactionId: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
});

module.exports = InventoryMovement;
