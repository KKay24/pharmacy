const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-pos-customer-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'pos-customer.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'pos-customer-test-secret-12345';

describe('POS Assign Patient / Customer (Existing, Walking Customer, Register New)', () => {
  let sequelize;
  let Customer;
  let InventoryCategory;
  let Sales;
  let User;
  let CustomersService;
  let CustomersController;
  let InventoryService;
  let SalesService;
  let customersService;
  let inventoryService;
  let salesService;
  let cashierUser;
  let product;
  let ROLE_PERMISSIONS;
  let Permissions;
  let ROLES_KEY;

  before(async () => {
    const { ensureApplicationReady } = require('../src/app.module');
    await ensureApplicationReady();

    const models = require('../models');
    sequelize = models.sequelize;
    Customer = models.Customer;
    InventoryCategory = models.InventoryCategory;
    Sales = models.Sales;
    User = models.User;

    CustomersService = require('../src/customers/customers.service');
    CustomersController = require('../src/customers/customers.controller');
    InventoryService = require('../src/inventory/inventory.service');
    SalesService = require('../src/sales/sales.service');
    ({ ROLE_PERMISSIONS, Permissions } = require('../src/auth/permissions'));
    ({ ROLES_KEY } = require('../src/auth/roles.guard'));
    const { hashPassword } = require('../lib/auth/passwords');

    customersService = new CustomersService();
    inventoryService = new InventoryService();
    salesService = new SalesService();

    cashierUser = await User.create({
      username: 'pos-cashier',
      email: 'pos-cashier@example.test',
      password: hashPassword('CashierPassword123!'),
      role: 'user',
      status: 'active',
    });

    const category = await InventoryCategory.findOne({ where: { level: 1 } });
    product = await inventoryService.add({
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      strength: '500mg',
      mainCategoryId: category.id,
      quantity: 50,
      costPrice: 5,
      sellingPrice: 12,
      expiryDate: '2029-12-31',
    }, cashierUser);
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('Workflow 1: Search existing patient by name, phone, or patient ID and persist REGISTERED sale', async () => {
    const existing = await customersService.create({
      firstName: 'Mwila',
      lastName: 'Phiri',
      phone: '0971112233',
      gender: 'Female',
      dateOfBirth: '1991-06-15',
      address: 'Lusaka East',
    });

    assert.match(existing.patientCode, /^MQP-\d{6}$/);
    assert.equal(existing.name, 'Mwila Phiri');
    assert.equal(existing.firstName, 'Mwila');
    assert.equal(existing.lastName, 'Phiri');

    // Search by name
    const byName = await customersService.list({ q: 'mwila' });
    assert.ok(byName.data.some((c) => c.id === existing.id));

    // Search by phone
    const byPhone = await customersService.list({ q: '971112233' });
    assert.ok(byPhone.data.some((c) => c.id === existing.id));

    // Search by patientCode and numeric ID
    const byCode = await customersService.list({ q: existing.patientCode });
    assert.ok(byCode.data.some((c) => c.id === existing.id));
    const byId = await customersService.search(String(existing.id));
    assert.ok(byId.some((c) => c.id === existing.id));

    // Complete sale for existing registered patient
    const createdSales = await salesService.create({
      customerId: existing.id,
      customerType: 'REGISTERED',
      items: [{
        medicineId: product.id,
        name: product.name,
        quantity: 2,
        totalPrice: 24,
        paymentMethod: 'Cash',
        receiptNumber: 'RCPT-CUST-001',
        clientTransactionId: 'txn-existing-patient-1',
      }],
    }, cashierUser);

    const savedSale = await Sales.findByPk(createdSales[0].id);
    assert.equal(Number(savedSale.customerId), Number(existing.id));
    assert.equal(savedSale.customerType, 'REGISTERED');

    const refreshedCustomer = await Customer.findByPk(existing.id);
    assert.equal(Number(refreshedCustomer.totalPurchases), 24);
  });

  test('Workflow 2: Walking Customer completes sale with WALK_IN type, null customerId, and no new patient row', async () => {
    const customerCountBefore = await Customer.count();

    const walkInSales = await salesService.create({
      customerId: null,
      customerType: 'WALK_IN',
      items: [{
        medicineId: product.id,
        name: product.name,
        quantity: 1,
        totalPrice: 12,
        paymentMethod: 'Cash',
        receiptNumber: 'RCPT-WALKIN-001',
        clientTransactionId: 'txn-walkin-1',
      }],
    }, cashierUser);

    const savedWalkIn = await Sales.findByPk(walkInSales[0].id);
    assert.equal(savedWalkIn.customerId, null);
    assert.equal(savedWalkIn.customerType, 'WALK_IN');
    assert.equal(await Customer.count(), customerCountBefore);

    // Backward compatibility: omitting customerType/customerId defaults to WALK_IN
    const legacySales = await salesService.create({
      items: [{
        medicineId: product.id,
        name: product.name,
        quantity: 1,
        totalPrice: 12,
        paymentMethod: 'Cash',
        receiptNumber: 'RCPT-LEGACY-001',
        clientTransactionId: 'txn-legacy-1',
      }],
    }, cashierUser);
    const savedLegacy = await Sales.findByPk(legacySales[0].id);
    assert.equal(savedLegacy.customerId, null);
    assert.equal(savedLegacy.customerType, 'WALK_IN');

    // Validation rejects contradictory WALK_IN + customerId and REGISTERED without customerId
    await assert.rejects(
      () => salesService.create({
        customerId: 1,
        customerType: 'WALK_IN',
        items: [{
          medicineId: product.id,
          name: product.name,
          quantity: 1,
          totalPrice: 12,
          paymentMethod: 'Cash',
          clientTransactionId: 'txn-bad-walkin',
        }],
      }, cashierUser),
      (err) => err.getStatus?.() === 400
    );

    await assert.rejects(
      () => salesService.create({
        customerType: 'REGISTERED',
        items: [{
          medicineId: product.id,
          name: product.name,
          quantity: 1,
          totalPrice: 12,
          paymentMethod: 'Cash',
          clientTransactionId: 'txn-bad-registered',
        }],
      }, cashierUser),
      (err) => err.getStatus?.() === 400
    );
  });

  test('Workflow 3: Register new patient, block duplicates (normalized phone & name+DOB), and complete sale', async () => {
    const newPatient = await customersService.create({
      firstName: 'Chanda',
      lastName: 'Banda',
      phone: '+260 977 554 433',
      gender: 'male',
      dateOfBirth: '1988-03-22',
      address: 'Kabulonga, Lusaka',
    });

    assert.equal(newPatient.name, 'Chanda Banda');
    assert.equal(newPatient.gender, 'Male');
    assert.equal(newPatient.dateOfBirth, '1988-03-22');
    assert.match(newPatient.patientCode, /^MQP-\d{6}$/);

    // Duplicate check with differently formatted phone number
    await assert.rejects(
      () => customersService.create({
        firstName: 'Chanda',
        lastName: 'Banda',
        phone: '0977554433',
      }),
      (err) => err.getStatus?.() === 409 && err.getResponse?.().existingCustomer?.id === newPatient.id
    );

    // Duplicate check by name + DOB when phone is omitted
    await assert.rejects(
      () => customersService.create({
        firstName: 'chanda',
        lastName: 'banda',
        dateOfBirth: '1988-03-22',
      }),
      (err) => err.getStatus?.() === 409 && err.getResponse?.().existingCustomer?.id === newPatient.id
    );

    // Required field validation
    await assert.rejects(
      () => customersService.create({ firstName: 'OnlyFirst', lastName: '' }),
      (err) => err.getStatus?.() === 400
    );

    // Complete sale for newly registered patient
    const createdSales = await salesService.create({
      customerId: newPatient.id,
      customerType: 'REGISTERED',
      items: [{
        medicineId: product.id,
        name: product.name,
        quantity: 3,
        totalPrice: 36,
        paymentMethod: 'Cash',
        receiptNumber: 'RCPT-NEWPAT-001',
        clientTransactionId: 'txn-new-patient-1',
      }],
    }, cashierUser);

    const persisted = await Sales.findByPk(createdSales[0].id);
    assert.equal(Number(persisted.customerId), Number(newPatient.id));
    assert.equal(persisted.customerType, 'REGISTERED');
  });

  test('Cashier role has customer read/write access and migration 022 is idempotent', async () => {
    assert.ok(ROLE_PERMISSIONS.user.includes(Permissions.CUSTOMERS_READ));
    assert.ok(ROLE_PERMISSIONS.user.includes(Permissions.CUSTOMERS_WRITE));

    const createRoles = Reflect.getMetadata(ROLES_KEY, CustomersController.prototype.create);
    assert.deepEqual(createRoles, ['admin', 'manager', 'user']);

    const { DataTypes } = require('sequelize');
    const migration022 = require('../migrations/022-patient-registration-and-sale-customer-type');
    const queryInterface = sequelize.getQueryInterface();

    // Simulate legacy patient without patientCode and verify migration 022 backfills safely & idempotently
    const legacyCustomer = await Customer.create({
      name: 'Legacy Patient',
      phone: '0966000111',
    });
    await sequelize.query(
      'UPDATE "Customers" SET "patientCode" = NULL, "firstName" = NULL, "lastName" = NULL WHERE "id" = :id',
      { replacements: { id: legacyCustomer.id } }
    );

    await migration022.up({ queryInterface, sequelize, DataTypes });
    await migration022.up({ queryInterface, sequelize, DataTypes });

    const backfilled = await Customer.findByPk(legacyCustomer.id);
    assert.equal(backfilled.patientCode, `MQP-${String(legacyCustomer.id).padStart(6, '0')}`);
    assert.equal(backfilled.firstName, 'Legacy');
    assert.equal(backfilled.lastName, 'Patient');
  });
});
