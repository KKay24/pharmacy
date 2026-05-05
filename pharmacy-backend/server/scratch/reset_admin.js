const { User } = require('../models');
const { hashPassword } = require('../lib/auth/passwords');

async function resetAdmin() {
  try {
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
        console.error('Admin user not found');
        return;
    }
    
    admin.password = hashPassword('admin1234');
    await admin.save();
    console.log('RESET SUCCESS: Admin password is now "admin1234"');
  } catch (err) {
    console.error('Reset failed:', err);
  }
}

resetAdmin();
