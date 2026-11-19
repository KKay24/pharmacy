const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SearchAnalytics = sequelize.define('SearchAnalytics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  query: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  normalizedQuery: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resultsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  hasResults: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  clickedProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Medicines', key: 'id' },
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'SearchAnalytics',
  timestamps: true,
});

module.exports = SearchAnalytics;

