const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../models');
const { runMigrations } = require('../lib/migrations');

runMigrations()
  .then(async () => {
    console.log('Migrations completed successfully');
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error('Migration failed:', error);
    await sequelize.close();
    process.exitCode = 1;
  });
