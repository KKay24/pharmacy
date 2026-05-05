const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  medicineId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Medicines', // Sequelize table name is typically pluralized
      key: 'id'
    }
  },
  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Suppliers',
      key: 'id'
    }
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  costPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  sellingPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  warehouse: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  receivedDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Batch;
