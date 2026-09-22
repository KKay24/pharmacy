const { col, fn, where } = require('sequelize');
const User = require('../models/User');

const VALID_ROLES = ['admin', 'manager', 'user'];
const VALID_STATUSES = ['active', 'suspended'];

function normalizeUsernameInput(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function findUserByUsername(username) {
  const normalized = normalizeUsernameInput(username).toLowerCase();
  if (!normalized) {
    return null;
  }

  return User.findOne({
    where: where(fn('lower', col('username')), normalized),
  });
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email || null,
    locations: Array.isArray(user.locations) ? user.locations : [],
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt || null,
  };
}

module.exports = {
  VALID_ROLES,
  VALID_STATUSES,
  findUserByUsername,
  normalizeUsernameInput,
  serializeUser,
};
