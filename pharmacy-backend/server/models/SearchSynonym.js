const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SearchSynonym = sequelize.define('SearchSynonym', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  term: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  synonyms: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('synonyms');
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    },
    set(val) {
      if (Array.isArray(val)) {
        this.setDataValue('synonyms', JSON.stringify(val));
      } else if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          this.setDataValue('synonyms', JSON.stringify(parsed));
        } catch (err) {
          this.setDataValue('synonyms', JSON.stringify(val.split(',').map((s) => s.trim()).filter(Boolean)));
        }
      } else {
        this.setDataValue('synonyms', '[]');
      }
    },
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'SearchSynonyms',
  timestamps: true,
});

module.exports = SearchSynonym;

