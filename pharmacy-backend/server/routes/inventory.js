const express = require('express');
console.log('--- INVENTORY ROUTES LOADED ---');
const router = express.Router();
const { Medicine, Batch, sequelize } = require('../models');

// GET /api/inventory - Get all medicines with their batches
router.get('/', async (req, res) => {
  try {
    const medicines = await Medicine.findAll({
      order: [['name', 'ASC']],
      include: [
        {
          model: Batch
        }
      ]
    });
    
    // Flatten logic for frontend compatibility if needed, 
    // but better to send structured data and let frontend handle it.
    // For now, let's send the structured data.
    res.json(medicines);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching inventory' });
  }
});

// GET /api/inventory/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const medicines = await Medicine.findAll({ include: [Batch] });
    const lowStock = medicines.filter(med => {
         const total = med.Batches.reduce((acc, b) => acc + b.quantity, 0);
         return total <= med.lowStockThreshold;
    });
    res.json(lowStock);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching low stock' });
  }
});

// POST /api/inventory/batch - Batch ingestion of stock
router.post('/batch', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, supplier, warehouse, invoiceNumber, receivedDate } = req.body;
    
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    const createdItems = [];

    for (const item of items) {
      const { 
        name, genericName, category, dosage, strength, 
        barcode, threshold, 
        quantity, expiryDate, costPrice, sellingPrice
      } = item;

      let medicine = await Medicine.findOne({ where: { name } });

      if (!medicine) {
        medicine = await Medicine.create({
          name, genericName, category, dosage, strength,
          supplier: supplier || item.supplier, 
          manufacturer: item.manufacturer,
          barcode,
          lowStockThreshold: threshold || 10
        }, { transaction: t });
      }

      const batch = await Batch.create({
        medicineId: medicine.id,
        batchNumber: item.batchNumber || `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        quantity: Number(quantity),
        expiryDate,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        warehouse,
        invoiceNumber,
        receivedDate: receivedDate || new Date()
      }, { transaction: t });

      createdItems.push({ medicine, batch });
    }

    await t.commit();
    res.status(201).json({ success: true, count: createdItems.length });

  } catch (err) {
    if (t) await t.rollback();
    console.error('Batch Add Error:', err);
    res.status(500).json({ error: err.message || 'Failed to process batch inventory' });
  }
});

// POST /api/inventory - Add new Medicine OR Add Batch to existing
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { 
      name, genericName, category, dosage, strength, supplier, manufacturer, 
      barcode, threshold, imageUrl,
      batchNumber, quantity, expiryDate, costPrice, sellingPrice
    } = req.body;

    // Check if medicine exists by name (or barcode?)
    let medicine = await Medicine.findOne({ where: { name } });

    if (!medicine) {
      medicine = await Medicine.create({
        name,
        genericName,
        category,
        dosage,
        strength,
        supplier,
        manufacturer,
        barcode,
        imageUrl,
        lowStockThreshold: threshold || 10
      }, { transaction: t });
    } else {
        // Update medicine details if provided? 
        // For now, assume if name matches, we just add stock to it.
    }

    // Create Batch
    if (batchNumber && quantity) {
      await Batch.create({
        medicineId: medicine.id,
        batchNumber,
        quantity: Number(quantity),
        expiryDate,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice)
      }, { transaction: t });
    }

    await t.commit();
    
    // Return complete medicine object
    const updated = await Medicine.findByPk(medicine.id, { include: [Batch] });
    res.status(201).json(updated);

  } catch (err) {
    await t.rollback();
    console.error('Inventory Add Error:', err);
    res.status(500).json({ error: err.message || 'Failed to add inventory' });
  }
});

// PUT /api/inventory/:id - Update Medicine details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Updating Medicine ID: ${id}. req.body.imageUrl length: ${req.body.imageUrl ? req.body.imageUrl.length : 0}`);
    
    await Medicine.update(req.body, { where: { id } });
    
    // If sellingPrice or costPrice is provided, update all batches for this medicine
    // This simplifies "Edit Price" for the user.
    if (req.body.sellingPrice !== undefined) {
        await Batch.update(
            { sellingPrice: req.body.sellingPrice }, 
            { where: { medicineId: id } }
        );
    }
    if (req.body.costPrice !== undefined) {
        await Batch.update(
            { costPrice: req.body.costPrice }, 
            { where: { medicineId: id } }
        );
    }

    // Handle Quantity Adjustment
    if (req.body.totalQuantity !== undefined) {
        const medicine = await Medicine.findByPk(id, { include: [Batch] });
        if (medicine) {
            const currentTotal = medicine.Batches 
                ? medicine.Batches.reduce((acc, b) => acc + b.quantity, 0)
                : 0;
            
            const newTotal = Number(req.body.totalQuantity);
            const diff = newTotal - currentTotal;

            if (diff !== 0) {
                // Create adjustment batch
                await Batch.create({
                    medicineId: id,
                    batchNumber: `ADJ-${Date.now()}`,
                    quantity: diff,
                    expiryDate: new Date(), // Adjustment expires now? Or should prompt? Defaulting to "now" for sorting.
                    // Or typically adjustments don't have expiration, but field is probably required/date.
                    // Let's set it to far future or current date to keep it valid. 
                    // Better yet, copy the expiry from the latest batch?
                    // For simplicity, let's use Today.
                    costPrice: req.body.costPrice || 0, 
                    sellingPrice: req.body.sellingPrice || 0
                });
                
                // Update totalQuantity field on Medicine model
                medicine.totalQuantity = newTotal;
                await medicine.save();
            }
        }
    }

    // Handle individual batches update (e.g. expiryDate, batchNumber, warehouse)
    if (Array.isArray(req.body.Batches)) {
        for (const batchData of req.body.Batches) {
            if (batchData.id) {
                console.log(`[DEBUG] Updating Batch ID: ${batchData.id} with expiryDate: ${batchData.expiryDate}, batchNumber: ${batchData.batchNumber}`);
                await Batch.update({
                    batchNumber: batchData.batchNumber,
                    expiryDate: batchData.expiryDate,
                    warehouse: batchData.warehouse
                }, { where: { id: batchData.id } });
            }
        }
    }
    
    const updated = await Medicine.findByPk(id, { include: [Batch] });
    res.json(updated);
  } catch (err) {
    console.error("PUT Error:", err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /api/inventory/:id - Delete Medicine (and cascades batches)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Medicine.destroy({ where: { id } });
    res.json({ message: 'Medicine deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
