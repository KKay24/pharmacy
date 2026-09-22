const { Injectable, InternalServerErrorException, NotFoundException } = require('@nestjs/common');
const { Expense } = require('../../models');

class ExpensesService {
  async list() { try { return await Expense.findAll({ order: [['date', 'DESC']] }); } catch { throw new InternalServerErrorException('Failed to fetch expenses'); } }
  async create(body) { try { return await Expense.create({ category: body.category, amount: body.amount, description: body.description, date: body.date }); } catch { throw new InternalServerErrorException('Failed to create expense'); } }
  async update(id, body) {
    try {
      const expense = await Expense.findByPk(id);
      if (!expense) throw new NotFoundException('Expense not found');
      await expense.update({ category: body.category, amount: body.amount, description: body.description, date: body.date });
      return expense;
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new InternalServerErrorException('Failed to update expense'); }
  }
  async remove(id) {
    const expense = await Expense.findByPk(id);
    if (!expense) throw new NotFoundException('Expense not found');
    await expense.destroy();
    return { success: true, message: 'Expense deleted' };
  }
}

Injectable()(ExpensesService);
module.exports = ExpensesService;