const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-health-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'health.sqlite');
process.env.JWT_SECRET = 'health-test-secret-value';

const HealthController = require('../src/health/health.controller');
const { sequelize } = require('../models');

after(async () => {
  await sequelize.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('liveness health stays successful when the database is unavailable', async () => {
  const originalAuthenticate = sequelize.authenticate;
  sequelize.authenticate = async () => {
    throw new Error('database connection detail must not be exposed');
  };

  try {
    assert.deepEqual(new HealthController().health(), { status: 'ok' });

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(
        new HealthController().database(),
        (error) => error.getStatus() === 503 && !JSON.stringify(error.getResponse()).includes('connection detail')
      );
    } finally {
      console.error = originalConsoleError;
    }
  } finally {
    sequelize.authenticate = originalAuthenticate;
  }
});
