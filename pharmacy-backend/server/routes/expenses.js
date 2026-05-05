const express = require('express');
const router = express.Router();
const { Expense } = require('../models');

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.findAll({ order: [['date', 'DESC']] });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { category, amount, description, date } = req.body;
    const expense = await Expense.create({ category, amount, description, date });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, amount, description, date } = req.body;
    const expense = await Expense.findByPk(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    
    await expense.update({ category, amount, description, date });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByPk(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    
    await expense.destroy();
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
