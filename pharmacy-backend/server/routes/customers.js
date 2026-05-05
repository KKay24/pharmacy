const express = require('express');
const router = express.Router();
const { Customer, Sales } = require('../models');

// GET /api/customers - List all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.findAll();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/search?q=...
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const { Op } = require('sequelize');
    const customers = await Customer.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { phone: { [Op.like]: `%${q}%` } }
        ]
      }
    });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/customers - Add new customer
router.post('/', async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ error: 'Failed to add customer' });
  }
});

// GET /api/customers/:id - Get details with history
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [Sales]
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching customer' });
  }
});

module.exports = router;
