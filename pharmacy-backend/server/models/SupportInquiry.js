const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SupportInquiry = sequelize.define('SupportInquiry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  inquiryType: {
    type: DataTypes.STRING, // 'Help finding product', 'Prescription question', 'Product dosage question', 'Order help'
    defaultValue: 'Help finding product'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING, // 'New', 'Contacted', 'Resolved'
    defaultValue: 'New'
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = SupportInquiry;
