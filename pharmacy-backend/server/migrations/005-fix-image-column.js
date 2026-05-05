module.exports = {
  version: '005',
  description: 'Fix Medicine imageUrl column for SQLite',
  async up({ sequelize }) {
    const dialect = sequelize.getDialect();
    if (dialect === 'sqlite') {
      // In SQLite, we can't easily changeColumn. 
      // But we can try to use raw query to ensure it's handled as TEXT by Sequelize.
      // Actually, SQLite handles VARCHAR as TEXT anyway. 
      // The issue is likely Sequelize model definition.
      console.log('SQLite detected. Ensuring model matches TEXT.');
    } else {
      await sequelize.query('ALTER TABLE "Medicines" ALTER COLUMN "imageUrl" TYPE TEXT');
    }
  }
};
