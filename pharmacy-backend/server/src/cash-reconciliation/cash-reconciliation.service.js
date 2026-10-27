const { BadRequestException, ConflictException, Injectable, InternalServerErrorException } = require('@nestjs/common');
const { CashDrawerReconciliation, SaleRefund } = require('../../models');
const { assertDateKey, buildFinancialReport, businessMidnightUtc, parseRange } = require('../../services/financial/reporting');

function parseCountedCash(value) {
  if (typeof value === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new BadRequestException('Counted cash must have at most two decimal places');
  const numeric = Number(value); const minor = Math.round(numeric * 100);
  if (!Number.isFinite(numeric) || numeric < 0 || Math.abs(numeric * 100 - minor) > 1e-7) throw new BadRequestException('Counted cash must be a non-negative ngwee amount');
  return minor;
}
class CashReconciliationService {
  async expectedCash(date) {
    const report = await buildFinancialReport({ from: date, to: date });
    const cashPaymentsMinor = Math.round(Number(report.payments.find((payment) => payment.method === 'Cash')?.amount || 0) * 100);
    const range = parseRange({ from: date, to: date });
    const cashRefunds = await SaleRefund.findAll({ where: { financialDate: range.salesWhere.date, method: 'Cash', status: 'CONFIRMED' } });
    const cashRefundMinor = cashRefunds.reduce((sum, refund) => sum + Number(refund.amountMinor || 0), 0);
    return { expectedCashMinor: cashPaymentsMinor - cashRefundMinor, allocationWarnings: report.allocationWarnings };
  }
  async list() { return CashDrawerReconciliation.findAll({ order: [['businessDate', 'DESC']] }); }
  async close(body, actor) {
    let businessDate;
    try { businessDate = assertDateKey(String(body?.businessDate || '').slice(0, 10), 'businessDate'); } catch (error) { throw new BadRequestException(error.message); }
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
    if (notes.length > 1000) throw new BadRequestException('Reconciliation notes must not exceed 1000 characters');
    const countedCashMinor = parseCountedCash(body?.countedCash);
    try {
      const existing = await CashDrawerReconciliation.findOne({ where: { businessDate } });
      if (existing) throw new ConflictException('This business day has already been reconciled and is immutable');
      const expected = await this.expectedCash(businessDate);
      if (expected.allocationWarnings.length) throw new ConflictException('Cash cannot be reconciled while receipt payment allocations are incomplete');
      const varianceMinor = countedCashMinor - expected.expectedCashMinor;
      return await CashDrawerReconciliation.create({ businessDate, expectedCashMinor: expected.expectedCashMinor, countedCashMinor, varianceMinor, notes: notes || null, closedByUserId: actor?.id, closedAt: new Date() });
    } catch (error) { if (error instanceof BadRequestException || error instanceof ConflictException) throw error; throw new InternalServerErrorException('Failed to close cash drawer'); }
  }
}
Injectable()(CashReconciliationService);
module.exports = CashReconciliationService;
