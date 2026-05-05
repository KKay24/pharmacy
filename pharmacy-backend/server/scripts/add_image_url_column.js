const { sequelize } = require('../models');

async function migrate() {
    try {
        console.log('Adding imageUrl column to Medicines table...');
        // Correcting table name case if necessary (Sequelize usually uses pluralized names)
        await sequelize.query('ALTER TABLE Medicines ADD COLUMN imageUrl VARCHAR(255);');
        console.log('Column added successfully!');
        process.exit(0);
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column already exists.');
            process.exit(0);
        }
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
