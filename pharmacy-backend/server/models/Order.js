const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryMethod: {
    type: DataTypes.STRING, // 'delivery' or 'pickup'
    defaultValue: 'delivery'
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deliveryProvince: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryCity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryArea: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryLandmark: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.STRING, // 'Mobile Money', 'Airtel Money', 'MTN MoMo', 'Card', 'Cash on Delivery'
    defaultValue: 'Mobile Money'
  },
  paymentStatus: {
    type: DataTypes.STRING, // 'Pending', 'Paid', 'Failed'
    defaultValue: 'Pending'
  },
  orderStatus: {
    type: DataTypes.STRING, // 'Order Placed', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'
    defaultValue: 'Order Placed'
  },
  subtotal: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  deliveryFee: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalAmount: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  items: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  prescriptionReference: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Order;
