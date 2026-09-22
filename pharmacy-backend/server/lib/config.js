const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const hasConfiguredSqlitePath = Boolean(process.env.SQLITE_STORAGE_PATH);
const isSqliteDatabaseUrl = /^sqlite:/i.test(databaseUrl);
const sqliteStoragePath = process.env.SQLITE_STORAGE_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_STORAGE_PATH)
  : path.join(__dirname, '..', 'pharmacy.sqlite');

const jwtSecret = process.env.JWT_SECRET || '';
const jwtExpiresInHours = Math.max(1, Number(process.env.JWT_EXPIRES_IN_HOURS || 12));
const enableDemoSeeding = process.env.ENABLE_DEMO_SEEDING === 'true';
const allowLegacyDevAuth = !isProduction && process.env.ALLOW_LEGACY_DEV_AUTH === 'true';
const port = Number(process.env.PORT || 5001);

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error('Production startup requires DATABASE_URL.');
}

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('Production startup requires JWT_SECRET.');
}

if (isProduction && hasConfiguredSqlitePath) {
  throw new Error('SQLite is not allowed in production. Use DATABASE_URL with PostgreSQL.');
}

if (isProduction && isSqliteDatabaseUrl) {
  throw new Error('SQLite database URLs are not allowed in production. Use PostgreSQL through DATABASE_URL.');
}

module.exports = {
  allowLegacyDevAuth,
  databaseUrl,
  enableDemoSeeding,
  hasConfiguredSqlitePath,
  isProduction,
  isSqliteDatabaseUrl,
  isTest,
  isVercel,
  jwtExpiresInHours,
  jwtSecret,
  port,
  sqliteStoragePath,
};
