const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

let app;
let server;
let baseUrl;
const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-store-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'store.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'true';
process.env.JWT_SECRET = 'store-test-secret-value-12345';

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

describe('Store E-Commerce Endpoints', () => {
  before(async () => {
    const { AppModule, ensureApplicationReady } = require('../src/app.module');
    const { NestFactory } = require('@nestjs/core');

    await ensureApplicationReady();
    app = await NestFactory.create(AppModule, { logger: false });
    server = app.getHttpAdapter().getInstance();
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://localhost:${address.port}`;
  });

  after(async () => {
    if (app) await app.close();
    const { sequelize } = require('../models');
    await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('GET /api/products returns paginated customer products without inventory levels', async () => {
    const res = await request('/api/products?limit=5');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data));
    assert.ok(res.data.data.length > 0);
    assert.ok(res.data.pagination);
    assert.ok(res.data.pagination.total > 0);

    const first = res.data.data[0];
    assert.ok(first.name);
    assert.ok(typeof first.price === 'number');
    assert.equal(first.stock, undefined);
    assert.equal(first.inStock, undefined);
    assert.equal(first.batches, undefined);
  });

  test('GET /api/products/popular returns top items', async () => {
    const res = await request('/api/products/popular?limit=4');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length <= 4);
    assert.ok(res.data[0].id);
    assert.equal(res.data[0].stock, undefined);
    assert.equal(res.data[0].inStock, undefined);
    assert.equal(res.data[0].batches, undefined);
  });

  test('GET /api/products/categories returns categories', async () => {
    const res = await request('/api/products/categories');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  });

  test('GET /api/products/:id returns single product detail', async () => {
    const listRes = await request('/api/products?limit=1');
    const sampleId = listRes.data.data[0].id;

    const res = await request(`/api/products/${sampleId}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.id, sampleId);
    assert.ok(res.data.name);
    assert.equal(res.data.stock, undefined);
    assert.equal(res.data.inStock, undefined);
    assert.equal(res.data.batches, undefined);
  });

  test('POST /api/orders creates order and deducts inventory', async () => {
    const listRes = await request('/api/products?limit=1');
    const sample = listRes.data.data[0];
    const { Batch, InventoryMovement, Medicine } = require('../models');
    const medicine = await Medicine.findByPk(sample.id);
    const batches = await Batch.findAll({ where: { medicineId: sample.id } });
    const today = new Date().toISOString().slice(0, 10);
    const initialStock = batches.length > 0
      ? batches.filter((batch) => String(batch.expiryDate) >= today)
        .reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
      : Number(medicine.totalQuantity || 0);
    assert.ok(initialStock > 0, 'The selected product has stock for the regular checkout case');

    const overstockOrder = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Test Customer',
        customerPhone: '+260971239999',
        deliveryMethod: 'pickup',
        items: [{ id: sample.id, quantity: initialStock + 1 }],
      }),
    });
    assert.equal(overstockOrder.status, 201);
    assert.equal(overstockOrder.data.order.items[0].quantity, initialStock + 1);
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 0);

    const orderPayload = {
      customerName: 'Test Customer',
      customerPhone: '+260971239999',
      customerEmail: 'test@example.com',
      deliveryMethod: 'delivery',
      deliveryAddress: '100 Independence Ave',
      deliveryCity: 'Lusaka',
      deliveryProvince: 'Lusaka',
      paymentMethod: 'Mobile Money',
      items: [
        {
          id: sample.id,
          name: sample.name,
          quantity: 1,
          price: 0,
        },
      ],
    };

    const res = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    assert.ok(res.data.order);
    assert.ok(res.data.order.orderNumber);
    assert.equal(res.data.order.customerPhone, '+260971239999');
    assert.equal(Number(res.data.order.subtotal), sample.price);
    assert.equal(Number(res.data.order.totalAmount), sample.price + Number(res.data.order.deliveryFee));

    // Test tracking the newly created order
    const trackRes = await request(
      `/api/orders?orderNumber=${res.data.order.orderNumber}&phone=0971239999`
    );
    assert.equal(trackRes.status, 200);
    assert.ok(trackRes.data.data.some((order) => order.orderNumber === res.data.order.orderNumber));

    for (const batch of batches) {
      await batch.update({ quantity: 0 });
    }
    await medicine.update({ totalQuantity: 0 });
    const movementCount = await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    });
    const outOfStockOrder = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Backorder Customer',
        customerPhone: '+260971230000',
        deliveryMethod: 'pickup',
        items: [{ id: sample.id, quantity: 2 }],
      }),
    });
    assert.equal(outOfStockOrder.status, 201);
    assert.equal(outOfStockOrder.data.order.items[0].quantity, 2);
    assert.equal(await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    }), movementCount);
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 0);

    const StoreService = require('../src/store/store.service');
    const storeService = new StoreService();
    await assert.rejects(
      storeService.updateOrderStatus(outOfStockOrder.data.order.id, 'Confirmed'),
      (error) => error.getStatus() === 409 && error.message.includes('Insufficient stock')
    );
    assert.equal(outOfStockOrder.data.order.orderStatus, 'Order Placed');

    if (batches.length > 0) {
      await Batch.update({ quantity: 0 }, { where: { medicineId: sample.id } });
      await batches[0].update({ quantity: 2, expiryDate: '2099-12-31' });
    }
    await medicine.update({ totalQuantity: 2 });

    const confirmedOrder = await storeService.updateOrderStatus(
      outOfStockOrder.data.order.id,
      'Confirmed'
    );
    assert.equal(confirmedOrder.orderStatus, 'Confirmed');
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 0);
    assert.equal(await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    }), movementCount + 1);

    const cancellationReason = 'Customer changed their mind';
    const cancelledOrder = await storeService.updateOrderStatus(
      outOfStockOrder.data.order.id,
      'Cancelled',
      cancellationReason,
      { id: 1, role: 'user' }
    );
    assert.equal(cancelledOrder.orderStatus, 'Cancelled');
    assert.equal(cancelledOrder.cancellationReason, cancellationReason);
    assert.equal(Number((await Batch.findByPk(batches[0].id)).quantity), 2);
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 2);
    assert.equal(await InventoryMovement.count({
      where: {
        medicineId: sample.id,
        referenceType: 'ONLINE_ORDER_CANCELLATION',
        referenceId: cancelledOrder.id,
        quantityChange: 2,
      },
    }), 1);

    await assert.rejects(
      storeService.updateOrderStatus(
        cancelledOrder.id,
        'Cancelled',
        'Repeat cancellation',
        { id: 1, role: 'user' }
      ),
      (error) => error.getStatus() === 409
    );
    assert.equal(Number((await Batch.findByPk(batches[0].id)).quantity), 2);
  });

  test('POST /api/prescriptions/upload and GET /api/prescriptions/track/:ref', async () => {
    const uploadRes = await request('/api/prescriptions/upload', {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Jane Mwamba',
        patientPhone: '+260965112233',
        deliveryPreference: 'pickup',
        medications: 'Amoxicillin 500mg capsules',
        notes: 'Please verify availability',
      }),
    });

    assert.equal(uploadRes.status, 201);
    assert.ok(uploadRes.data.success);
    assert.ok(uploadRes.data.prescriptionNumber);

    const trackRes = await request(
      `/api/prescriptions/track/${uploadRes.data.prescriptionNumber}`
    );
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.data.prescriptionNumber, uploadRes.data.prescriptionNumber);
    assert.equal(trackRes.data.patientName, undefined);
    assert.equal(trackRes.data.patientPhone, undefined);
    assert.equal(trackRes.data.medications, undefined);
  });

  test('POST /api/support/inquiries submits customer contact message', async () => {
    const res = await request('/api/support/inquiries', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Peter Lungu',
        phone: '+260955887766',
        email: 'peter@example.com',
        inquiryType: 'Product Question',
        message: 'Do you deliver to Ndola?',
      }),
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    assert.ok(res.data.inquiry);
  });

  test('POST /api/auth/register creates new customer account and returns token', async () => {
    const username = `cust_${Date.now()}`;
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        name: 'Chipo Zulu',
        phone: `+26097${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `${username}@test.zm`,
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    assert.ok(res.data.token);
    assert.equal(res.data.user.role, 'customer');

    // Test profile access with token
    const profileRes = await request('/api/auth/profile', {
      headers: { Authorization: `Bearer ${res.data.token}` },
    });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.data.user.role, 'customer');
  });
});
