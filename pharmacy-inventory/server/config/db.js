const { Sequelize } = require('sequelize');
const path = require('path');

const isVercel = process.env.VERCEL === '1';

let sequelize;
if (process.env.POSTGRES_URL) {
  console.log('Database Configuration: Using production PostgreSQL');
  try {
    sequelize = new Sequelize(process.env.POSTGRES_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });
  } catch (error) {
    console.error('Failed to initialize PostgreSQL Sequelize instance:', error);
    throw error;
  }
} else {
  // Fallback to SQLite
  // On Vercel, we use in-memory database to avoid file system permission/RO issues completely.
  console.log(`Database Configuration: Using SQLite (isVercel: ${isVercel})`);
  const storageParams = isVercel 
    ? { storage: ':memory:' }
    : { storage: path.join(__dirname, '../pharmacy.sqlite') };
    
  try {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      ...storageParams,
      logging: false
    });
  } catch (error) {
    console.error('Failed to initialize SQLite Sequelize instance:', error);
    throw error;
  }
}

module.exports = sequelize;
