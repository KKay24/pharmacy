const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Batch, Medicine, sequelize } = require('../models');
const { buildProductKey } = require('../src/inventory/product-identity');

async function auditInventoryDuplicates() {
  await sequelize.authenticate();

  const medicines = await Medicine.findAll({
    attributes: ['id', 'name', 'genericName', 'strength', 'dosage', 'manufacturer'],
    raw: true,
  });
  const medicineGroups = new Map();
  for (const medicine of medicines) {
    const key = buildProductKey(medicine);
    const group = medicineGroups.get(key) || [];
    group.push(medicine);
    medicineGroups.set(key, group);
  }

  const duplicateMedicines = [...medicineGroups.values()].filter((group) => group.length > 1);
  const duplicateBatches = await sequelize.query(
    'SELECT "medicineId", "batchNumber", COUNT(*) AS "count" FROM "Batches" GROUP BY "medicineId", "batchNumber" HAVING COUNT(*) > 1',
    { type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({
    duplicateMedicineIdentityGroups: duplicateMedicines,
    duplicateBatchKeys: duplicateBatches,
    guidance: duplicateMedicines.length || duplicateBatches.length
      ? 'Do not delete records automatically. Reassign batches only after reconciling quantities and preserving related sales, then archive or merge through an approved manual process.'
      : 'No duplicate medicine identity groups or batch keys found.',
  }, null, 2));

  return duplicateMedicines.length || duplicateBatches.length ? 2 : 0;
}

auditInventoryDuplicates()
  .then((exitCode) => { process.exitCode = exitCode; })
  .catch((error) => {
    console.error('Inventory duplicate audit failed:', error.name);
    process.exitCode = 1;
  })
  .finally(async () => { await sequelize.close(); });
