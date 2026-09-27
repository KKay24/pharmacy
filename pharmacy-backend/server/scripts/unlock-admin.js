const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, User } = require('../models');

async function unlockAdmin() {
  await sequelize.authenticate();
  const [updatedCount] = await User.update(
    { mustChangePassword: false, status: 'active' },
    { where: { role: 'admin' } }
  );
  console.log(`Successfully updated ${updatedCount} admin account(s). Password requirement cleared and account activated.`);
}

unlockAdmin()
  .catch((err) => {
    console.error('Failed to unlock admin:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
