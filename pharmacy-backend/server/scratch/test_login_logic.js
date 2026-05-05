const { findUserByUsername } = require('../lib/users');
const { verifyPassword } = require('../lib/auth/passwords');

async function testLogin(username, password) {
    console.log(`--- TESTING LOGIN for ${username} ---`);
    const user = await findUserByUsername(username);
    if (!user) {
        console.log(`User ${username} NOT FOUND`);
        return;
    }
    
    const isValid = verifyPassword(password, user.password);
    console.log(`Password Valid: ${isValid}`);
    console.log(`Stored Password Hash Start: ${user.password.substring(0, 15)}...`);
    console.log('---------------------------');
}

async function run() {
    await testLogin('admin', 'admin1234');
    await testLogin('manager', 'manager1234');
    await testLogin('staff', 'user1234');
}

run();
