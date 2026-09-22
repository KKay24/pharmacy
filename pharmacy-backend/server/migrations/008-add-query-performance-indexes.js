async function addIndexIfMissing(queryInterface, tableName, fields, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  const name = options.name || `${tableName}_${fields.join('_')}_idx`;
  if (indexes.some((index) => index.name === name)) return;
  await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  version: '008',
  description: 'Add indexes for common list and search queries',
  async up({ queryInterface }) {
    await addIndexIfMissing(queryInterface, 'Sales', ['date'], { name: 'sales_date_idx' });
    await addIndexIfMissing(queryInterface, 'Sales', ['medicineId', 'date'], { name: 'sales_medicine_date_idx' });
    await addIndexIfMissing(queryInterface, 'Sales', ['batchId'], { name: 'sales_batch_idx' });
    await addIndexIfMissing(queryInterface, 'Sales', ['customerId'], { name: 'sales_customer_idx' });
    await addIndexIfMissing(queryInterface, 'Batches', ['medicineId'], { name: 'batches_medicine_idx' });
    await addIndexIfMissing(queryInterface, 'Batches', ['expiryDate'], { name: 'batches_expiry_idx' });
    await addIndexIfMissing(queryInterface, 'Customers', ['name'], { name: 'customers_name_idx' });
    await addIndexIfMissing(queryInterface, 'Customers', ['email'], { name: 'customers_email_idx' });
    await addIndexIfMissing(queryInterface, 'Prescriptions', ['date'], { name: 'prescriptions_date_idx' });
    await addIndexIfMissing(queryInterface, 'Prescriptions', ['customerId'], { name: 'prescriptions_customer_idx' });
    await addIndexIfMissing(queryInterface, 'Prescriptions', ['status'], { name: 'prescriptions_status_idx' });
  },
};