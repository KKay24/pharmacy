const express = require('express');
const router = express.Router();
const { Supplier } = require('../models');

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({ order: [['name', 'ASC']] });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// POST new supplier
router.post('/', async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    await supplier.update(req.body);
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    await supplier.destroy();
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

module.exports = router;
