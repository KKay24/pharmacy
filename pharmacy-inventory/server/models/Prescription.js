const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  patientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  doctorName: {
    type: DataTypes.STRING
  },
  doctorLicense: {
    type: DataTypes.STRING
  },
  medications: {
    type: DataTypes.TEXT 
  },
  imagePath: {
    type: DataTypes.STRING 
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Filled', 'Cancelled'),
    defaultValue: 'Pending'
  },
  date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Prescription;
