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
  let medicineQuery;

  Medicine.findAll = async (options) => {
    medicineQuery = options;
    return [];
  };
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
    assert.deepEqual(medicineQuery.attributes, ['id', 'name', 'genericName', 'category', 'lowStockThreshold']);
    assert.ok(!medicineQuery.attributes.includes('imageUrl'));
    assert.deepEqual(salesQuery.attributes, ['medicineId', 'name', 'date', 'quantity']);
  } finally {
    Medicine.findAll = originalMedicineFindAll;
    Sales.findAll = originalSalesFindAll;
  }
});

test('concurrent analytics endpoints reuse the same in-flight forecast snapshot', async () => {
  const originalMedicineFindAll = Medicine.findAll;
  const originalSalesFindAll = Sales.findAll;
  let medicineQueries = 0;
  let salesQueries = 0;
  Medicine.findAll = async () => {
    medicineQueries += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return [];
  };
  Sales.findAll = async () => {
    salesQueries += 1;
    return [];
  };

  try {
    const service = new AnalyticsService();
    await Promise.all([service.predictions({}), service.risks({}), service.reorderSuggestions({})]);
    assert.equal(medicineQueries, 1);
    assert.equal(salesQueries, 1);
    assert.equal(service.inFlightJobs.size, 0);
    assert.equal(service.activeJobs, 0);
  } finally {
    Medicine.findAll = originalMedicineFindAll;
    Sales.findAll = originalSalesFindAll;
  }
});

test('analytics limits concurrent distinct heavy jobs', async () => {
  const service = new AnalyticsService();
  service.maxConcurrentJobs = 1;
  let releaseFirst;
  const first = service.runHeavyJob('first', () => new Promise((resolve) => { releaseFirst = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));

  assert.throws(
    () => service.runHeavyJob('second', async () => 'unused'),
    (error) => error.getStatus() === 503
  );
  releaseFirst('done');
  assert.equal(await first, 'done');
  assert.equal(service.activeJobs, 0);
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
