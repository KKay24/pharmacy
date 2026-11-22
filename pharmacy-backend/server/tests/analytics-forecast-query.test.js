const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Op } = require('sequelize');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-forecast-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'forecast.sqlite');
process.env.JWT_SECRET = 'forecast-test-secret-value';

const { Medicine, Sales, sequelize } = require('../models');
const AnalyticsService = require('../src/analytics/analytics.service');
const {
  buildForecastDataset,
  parseAnalyticsOptions,
  startOfToday,
} = require('../services/analytics/forecast');

after(async () => {
  await sequelize.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('forecast queries only the sales history required by its configured windows', async () => {
  const originalMedicineFindAll = Medicine.findAll;
  const originalSalesFindAll = Sales.findAll;
  let salesQuery;

  Medicine.findAll = async () => [];
  Sales.findAll = async (options) => {
    salesQuery = options;
    return [];
  };

  try {
    const options = parseAnalyticsOptions({ historyDays: '30', shortWindowDays: '30' });
    await buildForecastDataset(options);

    const expectedWindowDays = Math.max(options.historyDays, options.shortWindowDays * 2);
    const expectedStart = startOfToday();
    expectedStart.setDate(expectedStart.getDate() - (expectedWindowDays - 1));
    const expectedDate = [
      expectedStart.getFullYear(),
      String(expectedStart.getMonth() + 1).padStart(2, '0'),
      String(expectedStart.getDate()).padStart(2, '0'),
    ].join('-');
    const tomorrow = startOfToday();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expectedEnd = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');

    assert.equal(salesQuery.where.date[Op.gte], expectedDate);
    assert.equal(salesQuery.where.date[Op.lt], expectedEnd);
    assert.equal(salesQuery.where.saleStatus[Op.ne], 'REVERSED');
  } finally {
    Medicine.findAll = originalMedicineFindAll;
    Sales.findAll = originalSalesFindAll;
  }
});

test('analytics read failures are logged safely and remain request-scoped', async () => {
  const originalMedicineFindAll = Medicine.findAll;
  const originalSalesFindAll = Sales.findAll;
  const originalConsoleError = console.error;
  const loggedEvents = [];

  Medicine.findAll = async () => {
    throw new Error('private database connection detail');
  };
  Sales.findAll = async () => [];
  console.error = (line) => loggedEvents.push(JSON.parse(line));

  try {
    await assert.rejects(
      new AnalyticsService().predictions({}),
      (error) => error.getStatus() === 500
        && !JSON.stringify(error.getResponse()).includes('private database connection detail')
    );
    assert.deepEqual(loggedEvents, [{
      event: 'analytics_snapshot_failed',
      errorName: 'Error',
      errorCode: null,
    }]);
  } finally {
    Medicine.findAll = originalMedicineFindAll;
    Sales.findAll = originalSalesFindAll;
    console.error = originalConsoleError;
  }
});
