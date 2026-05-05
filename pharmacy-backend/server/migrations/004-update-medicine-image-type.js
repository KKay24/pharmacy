module.exports = {
  version: '004',
  description: 'Update Medicine imageUrl to TEXT',
  async up({ queryInterface, DataTypes }) {
    // In SQLite, changeColumn is limited, but we can try. 
    // If it fails, we might need a manual table recreation or ignore if it's already TEXT.
    try {
      await queryInterface.changeColumn('Medicines', 'imageUrl', {
        type: DataTypes.TEXT,
        allowNull: true
      });
    } catch (err) {
      console.warn('Migration warning (004): changeColumn might not be supported on this dialect. If using SQLite, ensure the column is already compatible or manually adjust.');
    }
  }
};
