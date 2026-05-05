const { Sequelize } = require('sequelize');
const {
  databaseUrl,
  isProduction,
  isVercel,
  sqliteStoragePath,
} = require('../lib/config');

let sequelize;

if (databaseUrl) {
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: isProduction
        ? {
            require: true,
            rejectUnauthorized: false,
          }
        : undefined,
    },
    logging: false,
  });
} else if (isVercel && isProduction) {
  throw new Error('DATABASE_URL or POSTGRES_URL is required for Vercel production deployments');
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqliteStoragePath,
    logging: false,
  });
}

module.exports = sequelize;
