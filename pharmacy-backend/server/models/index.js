const sequelize = require('../config/db');
const Medicine = require('./Medicine');
const Batch = require('./Batch');
const Sales = require('./Sales');
const SalePayment = require('./SalePayment');
const SaleRefund = require('./SaleRefund');
const CashDrawerReconciliation = require('./CashDrawerReconciliation');
const User = require('./User');
const Customer = require('./Customer');
const Prescription = require('./Prescription');
const Expense = require('./Expense');
const Supplier = require('./Supplier');
const AuditLog = require('./AuditLog');
const AuthAuditLog = require('./AuthAuditLog');
const InventoryMovement = require('./InventoryMovement');
const InventoryCategory = require('./InventoryCategory');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const OrderItemReservation = require('./OrderItemReservation');
const ReplenishmentTask = require('./ReplenishmentTask');
const OrderPaymentEvent = require('./OrderPaymentEvent');
const SupportInquiry = require('./SupportInquiry');
const SearchSynonym = require('./SearchSynonym');
const SearchAnalytics = require('./SearchAnalytics');

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
Sales.belongsTo(User, { as: 'Cashier', foreignKey: 'soldByUserId' });
Sales.belongsTo(User, { as: 'ReversedBy', foreignKey: 'reversedByUserId' });
Sales.hasMany(SalePayment, { as: 'Payments', foreignKey: 'saleId', onDelete: 'CASCADE' });
SalePayment.belongsTo(Sales, { foreignKey: 'saleId' });
Sales.hasMany(SaleRefund, { as: 'Refunds', foreignKey: 'saleId', onDelete: 'RESTRICT' });
SaleRefund.belongsTo(Sales, { foreignKey: 'saleId' });
SalePayment.belongsTo(User, { as: 'ConfirmedBy', foreignKey: 'confirmedByUserId' });

Customer.hasMany(Prescription, { foreignKey: 'customerId' });
Prescription.belongsTo(Customer, { foreignKey: 'customerId' });

Customer.hasMany(Order, { foreignKey: 'customerId' });
Order.belongsTo(Customer, { foreignKey: 'customerId' });

User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });
Order.hasMany(OrderItem, { as: 'OrderItems', foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
Medicine.hasMany(OrderItem, { foreignKey: 'medicineId', onDelete: 'SET NULL' });
OrderItem.belongsTo(Medicine, { foreignKey: 'medicineId' });
OrderItem.hasMany(OrderItemReservation, { as: 'Reservations', foreignKey: 'orderItemId', onDelete: 'CASCADE' });
OrderItemReservation.belongsTo(OrderItem, { foreignKey: 'orderItemId' });
Batch.hasMany(OrderItemReservation, { foreignKey: 'batchId', onDelete: 'RESTRICT' });
OrderItemReservation.belongsTo(Batch, { foreignKey: 'batchId' });
OrderItem.hasOne(ReplenishmentTask, { as: 'ReplenishmentTask', foreignKey: 'orderItemId', onDelete: 'CASCADE' });
ReplenishmentTask.belongsTo(OrderItem, { foreignKey: 'orderItemId' });
Order.hasMany(OrderPaymentEvent, { as: 'PaymentEvents', foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderPaymentEvent.belongsTo(Order, { foreignKey: 'orderId' });

// Supplier Associations
Supplier.hasMany(Batch, { foreignKey: 'supplierId' });
Batch.belongsTo(Supplier, { foreignKey: 'supplierId' });

Medicine.hasMany(InventoryMovement, { foreignKey: 'medicineId', onDelete: 'SET NULL' });
InventoryMovement.belongsTo(Medicine, { foreignKey: 'medicineId' });
Batch.hasMany(InventoryMovement, { foreignKey: 'batchId', onDelete: 'SET NULL' });
InventoryMovement.belongsTo(Batch, { foreignKey: 'batchId' });

Medicine.hasMany(SearchAnalytics, { foreignKey: 'clickedProductId', onDelete: 'SET NULL' });
SearchAnalytics.belongsTo(Medicine, { foreignKey: 'clickedProductId' });

User.hasMany(AuthAuditLog, { foreignKey: 'userId', onDelete: 'SET NULL' });
AuthAuditLog.belongsTo(User, { foreignKey: 'userId', onDelete: 'SET NULL' });

module.exports = {
  sequelize,
  Medicine,
  Batch,
  Sales,
  SalePayment,
  SaleRefund,
  CashDrawerReconciliation,
  User,
  Customer,
  Prescription,
  Expense,
  Supplier,
  AuditLog,
  AuthAuditLog,
  InventoryMovement,
  InventoryCategory,
  Order,
  OrderItem,
  OrderItemReservation,
  ReplenishmentTask,
  OrderPaymentEvent,
  SupportInquiry,
  SearchSynonym,
  SearchAnalytics,
};
