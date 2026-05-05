const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  supplier: {
    type: DataTypes.STRING
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  price: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  orderPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  expiry: {
    type: DataTypes.DATEONLY
  },
  barcode: {
    type: DataTypes.STRING
  }
});

module.exports = Inventory;
