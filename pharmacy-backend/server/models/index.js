const sequelize = require('../config/db');
const Medicine = require('./Medicine');
const Batch = require('./Batch');
const Sales = require('./Sales');
const User = require('./User');
const Customer = require('./Customer');
const Prescription = require('./Prescription');
const Expense = require('./Expense');
const Supplier = require('./Supplier');
const AuditLog = require('./AuditLog');
const InventoryMovement = require('./InventoryMovement');
const InventoryCategory = require('./InventoryCategory');

// Associations
Medicine.hasMany(Batch, { foreignKey: 'medicineId', onDelete: 'CASCADE' });
Batch.belongsTo(Medicine, { foreignKey: 'medicineId' });

InventoryCategory.hasMany(InventoryCategory, { as: 'Children', foreignKey: 'parentId' });
InventoryCategory.belongsTo(InventoryCategory, { as: 'Parent', foreignKey: 'parentId' });
Medicine.belongsTo(InventoryCategory, { as: 'MainCategory', foreignKey: 'mainCategoryId' });
Medicine.belongsTo(InventoryCategory, { as: 'Subcategory', foreignKey: 'subcategoryId' });
Medicine.belongsTo(InventoryCategory, { as: 'ProductForm', foreignKey: 'productFormId' });

Batch.hasMany(Sales, { foreignKey: 'batchId' });
Sales.belongsTo(Batch, { foreignKey: 'batchId' });

Medicine.hasMany(Sales, { foreignKey: 'medicineId' });
Sales.belongsTo(Medicine, { foreignKey: 'medicineId' });

// Customer Associations
Customer.hasMany(Sales, { foreignKey: 'customerId' });
Sales.belongsTo(Customer, { foreignKey: 'customerId' });

Customer.hasMany(Prescription, { foreignKey: 'customerId' });
Prescription.belongsTo(Customer, { foreignKey: 'customerId' });

// Supplier Associations
Supplier.hasMany(Batch, { foreignKey: 'supplierId' });
Batch.belongsTo(Supplier, { foreignKey: 'supplierId' });

Medicine.hasMany(InventoryMovement, { foreignKey: 'medicineId', onDelete: 'SET NULL' });
InventoryMovement.belongsTo(Medicine, { foreignKey: 'medicineId' });
Batch.hasMany(InventoryMovement, { foreignKey: 'batchId', onDelete: 'SET NULL' });
InventoryMovement.belongsTo(Batch, { foreignKey: 'batchId' });

module.exports = {
  sequelize,
  Medicine,
  Batch,
  Sales,
  User,
  Customer,
  Prescription,
  Expense,
  Supplier
  ,AuditLog
  ,InventoryMovement
  ,InventoryCategory
};
