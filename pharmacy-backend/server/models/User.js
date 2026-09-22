const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user',
    allowNull: false,
    validate: {
      isIn: [['admin', 'manager', 'user']]
    }
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  locations: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
    allowNull: false,
    validate: {
      isIn: [['active', 'suspended']]
    }
  },
  mustChangePassword: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
});

module.exports = User;
