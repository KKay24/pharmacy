const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Op } = require('sequelize');
const { CashDrawerReconciliation } = require('../models');
const { buildFinancialReport, businessMidnightUtc, parseRange } = require('../services/financial/reporting');
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

test('financial reporting chunks sale data and keeps a receipt spanning chunks intact', async () => {
  const { Expense, Medicine, SalePayment, SaleRefund, Sales } = require('../models');
  const models = [
    [Sales, Sales.findAll],
    [SalePayment, SalePayment.findAll],
    [Medicine, Medicine.findAll],
    [Expense, Expense.findAll],
    [SaleRefund, SaleRefund.findAll],
  ];
  const sales = Array.from({ length: 501 }, (_, index) => ({
    id: index + 1,
    date: '2026-02-03T10:00:00.000Z',
    receiptNumber: 'ONE-LARGE-RECEIPT',
    totalPriceMinor: 100,
    totalCostMinor: 50,
    medicineId: 1,
    saleStatus: 'COMPLETED',
  }));
  const salesOffsets = [];
  Sales.findAll = async ({ offset, limit }) => {
    salesOffsets.push(offset);
    return sales.slice(offset, offset + limit);
  };
  SalePayment.findAll = async ({ where }) => {
    const saleIds = Array.isArray(where.saleId)
      ? where.saleId
      : where.saleId[require('sequelize').Op.in];
    return saleIds.map((saleId) => ({ saleId, method: 'Cash', amountMinor: 100 }));
  };
  Medicine.findAll = async () => [{ id: 1, category: 'Medicine' }];
  Expense.findAll = async () => [];
  SaleRefund.findAll = async () => [];

  try {
    const report = await buildFinancialReport();
    assert.deepEqual(salesOffsets, [0, 500]);
    assert.equal(report.totals.revenue, 501);
    assert.equal(report.totals.cogs, 250.5);
    assert.equal(report.totals.receiptCount, 1);
    assert.equal(report.payments[0].receiptCount, 1);
    assert.equal(report.categories[0].value, 501);
    assert.deepEqual(report.allocationWarnings, []);
  } finally {
    models.forEach(([Model, findAll]) => { Model.findAll = findAll; });
  }
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
