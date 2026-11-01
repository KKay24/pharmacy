const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Op } = require('sequelize');
const { CashDrawerReconciliation } = require('../models');
const { businessMidnightUtc, parseRange } = require('../services/financial/reporting');
const CashReconciliationService = require('../src/cash-reconciliation/cash-reconciliation.service');

test('explicit financial reporting ranges use Africa/Lusaka half-open calendar boundaries', () => {
  const range = parseRange({ start: '2026-02-01', end: '2026-03-01' });

  assert.equal(range.start, '2026-02-01');
  assert.equal(range.end, '2026-03-01');
  assert.equal(range.from, '2026-02-01');
  assert.equal(range.to, '2026-02-28');
  assert.deepEqual(range.salesWhere.date[Op.gte], businessMidnightUtc('2026-02-01'));
  assert.deepEqual(range.salesWhere.date[Op.lt], businessMidnightUtc('2026-03-01'));
});

test('explicit financial reporting ranges reject missing or overlapping boundaries', () => {
  assert.throws(() => parseRange({ start: '2026-02-01' }), /start and end/);
  assert.throws(() => parseRange({ start: '2026-02-01', end: '2026-02-01' }), /before end/);
  assert.throws(() => parseRange({ start: '2026-02-02', end: '2026-02-01' }), /before end/);
});

test('legacy inclusive financial ranges retain their prior boundary semantics', () => {
  const range = parseRange({ from: '2026-02-28', to: '2026-02-28' });

  assert.equal(range.start, '2026-02-28');
  assert.equal(range.end, '2026-03-01');
  assert.deepEqual(range.salesWhere.date[Op.gte], businessMidnightUtc('2026-02-28'));
  assert.deepEqual(range.salesWhere.date[Op.lt], businessMidnightUtc('2026-03-01'));
});

test('cash reconciliations use the same half-open reporting period', async () => {
  const originalFindAll = CashDrawerReconciliation.findAll;
  let options;
  CashDrawerReconciliation.findAll = async (value) => { options = value; return []; };

  try {
    await new CashReconciliationService().list({ start: '2026-02-01', end: '2026-03-01' });
  } finally {
    CashDrawerReconciliation.findAll = originalFindAll;
  }

  assert.deepEqual(options.where.businessDate, { [Op.gte]: '2026-02-01', [Op.lt]: '2026-03-01' });
  assert.deepEqual(options.order, [['businessDate', 'DESC']]);
});
