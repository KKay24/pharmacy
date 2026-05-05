const { User } = require('../models');

async function checkUsers() {
  try {
    const users = await User.findAll();
    console.log('--- USER LIST ---');
    users.forEach(u => {
      console.log(`Username: ${u.username}, Role: ${u.role}, Status: ${u.status}`);
    });
    console.log('-----------------');
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

checkUsers();
