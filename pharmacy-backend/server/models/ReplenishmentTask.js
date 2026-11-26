const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReplenishmentTask = sequelize.define('ReplenishmentTask', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'OrderItems', key: 'id' },
  },
  outstandingQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Open',
  },
  supplierConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  estimatedFulfillmentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  updatedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
});

module.exports = ReplenishmentTask;
