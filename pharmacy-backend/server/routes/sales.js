const express = require('express');
const router = express.Router();
const { Sales, Medicine, Batch, sequelize } = require('../models');
const { Op } = require('sequelize');

// GET /api/sales - Get recent sales
router.get('/', async (req, res) => {
  try {
    const sales = await Sales.findAll({
      order: [['date', 'DESC']],
      limit: 100
    });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// POST /api/sales - Record a new sale (Single or Bulk)
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const createdSales = [];

    for (const item of items) {
        const { 
          medicineId, 
          name, 
          quantity, 
          totalPrice, 
          paymentMethod,
          customerId,
          receiptNumber
        } = item;
    
        const qty = Number(quantity);
        let med;
    
        if (medicineId) {
          med = await Medicine.findByPk(medicineId, { include: [Batch] });
        } else {
          med = await Medicine.findOne({ 
            where: { name }, 
            include: [Batch] 
          });
        }
    
        if (!med) {
          throw new Error(`Product not found: ${name}`);
        }
    
        // Sort batches: Expiry ASC
        let batches = med.Batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        let remainingToDeduct = qty;
        let totalCost = 0;
        
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;
          if (batch.quantity <= 0) continue;
    
          const deduct = Math.min(batch.quantity, remainingToDeduct);
          
          // Update batch
          batch.quantity -= deduct;
          await batch.save({ transaction: t });
          
          // Calculate COGS
          totalCost += (batch.costPrice * deduct);
          
          remainingToDeduct -= deduct;
        }
    
        if (remainingToDeduct > 0) {
           throw new Error(`Not enough stock for ${med.name}`);
        }
    
        const newSale = await Sales.create({
            name: med.name,
            medicineId: med.id, // Explicitly link
            customerId: customerId || null,
            quantity: qty,
            totalPrice: Number(totalPrice),
            totalCost: totalCost,
            paymentMethod: paymentMethod || 'Cash',
            receiptNumber: receiptNumber || null,
            date: new Date()
        }, { transaction: t });
        
        createdSales.push(newSale);
    }

    await t.commit();
    // Return array if input was array, or single object if input was single
    if (Array.isArray(req.body)) {
        res.status(201).json(createdSales);
    } else {
        res.status(201).json(createdSales[0]);
    }

  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to record sale' });
  }
});

module.exports = router;
