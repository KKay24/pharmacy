const { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Expense } = require('../../models');
const { assertDateKey, businessMidnightUtc } = require('../../services/financial/reporting');

const CATEGORIES = new Set(['Operating', 'Payroll', 'Rent', 'Utilities', 'Other']);
function parseAmount(value) {
  if (typeof value === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new BadRequestException('Expense amount must have at most two decimal places');
  const numeric = Number(value); const amountMinor = Math.round(numeric * 100);
  if (!Number.isFinite(numeric) || numeric <= 0 || Math.abs(numeric * 100 - amountMinor) > 1e-7) throw new BadRequestException('Expense amount must be greater than zero and rounded to ngwee');
  return { amount: amountMinor / 100, amountMinor };
}
function validate(body) {
  const category = typeof body?.category === 'string' ? body.category.trim() : '';
  if (!CATEGORIES.has(category)) throw new BadRequestException('Expense category is invalid');
  let dateKey;
  try { dateKey = assertDateKey(String(body?.date || '').slice(0, 10), 'Expense date'); } catch (error) { throw new BadRequestException(error.message); }
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  if (description.length > 500) throw new BadRequestException('Expense description must not exceed 500 characters');
  return { category, ...parseAmount(body.amount), description: description || null, date: businessMidnightUtc(dateKey) };
}

class ExpensesService {
  async list() { try { return await Expense.findAll({ where: { voidedAt: null }, order: [['date', 'DESC']] }); } catch { throw new InternalServerErrorException('Failed to fetch expenses'); } }
  async create(body, actor) {
    try { return await Expense.create({ ...validate(body), createdByUserId: actor?.id || null }); }
    catch (error) { if (error instanceof BadRequestException) throw error; throw new InternalServerErrorException('Failed to create expense'); }
  }
  async update(id, body, actor) {
    try {
      const expense = await Expense.findByPk(id);
      if (!expense) throw new NotFoundException('Expense not found');
      if (expense.voidedAt) throw new ConflictException('Voided expenses cannot be changed');
      const next = validate(body);
      const changed = expense.category !== next.category || Number(expense.amountMinor) !== next.amountMinor || expense.description !== next.description || new Date(expense.date).getTime() !== next.date.getTime();
      const reason = typeof body?.correctionReason === 'string' ? body.correctionReason.trim() : '';
      if (changed && reason.length < 3) throw new BadRequestException('A correction reason of at least 3 characters is required');
      await expense.update({ ...next, correctedAt: changed ? new Date() : expense.correctedAt, correctedByUserId: changed ? actor?.id || null : expense.correctedByUserId, correctionReason: changed ? reason : expense.correctionReason });
      return expense;
    } catch (error) { if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) throw error; throw new InternalServerErrorException('Failed to update expense'); }
  }
  async void(id, reasonInput, actor) {
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (reason.length < 3) throw new BadRequestException('A void reason of at least 3 characters is required');
    const expense = await Expense.findByPk(id);
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.voidedAt) throw new ConflictException('Expense is already voided');
    await expense.update({ voidedAt: new Date(), voidedByUserId: actor?.id || null, voidReason: reason });
    return { success: true, message: 'Expense voided; its audit record was retained' };
  }
}
Injectable()(ExpensesService);
module.exports = ExpensesService;
