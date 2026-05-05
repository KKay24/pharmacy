const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'pharmacy.sqlite');
const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const shouldReplace = process.argv.includes('--replace');

if (!postgresUrl) {
  console.error('Missing POSTGRES_URL or DATABASE_URL.');
  console.error('Set one of them, then rerun this script.');
  process.exit(1);
}

const makeSqlite = () =>
  new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: false
  });

const makePostgres = () =>
  new Sequelize(postgresUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });

function defineModels(sequelize) {
  const Medicine = sequelize.define('Medicine', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    genericName: DataTypes.STRING,
    category: DataTypes.STRING,
    strength: DataTypes.STRING,
    dosage: DataTypes.STRING,
    supplier: DataTypes.STRING,
    manufacturer: DataTypes.STRING,
    prescriptionRequired: { type: DataTypes.BOOLEAN, defaultValue: false },
    barcode: DataTypes.STRING,
    lowStockThreshold: { type: DataTypes.INTEGER, defaultValue: 10 },
    totalQuantity: { type: DataTypes.INTEGER, defaultValue: 0 }
  });

  const Batch = sequelize.define('Batch', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    medicineId: { type: DataTypes.INTEGER, allowNull: false },
    batchNumber: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expiryDate: { type: DataTypes.DATEONLY, allowNull: false },
    costPrice: { type: DataTypes.FLOAT, defaultValue: 0 },
    sellingPrice: { type: DataTypes.FLOAT, defaultValue: 0 },
    receivedDate: DataTypes.DATEONLY
  });

  Medicine.hasMany(Batch, { foreignKey: 'medicineId', onDelete: 'CASCADE' });
  Batch.belongsTo(Medicine, { foreignKey: 'medicineId' });

  return { Medicine, Batch };
}

function toPlain(records) {
  return records.map((record) => record.get({ plain: true }));
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

async function resetSequence(targetDb, table) {
  const sql =
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ` +
    `COALESCE((SELECT MAX(id) FROM "${table}"), 1), true);`;
  await targetDb.query(sql);
}

async function run() {
  const sourceDb = makeSqlite();
  const targetDb = makePostgres();

  try {
    console.log(`Reading local SQLite from: ${sqlitePath}`);
    console.log('Connecting to target PostgreSQL...');
    await sourceDb.authenticate();
    await targetDb.authenticate();

    const source = defineModels(sourceDb);
    const target = defineModels(targetDb);

    // Ensure destination schema exists.
    await targetDb.sync();

    const sourceMedicines = toPlain(
      await source.Medicine.findAll({
        order: [['id', 'ASC']]
      })
    );
    const sourceBatches = toPlain(
      await source.Batch.findAll({
        order: [['id', 'ASC']]
      })
    );

    console.log(`Local inventory snapshot: ${sourceMedicines.length} medicines, ${sourceBatches.length} batches`);

    const quantityByMedicine = new Map();
    for (const batch of sourceBatches) {
      const current = quantityByMedicine.get(batch.medicineId) || 0;
      quantityByMedicine.set(batch.medicineId, current + (batch.quantity || 0));
    }

    const now = new Date();
    const medicineRows = sourceMedicines.map((med) => ({
      id: med.id,
      name: med.name,
      genericName: med.genericName,
      category: med.category,
      strength: med.strength,
      dosage: med.dosage,
      supplier: med.supplier,
      manufacturer: med.manufacturer,
      prescriptionRequired: Boolean(med.prescriptionRequired),
      barcode: med.barcode,
      lowStockThreshold: med.lowStockThreshold ?? 10,
      totalQuantity: quantityByMedicine.get(med.id) || 0,
      createdAt: med.createdAt || now,
      updatedAt: now
    }));
    const batchRows = sourceBatches.map((batch) => ({
      id: batch.id,
      medicineId: batch.medicineId,
      batchNumber: batch.batchNumber,
      quantity: batch.quantity ?? 0,
      expiryDate: batch.expiryDate,
      costPrice: batch.costPrice ?? 0,
      sellingPrice: batch.sellingPrice ?? 0,
      receivedDate: batch.receivedDate || null,
      createdAt: batch.createdAt || now,
      updatedAt: now
    }));

    const transaction = await targetDb.transaction();
    try {
      if (shouldReplace) {
        console.log('Replace mode ON: clearing target Batches and Medicines before sync...');
        await target.Batch.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true, transaction });
        await target.Medicine.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true, transaction });
      }

      const medicineChunks = chunkRows(medicineRows, 200);
      for (let i = 0; i < medicineChunks.length; i += 1) {
        await target.Medicine.bulkCreate(medicineChunks[i], {
          updateOnDuplicate: [
            'name',
            'genericName',
            'category',
            'strength',
            'dosage',
            'supplier',
            'manufacturer',
            'prescriptionRequired',
            'barcode',
            'lowStockThreshold',
            'totalQuantity',
            'updatedAt'
          ],
          transaction
        });
        console.log(`Synced medicines chunk ${i + 1}/${medicineChunks.length}`);
      }

      const batchChunks = chunkRows(batchRows, 250);
      for (let i = 0; i < batchChunks.length; i += 1) {
        await target.Batch.bulkCreate(batchChunks[i], {
          updateOnDuplicate: [
            'medicineId',
            'batchNumber',
            'quantity',
            'expiryDate',
            'costPrice',
            'sellingPrice',
            'receivedDate',
            'updatedAt'
          ],
          transaction
        });
        console.log(`Synced batches chunk ${i + 1}/${batchChunks.length}`);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    await resetSequence(targetDb, 'Medicines');
    await resetSequence(targetDb, 'Batches');

    console.log('Sync complete.');
    console.log('Your deployed backend should now show the same inventory data.');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exitCode = 1;
  } finally {
    await sourceDb.close();
    await targetDb.close();
  }
}

run();
