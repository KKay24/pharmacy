const { Sequelize } = require('sequelize');
const path = require('path');

async function check(filePath) {
  console.log(`Checking DB at: ${filePath}`);
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: filePath,
    logging: false
  });

  try {
    const [results] = await sequelize.query("SELECT count(*) as count FROM Medicines");
    console.log(`  Medicines Count: ${results[0].count}`);
  } catch (e) {
    console.log(`  Error (maybe table missing): ${e.message}`);
  }
}

async function run() {
  await check(path.join(__dirname, '../config/pharmacy.sqlite'));
  await check(path.join(__dirname, '../pharmacy.sqlite'));
}

run();
