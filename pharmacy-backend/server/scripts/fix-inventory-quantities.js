const { Medicine, Batch, sequelize } = require('../models');

async function fixQuantities() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const medicines = await Medicine.findAll({
      include: [Batch]
    });

    console.log(`Found ${medicines.length} medicines.`);

    for (const med of medicines) {
      let total = 0;
      if (med.Batches && med.Batches.length > 0) {
        total = med.Batches.reduce((sum, b) => sum + b.quantity, 0);
      }

      if (med.totalQuantity !== total) {
        med.totalQuantity = total;
        await med.save();
        console.log(`Updated ${med.name}: ${total}`);
      }
    }

    console.log('Use of Batches to update Medicine.totalQuantity completed.');

  } catch (error) {
    console.error('Error fixing quantities:', error);
  } finally {
    process.exit();
  }
}

fixQuantities();
