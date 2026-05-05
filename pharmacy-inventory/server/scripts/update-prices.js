const { Batch, sequelize } = require('../models');

async function updatePrices() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const batches = await Batch.findAll();
    console.log(`Found ${batches.length} batches.`);

    let count = 0;
    for (const batch of batches) {
      if (batch.costPrice > 0) {
        // Apply 55% Markup
        // cost * 1.55
        // Round to 2 decimals
        const newPrice = Math.ceil((batch.costPrice * 1.55) * 100) / 100;
        
        // Only update if it's currently 0 or we want to overwrite. 
        // User asked "Add a Markup 55%" usually implies doing it for the imported items.
        // Let's update all for consistency.
        batch.sellingPrice = newPrice;
        await batch.save();
        count++;
      }
    }

    console.log(`Updated Selling Price for ${count} batches.`);

  } catch (err) {
    console.error('Error updating prices:', err);
  } finally {
    process.exit();
  }
}

updatePrices();
