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
  prescriber: { // New display field matching mockup
    type: DataTypes.STRING 
  },
  doctorLicense: {
    type: DataTypes.STRING
  },
  insurance: {
    type: DataTypes.STRING,
    defaultValue: 'Self-Pay'
  },
  medications: {
    type: DataTypes.TEXT 
  },
  imagePath: {
    type: DataTypes.STRING 
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Ready for Pickup', 'Filled', 'On Hold', 'Cancelled'),
    defaultValue: 'Pending'
  },
  prescriptionNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  patientPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryPreference: {
    type: DataTypes.STRING,
    defaultValue: 'delivery'
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Prescription;
