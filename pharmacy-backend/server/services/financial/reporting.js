const { Op } = require('sequelize');
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
function parseRange(query = {}) {
  const from = query.from ? assertDateKey(String(query.from).slice(0, 10), 'from') : null;
  const to = query.to ? assertDateKey(String(query.to).slice(0, 10), 'to') : null;
  if (from && to && from > to) throw new Error('from must be on or before to');
  const date = from || to ? { ...(from ? { [Op.gte]: businessMidnightUtc(from) } : {}), ...(to ? { [Op.lt]: businessMidnightUtc(nextDateKey(to)) } : {}) } : null;
  return { from, to, salesWhere: date ? { date } : {} };
}
function toMinor(value) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed) : null; }
function amount(minor) { return Number((Number(minor || 0) / 100).toFixed(2)); }
function emptyBucket(period) { return { period, revenueMinor: 0, cogsMinor: 0, operatingExpensesMinor: 0, cashRefundsMinor: 0, unknownCogsSaleIds: [], receiptIds: new Set(), tenderMinor: new Map() }; }
function publicBucket(bucket) {
  const cogsKnown = bucket.unknownCogsSaleIds.length === 0;
  const revenue = amount(bucket.revenueMinor);
  const cogs = cogsKnown ? amount(bucket.cogsMinor) : null;
  const operatingExpenses = amount(bucket.operatingExpensesMinor);
  return { month: bucket.period, revenue, cogs, grossProfit: cogsKnown ? Number((revenue - cogs).toFixed(2)) : null, operatingExpenses, netProfit: cogsKnown ? Number((revenue - cogs - operatingExpenses).toFixed(2)) : null, cashRefunds: amount(bucket.cashRefundsMinor), cogsKnown, unknownCogsSaleCount: bucket.unknownCogsSaleIds.length, receiptCount: bucket.receiptIds.size, payments: [...bucket.tenderMinor.entries()].map(([method, minor]) => ({ method, amount: amount(minor) })) };
}

