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
  receivedDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Batch;
