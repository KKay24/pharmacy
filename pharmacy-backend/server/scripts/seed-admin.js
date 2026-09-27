const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const { runMigrations } = require('../lib/migrations');
const { hashPassword } = require('../lib/auth/passwords');

async function seedAdmin() {
  const email = typeof process.env.SEED_ADMIN_EMAIL === 'string'
    ? process.env.SEED_ADMIN_EMAIL.trim().toLowerCase()
    : '';
  const password = typeof process.env.SEED_ADMIN_PASSWORD === 'string'
    ? process.env.SEED_ADMIN_PASSWORD
    : '';

  if (!email || !email.includes('@')) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email address');
  }

  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
  }

  await sequelize.authenticate();
  await runMigrations();

  const existingAdmin = await User.findOne({ where: { role: 'admin' } });
  if (existingAdmin) {
    console.log('An admin account already exists; no account was created.');
    return;
  }

  const emailOwner = await User.findOne({ where: { [Op.or]: [{ email }, { username: email }] } });
  if (emailOwner) {
    throw new Error('SEED_ADMIN_EMAIL is already used by a non-admin account');
  }

  await User.create({
    username: email,
    email,
    password: hashPassword(password),
    role: 'admin',
    locations: [],
    status: 'active',
    mustChangePassword: false,
  });

  console.log('Admin account created successfully.');
}

seedAdmin()
  .catch((error) => {
    console.error(`Admin seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });