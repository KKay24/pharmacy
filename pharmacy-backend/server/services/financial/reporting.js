const { Op, col, fn } = require('sequelize');
const { Expense, Medicine, SalePayment, SaleRefund, Sales } = require('../../models');

const BUSINESS_TIME_ZONE = 'Africa/Lusaka';
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function dateParts(value) {
  const parts = dateFormatter.formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { year: get('year'), month: get('month'), day: get('day') };
}
function businessDate(value) { const { year, month, day } = dateParts(value); return `${year}-${month}-${day}`; }
function businessMonth(value) { const { year, month } = dateParts(value); return `${year}-${month}`; }
function assertDateKey(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD`);
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} is invalid`);
  return value;
}
// Zambia has no daylight saving time. This makes financial dates independent of browser/server locale.
function businessMidnightUtc(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, -2));
}
function nextDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
function previousDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
function parseRange(query = {}) {
  const hasStartEnd = query.start !== undefined || query.end !== undefined;
  if (hasStartEnd) {
    if (!query.start || !query.end) throw new Error('start and end must both use YYYY-MM-DD');
    const start = assertDateKey(String(query.start).slice(0, 10), 'start');
    const end = assertDateKey(String(query.end).slice(0, 10), 'end');
    if (start >= end) throw new Error('start must be before end');
    // The explicit reporting-period contract is [start, end), so adjacent
    // calendar periods share a boundary without double-counting activity.
    return {
      from: start,
      to: previousDateKey(end),
      start,
      end,
      salesWhere: { date: { [Op.gte]: businessMidnightUtc(start), [Op.lt]: businessMidnightUtc(end) } },
    };
  }
  const from = query.from ? assertDateKey(String(query.from).slice(0, 10), 'from') : null;
  const to = query.to ? assertDateKey(String(query.to).slice(0, 10), 'to') : null;
  if (from && to && from > to) throw new Error('from must be on or before to');
  const date = from || to ? { ...(from ? { [Op.gte]: businessMidnightUtc(from) } : {}), ...(to ? { [Op.lt]: businessMidnightUtc(nextDateKey(to)) } : {}) } : null;
  return { from, to, start: from, end: to ? nextDateKey(to) : null, salesWhere: date ? { date } : {} };
}
function toMinor(value) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed) : null; }
function amount(minor) { return Number((Number(minor || 0) / 100).toFixed(2)); }
function emptyBucket(period) { return { period, revenueMinor: 0, cogsMinor: 0, operatingExpensesMinor: 0, cashRefundsMinor: 0, unknownCogsSaleCount: 0, receiptCount: 0, tenderMinor: new Map() }; }
function publicBucket(bucket) {
  const cogsKnown = bucket.unknownCogsSaleCount === 0;
  const revenue = amount(bucket.revenueMinor);
  const cogs = cogsKnown ? amount(bucket.cogsMinor) : null;
  const operatingExpenses = amount(bucket.operatingExpensesMinor);
  return { month: bucket.period, revenue, cogs, grossProfit: cogsKnown ? Number((revenue - cogs).toFixed(2)) : null, operatingExpenses, netProfit: cogsKnown ? Number((revenue - cogs - operatingExpenses).toFixed(2)) : null, cashRefunds: amount(bucket.cashRefundsMinor), cogsKnown, unknownCogsSaleCount: bucket.unknownCogsSaleCount, receiptCount: bucket.receiptCount, payments: [...bucket.tenderMinor.entries()].map(([method, minor]) => ({ method, amount: amount(minor) })) };
}

async function buildFinancialReport(query = {}) {
  const range = parseRange(query);
  const months = new Map(); const days = new Map(); const paymentTotals = new Map(); const categoryTotals = new Map(); const allocationWarnings = [];
  const ensure = (map, key) => { if (!map.has(key)) map.set(key, emptyBucket(key)); return map.get(key); };
  const receiptKey = (sale) => sale.receiptNumber ? `receipt:${sale.receiptNumber}` : `sale:${sale.id}`;
  const processReceipt = (receipt) => {
    if (!receipt.completed) return;
    const revenueMinor = receipt.revenueMinor;
    const month = ensure(months, businessMonth(receipt.firstDate));
    const day = ensure(days, businessDate(receipt.firstDate));
    [month, day].forEach((bucket) => {
      bucket.revenueMinor += revenueMinor;
      bucket.receiptCount += 1;
      bucket.unknownCogsSaleCount += receipt.unknownCogsSaleCount;
      if (receipt.unknownCogsSaleCount === 0) bucket.cogsMinor += receipt.cogsMinor;
    });
    receipt.categoryTotals.forEach((value, category) => {
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + value);
    });
    if (receipt.paymentCount === 0 || receipt.paidMinor !== revenueMinor) {
      allocationWarnings.push({
        receiptNumber: receipt.receiptNumber || null,
        saleIds: receipt.saleIds,
        revenue: amount(revenueMinor),
        allocatedPayments: amount(receipt.paidMinor),
      });
    }
    receipt.paymentTotals.forEach((paymentMinor, method) => {
      const entry = paymentTotals.get(method) || { method, amountMinor: 0, receiptCount: 0 };
      entry.amountMinor += paymentMinor;
      entry.receiptCount += 1;
      paymentTotals.set(method, entry);
      [month, day].forEach((bucket) => {
        bucket.tenderMinor.set(method, (bucket.tenderMinor.get(method) || 0) + paymentMinor);
      });
    });
  };
  const createReceipt = (sale) => ({
    key: receiptKey(sale),
    receiptNumber: sale.receiptNumber,
    firstDate: sale.date,
    completed: true,
    revenueMinor: 0,
    cogsMinor: 0,
    unknownCogsSaleCount: 0,
    paidMinor: 0,
    paymentCount: 0,
    saleIds: [],
    paymentTotals: new Map(),
    categoryTotals: new Map(),
  });
  const chunkSize = 500;
  const forEachChunk = async (Model, options, visit) => {
    let offset = 0;
    while (true) {
      const rows = await Model.findAll({ ...options, limit: chunkSize, offset });
      if (rows.length === 0) break;
      await visit(rows);
      if (rows.length < chunkSize) break;
      offset += rows.length;
    }
  };
  let pendingReceipt = null;
  await forEachChunk(Sales, {
    attributes: ['id', 'date', 'receiptNumber', 'totalPriceMinor', 'totalPrice', 'totalCostMinor', 'medicineId', 'name', 'saleStatus'],
    where: range.salesWhere,
    order: [['receiptNumber', 'ASC'], ['date', 'ASC'], ['id', 'ASC']],
    raw: true,
  }, async (sales) => {
    const saleIds = sales.map((sale) => sale.id);
    const medicineIds = [...new Set(sales.map((sale) => sale.medicineId).filter(Boolean))];
    const [payments, medicines] = await Promise.all([
      saleIds.length ? SalePayment.findAll({
        attributes: ['saleId', 'method', [fn('SUM', col('amountMinor')), 'amountMinor']],
        where: { saleId: saleIds },
        group: ['saleId', 'method'],
        raw: true,
      }) : [],
      medicineIds.length ? Medicine.findAll({
        where: { id: medicineIds },
        attributes: ['id', 'category', 'mainCategoryId'],
        raw: true,
      }) : [],
    ]);
    const categories = new Map(medicines.map((medicine) => [
      medicine.id,
      medicine.category || (medicine.mainCategoryId ? `Category #${medicine.mainCategoryId}` : 'Unclassified'),
    ]));
    const paymentsBySale = new Map();
    payments.forEach((payment) => {
      if (!paymentsBySale.has(payment.saleId)) paymentsBySale.set(payment.saleId, []);
      paymentsBySale.get(payment.saleId).push(payment);
    });

    for (const sale of sales) {
      const key = receiptKey(sale);
      if (pendingReceipt && pendingReceipt.key !== key) {
        processReceipt(pendingReceipt);
        pendingReceipt = null;
      }
      if (!pendingReceipt) pendingReceipt = createReceipt(sale);
      pendingReceipt.completed = pendingReceipt.completed && (sale.saleStatus || 'COMPLETED') === 'COMPLETED';
      pendingReceipt.saleIds.push(sale.id);
      pendingReceipt.revenueMinor += toMinor(sale.totalPriceMinor)
        ?? Math.round(Number(sale.totalPrice || 0) * 100);
      const cost = toMinor(sale.totalCostMinor);
      if (cost === null) pendingReceipt.unknownCogsSaleCount += 1;
      else pendingReceipt.cogsMinor += cost;

      const category = categories.get(sale.medicineId) || 'Unclassified';
      const saleRevenue = toMinor(sale.totalPriceMinor)
        ?? Math.round(Number(sale.totalPrice || 0) * 100);
      pendingReceipt.categoryTotals.set(
        category,
        (pendingReceipt.categoryTotals.get(category) || 0) + saleRevenue
      );
      (paymentsBySale.get(sale.id) || []).forEach((payment) => {
        const method = payment.method || 'Unknown';
        const paymentMinor = toMinor(payment.amountMinor) || 0;
        pendingReceipt.paymentCount += 1;
        pendingReceipt.paidMinor += paymentMinor;
        pendingReceipt.paymentTotals.set(
          method,
          (pendingReceipt.paymentTotals.get(method) || 0) + paymentMinor
        );
      });
    }
  });
  if (pendingReceipt) processReceipt(pendingReceipt);

  await forEachChunk(Expense, {
    attributes: ['date', 'amountMinor'],
    where: { ...(range.salesWhere.date ? { date: range.salesWhere.date } : {}), voidedAt: null },
    order: [['date', 'ASC'], ['id', 'ASC']],
    raw: true,
  }, (expenses) => {
    expenses.forEach((expense) => {
      const value = toMinor(expense.amountMinor); if (value === null) return;
      [ensure(days, businessDate(expense.date)), ensure(months, businessMonth(expense.date))]
        .forEach((bucket) => { bucket.operatingExpensesMinor += value; });
    });
  });
  await forEachChunk(SaleRefund, {
    attributes: ['financialDate', 'status', 'amountMinor'],
    where: range.salesWhere.date ? { financialDate: range.salesWhere.date } : {},
    order: [['financialDate', 'ASC'], ['id', 'ASC']],
    raw: true,
  }, (refunds) => {
    refunds.forEach((refund) => {
      if (refund.status !== 'CONFIRMED') return;
      const value = toMinor(refund.amountMinor) || 0;
      [ensure(days, businessDate(refund.financialDate)), ensure(months, businessMonth(refund.financialDate))]
        .forEach((bucket) => { bucket.cashRefundsMinor += value; });
    });
  });
  const monthly = [...months.values()].sort((a, b) => a.period.localeCompare(b.period)).map(publicBucket);
  const daily = [...days.values()].sort((a, b) => a.period.localeCompare(b.period)).map((bucket) => ({ ...publicBucket(bucket), date: bucket.period }));
  const total = [...months.values()].reduce((result, bucket) => { result.revenueMinor += bucket.revenueMinor; result.cogsMinor += bucket.cogsMinor; result.operatingExpensesMinor += bucket.operatingExpensesMinor; result.cashRefundsMinor += bucket.cashRefundsMinor; result.unknownCogsSaleCount += bucket.unknownCogsSaleCount; result.receiptCount += bucket.receiptCount; bucket.tenderMinor.forEach((minor, method) => result.tenderMinor.set(method, (result.tenderMinor.get(method) || 0) + minor)); return result; }, emptyBucket('total'));
  return { parameters: { from: range.from, to: range.to, start: range.start, end: range.end, timeZone: BUSINESS_TIME_ZONE }, monthly, daily, totals: publicBucket(total), payments: [...paymentTotals.values()].sort((a, b) => b.amountMinor - a.amountMinor).map((entry) => ({ method: entry.method, amount: amount(entry.amountMinor), receiptCount: entry.receiptCount })), categories: [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: amount(value) })), allocationWarnings };
}
module.exports = { BUSINESS_TIME_ZONE, amount, assertDateKey, buildFinancialReport, businessDate, businessMidnightUtc, parseRange };
