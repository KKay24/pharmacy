const { Medicine, Batch, sequelize } = require('../models');

async function verify() {
  try {
    await sequelize.authenticate();
    
    const medCount = await Medicine.count();
    const batchCount = await Batch.count();
    
    console.log(`Total Medicines: ${medCount}`);
    console.log(`Total Batches: ${batchCount}`);
    
    const sample = await Medicine.findOne({ 
        where: { name: 'TRIPHEN 4 FLU 100ML' },
        include: [Batch]
    });
    
    if (sample) {
        console.log('Sample Item Found:', JSON.stringify(sample.toJSON(), null, 2));
    } else {
        console.log('Sample Item NOT Found!');
    }

  } catch (err) {
    console.error(err);
  } finally {
     process.exit();
  }
}

verify();