async function buildFinancialReport(query = {}) {
  const range = parseRange(query);
  const [sales, expenses, refunds] = await Promise.all([
    Sales.findAll({ where: range.salesWhere, order: [['date', 'ASC'], ['id', 'ASC']] }),
    Expense.findAll({ where: { ...(range.salesWhere.date ? { date: range.salesWhere.date } : {}), voidedAt: null }, order: [['date', 'ASC']] }),
    SaleRefund.findAll({ where: range.salesWhere.date ? { financialDate: range.salesWhere.date } : {}, order: [['financialDate', 'ASC']] }),
  ]);
  const saleIds = sales.map((sale) => sale.id);
  const medicineIds = [...new Set(sales.map((sale) => sale.medicineId).filter(Boolean))];
  const [payments, medicines] = await Promise.all([
    saleIds.length ? SalePayment.findAll({ where: { saleId: saleIds }, order: [['id', 'ASC']] }) : [],
    medicineIds.length ? Medicine.findAll({ where: { id: medicineIds }, attributes: ['id', 'category', 'mainCategoryId'] }) : [],
  ]);
  const categories = new Map(medicines.map((medicine) => [medicine.id, medicine.category || (medicine.mainCategoryId ? `Category #${medicine.mainCategoryId}` : 'Unclassified')]));
  const saleById = new Map(sales.map((sale) => [sale.id, sale]));
  const receiptKey = (sale) => sale.receiptNumber ? `receipt:${sale.receiptNumber}` : `sale:${sale.id}`;
  const receipts = new Map();
  sales.forEach((sale) => {
    const key = receiptKey(sale);
    if (!receipts.has(key)) receipts.set(key, { key, rows: [], paymentRows: [] });
    receipts.get(key).rows.push(sale);
  });
  payments.forEach((payment) => {
    const sale = saleById.get(payment.saleId);
    if (sale) receipts.get(receiptKey(sale))?.paymentRows.push(payment);
  });
  const months = new Map(); const days = new Map(); const paymentTotals = new Map(); const categoryTotals = new Map(); const allocationWarnings = [];
  const ensure = (map, key) => { if (!map.has(key)) map.set(key, emptyBucket(key)); return map.get(key); };
  for (const receipt of receipts.values()) {
    if (!receipt.rows.every((sale) => (sale.saleStatus || 'COMPLETED') === 'COMPLETED')) continue;
    const revenueMinor = receipt.rows.reduce((sum, sale) => sum + (toMinor(sale.totalPriceMinor) ?? Math.round(Number(sale.totalPrice || 0) * 100)), 0);
    const month = ensure(months, businessMonth(receipt.rows[0].date)); const day = ensure(days, businessDate(receipt.rows[0].date));
    [month, day].forEach((bucket) => { bucket.revenueMinor += revenueMinor; bucket.receiptIds.add(receipt.key); });
    let cogsKnown = true; let cogsMinor = 0;
    receipt.rows.forEach((sale) => {
      const cost = toMinor(sale.totalCostMinor);
      if (cost === null) { cogsKnown = false; month.unknownCogsSaleIds.push(sale.id); day.unknownCogsSaleIds.push(sale.id); } else cogsMinor += cost;
      const category = categories.get(sale.medicineId) || 'Unclassified';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + (toMinor(sale.totalPriceMinor) ?? Math.round(Number(sale.totalPrice || 0) * 100)));
    });
    if (cogsKnown) { month.cogsMinor += cogsMinor; day.cogsMinor += cogsMinor; }
    const paidMinor = receipt.paymentRows.reduce((sum, payment) => sum + (toMinor(payment.amountMinor) || 0), 0);
    if (!receipt.paymentRows.length || paidMinor !== revenueMinor) allocationWarnings.push({ receiptNumber: receipt.rows[0].receiptNumber || null, saleIds: receipt.rows.map((sale) => sale.id), revenue: amount(revenueMinor), allocatedPayments: amount(paidMinor) });
    receipt.paymentRows.forEach((payment) => {
      const method = payment.method || 'Unknown'; const entry = paymentTotals.get(method) || { method, amountMinor: 0, receiptIds: new Set() };
      const paymentMinor = toMinor(payment.amountMinor) || 0;
      entry.amountMinor += paymentMinor; entry.receiptIds.add(receipt.key); paymentTotals.set(method, entry);
      [month, day].forEach((bucket) => bucket.tenderMinor.set(method, (bucket.tenderMinor.get(method) || 0) + paymentMinor));
    });
  }
  expenses.forEach((expense) => {
    const value = toMinor(expense.amountMinor); if (value === null) return;
    [ensure(days, businessDate(expense.date)), ensure(months, businessMonth(expense.date))].forEach((bucket) => { bucket.operatingExpensesMinor += value; });
  });
  refunds.forEach((refund) => {
    if (refund.status !== 'CONFIRMED') return;
    const value = toMinor(refund.amountMinor) || 0;
    // A reversal already removes revenue; a refund is a separately reported cash outflow.
    [ensure(days, businessDate(refund.financialDate)), ensure(months, businessMonth(refund.financialDate))].forEach((bucket) => { bucket.cashRefundsMinor += value; });
  });
  const monthly = [...months.values()].sort((a, b) => a.period.localeCompare(b.period)).map(publicBucket);
  const daily = [...days.values()].sort((a, b) => a.period.localeCompare(b.period)).map((bucket) => ({ ...publicBucket(bucket), date: bucket.period }));
  const total = [...months.values()].reduce((result, bucket) => { result.revenueMinor += bucket.revenueMinor; result.cogsMinor += bucket.cogsMinor; result.operatingExpensesMinor += bucket.operatingExpensesMinor; result.cashRefundsMinor += bucket.cashRefundsMinor; result.unknownCogsSaleIds.push(...bucket.unknownCogsSaleIds); bucket.receiptIds.forEach((id) => result.receiptIds.add(id)); bucket.tenderMinor.forEach((minor, method) => result.tenderMinor.set(method, (result.tenderMinor.get(method) || 0) + minor)); return result; }, emptyBucket('total'));
  return { parameters: { from: range.from, to: range.to, timeZone: BUSINESS_TIME_ZONE }, monthly, daily, totals: publicBucket(total), payments: [...paymentTotals.values()].sort((a, b) => b.amountMinor - a.amountMinor).map((entry) => ({ method: entry.method, amount: amount(entry.amountMinor), receiptCount: entry.receiptIds.size })), categories: [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: amount(value) })), allocationWarnings };
}
module.exports = { BUSINESS_TIME_ZONE, amount, assertDateKey, buildFinancialReport, businessDate, businessMidnightUtc, parseRange };
