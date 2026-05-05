const express = require('express');
const router = express.Router();
const { Prescription, Customer } = require('../models');

// GET /api/prescriptions - All prescriptions
router.get('/', async (req, res) => {
  try {
    const prescriptions = await Prescription.findAll({
      include: [Customer],
      order: [['date', 'DESC']]
    });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// POST /api/prescriptions - Upload/Create
router.post('/', async (req, res) => {
  try {
    const prescription = await Prescription.create(req.body);
    res.status(201).json(prescription);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create prescription' });
  }
});

// PUT /api/prescriptions/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const item = await Prescription.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    await item.update({ status });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
