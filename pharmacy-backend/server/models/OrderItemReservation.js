const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderItemReservation = sequelize.define('OrderItemReservation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'OrderItems', key: 'id' },
  },
  batchId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Batches', key: 'id' },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

module.exports = OrderItemReservation;
