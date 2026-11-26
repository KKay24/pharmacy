const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderPaymentEvent = sequelize.define('OrderPaymentEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  eventId: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Orders', key: 'id' },
  },
  eventType: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  receivedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = OrderPaymentEvent;
