const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InventoryCategory = sequelize.define('InventoryCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'InventoryCategories', key: 'id' },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

module.exports = InventoryCategory;
