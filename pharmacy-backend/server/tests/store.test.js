const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
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
process.env.ORDER_PAYMENT_WEBHOOK_SECRET = 'store-test-webhook-secret-value-12345';

const StoreService = require('../src/store/store.service');

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

async function signedPaymentCallback(payload) {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', process.env.ORDER_PAYMENT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return request('/api/orders/payments/callback', {
    method: 'POST',
    headers: { 'x-mediquick-signature': signature },
    body: rawBody,
  });
}

describe('Store E-Commerce Endpoints', () => {
  before(async () => {
    const { AppModule, ensureApplicationReady } = require('../src/app.module');
    const { NestFactory } = require('@nestjs/core');

    await ensureApplicationReady();
    app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
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

  test('popular product limit is capped for untrusted query values', async () => {
    const { Medicine } = require('../models');
    const originalFindAll = Medicine.findAll;
    let capturedLimit;
    Medicine.findAll = async (options) => {
      capturedLimit = options.limit;
      return [];
    };
    try {
      await new StoreService().getPopularProducts('999999');
      assert.equal(capturedLimit, 50);
    } finally {
      Medicine.findAll = originalFindAll;
    }
  });

  test('hybrid order migration is safe to rerun', async () => {
    const { runMigrations } = require('../lib/migrations');
    const { sequelize } = require('../models');
    await runMigrations();
    await runMigrations();
    const columns = await sequelize.getQueryInterface().describeTable('Orders');
    const indexes = await sequelize.getQueryInterface().showIndex('Orders');
    assert.ok(columns.pickupReference);
    assert.ok(columns.gatewayPaymentReference);
    assert.ok(indexes.some((index) => index.name === 'orders_pickup_reference_unique'));
  });

  test('price-sorted product filters scan compact chunks and return only the requested page', async () => {
    const { Medicine } = require('../models');
    const originalFindAll = Medicine.findAll;
    const products = [
      { id: 1, name: 'Aspirin', basePrice: 20, Batches: [] },
      { id: 2, name: 'Bandage', basePrice: 10, Batches: [] },
      { id: 3, name: 'Cream', basePrice: 15, Batches: [] },
    ];
    const calls = [];
    Medicine.findAll = async (options) => {
      calls.push(options);
      if (options.attributes) {
        return products.slice(options.offset, options.offset + options.limit)
          .map((product) => ({ get: () => product }));
      }
      const requestedIds = options.where.id[require('sequelize').Op.in];
      return requestedIds.map((id) => {
        const product = products.find((candidate) => candidate.id === id);
        return { id: product.id, get: () => product };
      });
    };

    try {
      const result = await new StoreService().listProducts({ sort: 'price_asc', limit: 2 });
      assert.deepEqual(result.data.map((product) => product.id), [2, 3]);
      assert.equal(result.pagination.total, 3);
      assert.deepEqual(calls[0].attributes, ['id', 'name', 'basePrice']);
      assert.equal(calls[0].limit, 200);
      assert.equal(calls[1].limit, undefined);
    } finally {
      Medicine.findAll = originalFindAll;
    }
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

  test('POST /api/orders reserves available stock and accepts preorder quantities', async () => {
    const listRes = await request('/api/products?limit=1');
    const sample = listRes.data.data[0];
    const {
      Batch,
      InventoryMovement,
      Medicine,
      Order,
      OrderItem,
      ReplenishmentTask,
      Sales,
      User,
    } = require('../models');
    const medicine = await Medicine.findByPk(sample.id);
    const batches = await Batch.findAll({ where: { medicineId: sample.id } });
    const today = new Date().toISOString().slice(0, 10);
    const initialStock = batches.length > 0
      ? batches.filter((batch) => String(batch.expiryDate) >= today)
        .reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
      : Number(medicine.totalQuantity || 0);
    assert.ok(initialStock > 0, 'The selected product has stock for the regular checkout case');
    const initialMovementCount = await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    });
    const initialSalesCount = await Sales.count({ where: { medicineId: sample.id } });
    const initialOrderCount = await Order.count();

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
    assert.equal(overstockOrder.data.order.items[0].reservedQuantity, initialStock);
    assert.equal(overstockOrder.data.order.items[0].preorderQuantity, 1);
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), Number(medicine.totalQuantity));
    assert.equal(await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    }), initialMovementCount);
    assert.equal(await Sales.count({ where: { medicineId: sample.id } }), initialSalesCount);
    assert.equal(await Order.count(), initialOrderCount + 1);

    const orderPayload = {
      customerName: 'Test Customer',
      customerPhone: '+260971239999',
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
    assert.equal(res.data.order.items[0].reservedQuantity, 0);
    assert.equal(res.data.order.items[0].preorderQuantity, 1);
    assert.equal(res.data.order.customerPhone, '+260971239999');
    assert.equal(Number(res.data.order.subtotal), sample.price);
    assert.equal(Number(res.data.order.deliveryFee), 0);
    assert.equal(Number(res.data.order.totalAmount), sample.price);

    // Test tracking the newly created order
    const trackRes = await request(
      `/api/orders?orderNumber=${res.data.order.orderNumber}&phone=0971239999`
    );
    assert.equal(trackRes.status, 200);
    assert.ok(trackRes.data.data.some((order) => order.orderNumber === res.data.order.orderNumber));
    const shortPhoneTrack = await request(
      `/api/orders?orderNumber=${res.data.order.orderNumber}&phone=1`
    );
    assert.equal(shortPhoneTrack.status, 400);

    const StoreService = require('../src/store/store.service');
    const storeService = new StoreService();
    const pickupStaff = await User.create({
      username: `store-test-staff-${Date.now()}`,
      password: 'store-test-staff-password',
      role: 'admin',
    });
    const preorderQueue = await storeService.listOrders(
      { filter: 'preorders' },
      { role: 'admin' }
    );
    assert.equal(preorderQueue.data.length, 2);
    const paidPreorderPayment = await signedPaymentCallback({
      eventId: `mixed-payment-${Date.now()}`,
      orderNumber: overstockOrder.data.order.orderNumber,
      amountMinor: Math.round(Number(overstockOrder.data.order.totalAmount) * 100),
      currency: 'ZMW',
      transactionReference: 'gateway-mixed-order-test',
      eventType: 'payment.succeeded',
    });
    assert.equal(paidPreorderPayment.status, 201);
    await assert.rejects(
      storeService.updateOrderStatus(overstockOrder.data.order.id, 'Confirmed'),
      (error) => error.getStatus() === 409 && error.message.includes('mixed order')
    );
    const InventoryService = require('../src/inventory/inventory.service');
    const inventoryService = new InventoryService();
    await inventoryService.addBatchToMedicine(sample.id, {
      batchNumber: `PREORDER-RECEIPT-${Date.now()}`,
      quantity: 1,
      expiryDate: '2099-12-31',
      costPrice: 1,
      sellingPrice: sample.price,
    });
    const allocatedItems = await OrderItem.findAll({
      where: {
        orderId: [overstockOrder.data.order.id, res.data.order.id],
      },
      order: [['createdAt', 'ASC']],
    });
    assert.equal(allocatedItems.length, 2);
    assert.equal(Number(allocatedItems[0].outstandingPreorderQuantity), 0);
    assert.equal(Number(allocatedItems[1].outstandingPreorderQuantity), 1);
    assert.equal(allocatedItems[0].fulfillmentStatus, 'Awaiting Fulfillment');
    assert.equal(allocatedItems[1].fulfillmentStatus, 'Awaiting Stock');
    const allocatedTasks = await ReplenishmentTask.findAll({
      where: { orderItemId: allocatedItems.map((item) => item.id) },
    });
    assert.equal(allocatedTasks.filter((task) => task.status === 'Received').length, 1);
    assert.equal(allocatedTasks.filter((task) => task.status === 'Open').length, 1);
    const awaitingStockQueue = await storeService.listOrders(
      { filter: 'awaiting-stock' },
      { role: 'admin' }
    );
    assert.equal(awaitingStockQueue.data.length, 1);
    assert.equal(Number((await Medicine.findByPk(sample.id)).reservedQuantity), initialStock + 1);
    const supplierConfirmedAt = new Date(Date.now() - 60_000);
    const estimatedFulfillmentAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const estimateTask = await storeService.updateReplenishmentEstimate(
      allocatedTasks.find((task) => task.status === 'Open').id,
      {
        supplierConfirmedAt: supplierConfirmedAt.toISOString(),
        estimatedFulfillmentAt: estimatedFulfillmentAt.toISOString(),
      },
      { id: pickupStaff.id, role: 'admin' }
    );
    assert.equal(estimateTask.status, 'Ordered');
    const estimatedOrder = await Order.findByPk(res.data.order.id);
    assert.equal(
      new Date(estimatedOrder.items[0].estimatedFulfillmentAt).toISOString(),
      estimatedFulfillmentAt.toISOString()
    );

    await inventoryService.addBatchToMedicine(sample.id, {
      batchNumber: `PREORDER-RECEIPT-CONTINUED-${Date.now()}`,
      quantity: 1,
      expiryDate: '2099-12-31',
      costPrice: 1,
      sellingPrice: sample.price,
    });
    const fullyAllocatedTasks = await ReplenishmentTask.findAll({
      where: { orderItemId: allocatedItems.map((item) => item.id) },
    });
    assert.ok(fullyAllocatedTasks.every((task) => task.status === 'Received'));
    assert.equal(Number((await Medicine.findByPk(sample.id)).reservedQuantity), initialStock + 2);
    const updatedTracking = await request(
      `/api/orders?orderNumber=${res.data.order.orderNumber}&phone=0971239999`
    );
    const trackedPreorder = updatedTracking.data.data
      .find((trackedOrder) => trackedOrder.orderNumber === res.data.order.orderNumber);
    assert.equal(trackedPreorder.items[0].outstandingPreorderQuantity, 0);
    assert.equal(trackedPreorder.items[0].fulfillmentStatus, 'Awaiting Fulfillment');
    assert.equal(trackedPreorder.items[0].estimatedFulfillmentAt, null);

    const confirmedMixedOrder = await storeService.updateOrderStatus(
      overstockOrder.data.order.id,
      'Confirmed'
    );
    assert.equal(confirmedMixedOrder.orderStatus, 'Confirmed');
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 1);
    await storeService.updateOrderStatus(
      res.data.order.id,
      'Cancelled',
      'Test preorder cancellation',
      { id: 1, role: 'admin' }
    );
    assert.equal(Number((await Medicine.findByPk(sample.id)).reservedQuantity), 0);

    await Batch.update({ quantity: 0, reservedQuantity: 0 }, { where: { medicineId: sample.id } });
    await medicine.update({ totalQuantity: 0, reservedQuantity: 0 });
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
    assert.equal(outOfStockOrder.data.order.items[0].preorderQuantity, 2);
    assert.equal(await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    }), movementCount);
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 0);

    await storeService.updateOrderStatus(
      outOfStockOrder.data.order.id,
      'Cancelled',
      'Test preorder cancellation',
      { id: 1, role: 'admin' }
    );
    const unallocatedOrder = await Order.create({
      orderNumber: `ORD-TEST-${Date.now()}`,
      customerName: 'Backorder Customer',
      customerPhone: '+260971230000',
      deliveryMethod: 'pickup',
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'Paid',
      orderStatus: 'Order Placed',
      items: [{ id: sample.id, name: sample.name, quantity: 2 }],
    });
    await assert.rejects(
      storeService.updateOrderStatus(unallocatedOrder.id, 'Confirmed'),
      (error) => error.getStatus() === 409 && error.message.includes('Insufficient stock')
    );
    assert.equal(unallocatedOrder.orderStatus, 'Order Placed');

    if (batches.length > 0) {
      await Batch.update({ quantity: 0 }, { where: { medicineId: sample.id } });
      await batches[0].update({ quantity: 2, expiryDate: '2099-12-31' });
    }
    await medicine.update({ totalQuantity: 2 });

    const confirmedOrder = await storeService.updateOrderStatus(
      unallocatedOrder.id,
      'Confirmed'
    );
    assert.equal(confirmedOrder.orderStatus, 'Confirmed');
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 0);
    assert.equal(await InventoryMovement.count({
      where: { medicineId: sample.id, referenceType: 'ONLINE_ORDER' },
    }), movementCount + 1);

    const cancellationReason = 'Customer changed their mind';
    const cancelledOrder = await storeService.updateOrderStatus(
      unallocatedOrder.id,
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

    const paidPickupResponse = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Pickup Customer',
        customerPhone: '+260971230001',
        deliveryMethod: 'pickup',
        paymentMethod: 'Online Gateway',
        items: [{ id: sample.id, quantity: 1 }],
      }),
    });
    assert.equal(paidPickupResponse.status, 201);
    const paidPickup = paidPickupResponse.data.order;
    const paymentEvent = {
      eventId: `payment-${Date.now()}`,
      orderNumber: paidPickup.orderNumber,
      amountMinor: Math.round(Number(paidPickup.totalAmount) * 100),
      currency: 'ZMW',
      transactionReference: 'gateway-payment-test-001',
      eventType: 'payment.succeeded',
    };
    const invalidSignature = await request('/api/orders/payments/callback', {
      method: 'POST',
      headers: { 'x-mediquick-signature': '0'.repeat(64) },
      body: JSON.stringify(paymentEvent),
    });
    assert.equal(invalidSignature.status, 400);
    const paymentResponse = await signedPaymentCallback(paymentEvent);
    assert.equal(paymentResponse.status, 201, JSON.stringify(paymentResponse.data));
    assert.equal(paymentResponse.data.order.paymentStatus, 'Paid');
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 2);
    const duplicatePaymentResponse = await signedPaymentCallback(paymentEvent);
    assert.equal(duplicatePaymentResponse.data.duplicate, true);

    const paidOrder = await storeService.updateOrderStatus(paidPickup.id, 'Confirmed');
    assert.equal(paidOrder.orderStatus, 'Confirmed');
    assert.equal(Number((await Medicine.findByPk(sample.id)).totalQuantity), 1);
    await storeService.updateOrderStatus(paidPickup.id, 'Preparing');
    const readyPickup = await storeService.updateOrderStatus(paidPickup.id, 'Ready');
    assert.ok(readyPickup.pickupReference);
    await assert.rejects(
      storeService.recordPickupHandover(
        paidPickup.id,
        'WRONG-REFERENCE',
        { id: pickupStaff.id, role: pickupStaff.role }
      ),
      (error) => error.getStatus() === 409
    );
    const handedOver = await storeService.recordPickupHandover(
      paidPickup.id,
      readyPickup.pickupReference,
      { id: pickupStaff.id, role: pickupStaff.role }
    );
    assert.equal(handedOver.orderStatus, 'Delivered');
    assert.ok(handedOver.handedOverAt);
    assert.equal(handedOver.handedOverByUserId, pickupStaff.id);

    const refundOrderResponse = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Refund Customer',
        customerPhone: '+260971230002',
        deliveryMethod: 'pickup',
        paymentMethod: 'Online Gateway',
        items: [{ id: sample.id, quantity: 1 }],
      }),
    });
    assert.equal(refundOrderResponse.status, 201);
    const refundOrder = refundOrderResponse.data.order;
    const refundPayment = await signedPaymentCallback({
      eventId: `payment-refund-${Date.now()}`,
      orderNumber: refundOrder.orderNumber,
      amountMinor: Math.round(Number(refundOrder.totalAmount) * 100),
      currency: 'ZMW',
      transactionReference: 'gateway-payment-test-002',
      eventType: 'payment.succeeded',
    });
    assert.equal(refundPayment.status, 201);
    const refundPending = await storeService.updateOrderStatus(
      refundOrder.id,
      'Cancelled',
      'Customer requested cancellation',
      { id: 1, role: 'admin' }
    );
    assert.equal(refundPending.refundStatus, 'Pending');
    const refundCompleted = await signedPaymentCallback({
      eventId: `refund-${Date.now()}`,
      orderNumber: refundOrder.orderNumber,
      amountMinor: Math.round(Number(refundOrder.totalAmount) * 100),
      currency: 'ZMW',
      transactionReference: 'gateway-refund-test-001',
      eventType: 'refund.completed',
    });
    assert.equal(refundCompleted.status, 201);
    assert.equal(refundCompleted.data.order.refundStatus, 'Completed');
    assert.equal(refundCompleted.data.order.paymentStatus, 'Refunded');
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

  test('authenticated store orders and prescriptions are linked to the customer account', async () => {
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

    const productsResponse = await request('/api/products?limit=100');
    const { Batch, Customer, Medicine, Order, Prescription } = require('../models');
    const today = new Date().toISOString().slice(0, 10);
    let orderableProduct;
    for (const product of productsResponse.data.data) {
      if (product.prescriptionRequired) continue;
      const medicine = await Medicine.findByPk(product.id);
      const batches = await Batch.findAll({ where: { medicineId: product.id } });
      const available = batches.length > 0
        ? batches.filter((batch) => String(batch.expiryDate) >= today)
          .reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
        : Number(medicine?.totalQuantity || 0);
      if (available > 0) {
        orderableProduct = product;
        break;
      }
    }
    assert.ok(orderableProduct, 'A customer-orderable product has available stock');

    const orderResponse = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${res.data.token}` },
      body: JSON.stringify({
        customerName: 'Chipo Zulu',
        customerPhone: res.data.customer.phone,
        deliveryMethod: 'pickup',
        items: [{ id: orderableProduct.id, quantity: 1 }],
      }),
    });
    assert.equal(orderResponse.status, 201);
    const customer = await Customer.findOne({ where: { userId: res.data.user.id } });
    const storedOrder = await Order.findOne({
      where: { orderNumber: orderResponse.data.order.orderNumber },
    });
    assert.equal(storedOrder.userId, res.data.user.id);
    assert.equal(storedOrder.customerId, customer.id);

    const accountOrders = await request('/api/orders', {
      headers: { Authorization: `Bearer ${res.data.token}` },
    });
    assert.equal(accountOrders.status, 200);
    assert.ok(accountOrders.data.data.some(
      (order) => order.orderNumber === orderResponse.data.order.orderNumber
    ));

    const prescriptionResponse = await request('/api/prescriptions/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${res.data.token}` },
      body: JSON.stringify({
        patientName: 'Chipo Zulu',
        patientPhone: res.data.customer.phone,
        deliveryPreference: 'pickup',
        medications: 'Test prescription',
        fileData: `data:image/png;base64,${'A'.repeat(1024)}`,
      }),
    });
    assert.equal(prescriptionResponse.status, 201);
    const storedPrescription = await Prescription.findOne({
      where: { prescriptionNumber: prescriptionResponse.data.prescriptionNumber },
    });
    assert.equal(storedPrescription.customerId, customer.id);

    const accountPrescriptions = await request('/api/prescriptions/my', {
      headers: { Authorization: `Bearer ${res.data.token}` },
    });
    assert.equal(accountPrescriptions.status, 200);
    assert.ok(accountPrescriptions.data.data.some(
      (prescription) => prescription.prescriptionNumber === prescriptionResponse.data.prescriptionNumber
    ));
    const listedPrescription = accountPrescriptions.data.data.find(
      (prescription) => prescription.prescriptionNumber === prescriptionResponse.data.prescriptionNumber
    );
    assert.equal(listedPrescription.imagePath, null);
    assert.equal(listedPrescription.hasDocument, true);

    const documentResponse = await request(
      `/api/prescriptions/my/${storedPrescription.id}/document`,
      { headers: { Authorization: `Bearer ${res.data.token}` } }
    );
    assert.equal(documentResponse.status, 200);
    assert.equal(documentResponse.data.imagePath, `data:image/png;base64,${'A'.repeat(1024)}`);
  });
});
