const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SalePayment = sequelize.define('SalePayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  saleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Sales', key: 'id' },
    onDelete: 'CASCADE',
  },
  method: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amountMinor: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.VIRTUAL,
    get() {
      return Number(this.getDataValue('amountMinor')) / 100;
    },
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transactionReference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  confirmedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'RESTRICT',
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = SalePayment;
