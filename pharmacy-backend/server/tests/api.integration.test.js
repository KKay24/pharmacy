const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const { execFileSync } = require('node:child_process');
const net = require('node:net');
const sqlite3 = require('sqlite3');

let childProcess;
let baseUrl;
let authToken;
let adminUserId;
let createdSaleId;
let inventoryTaxonomy = [];
let testDatabasePath;

function runTestDatabaseStatement(sql) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(testDatabasePath);
    database.run(sql, (error) => {
      database.close((closeError) => {
        if (error) reject(error);
        else if (closeError) reject(closeError);
        else resolve();
      });
    });
  });
}

function taxonomyNode(path) {
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    (node.subcategories || []).forEach(visit);
    (node.forms || []).forEach(visit);
  };
  inventoryTaxonomy.forEach(visit);
  const match = nodes.find((node) => node.path === path);
  assert.ok(match, `Taxonomy node exists: ${path}`);
  return match;
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/auth/me`);
      if (response.status === 401) {
        return;
      }
    } catch (error) {
      // Keep waiting for startup.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error('Server did not become ready in time');
}

before(async () => {
  const port = await getAvailablePort();
  const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-api-test-'));
  const sqlitePath = join(tempDirectory, 'test.sqlite');
  testDatabasePath = sqlitePath;

  baseUrl = `http://127.0.0.1:${port}`;

  const seedEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_STORAGE_PATH: sqlitePath,
    JWT_SECRET: 'integration-test-secret',
    SEED_ADMIN_EMAIL: 'admin@example.test',
    SEED_ADMIN_PASSWORD: 'bootstrap-password-for-tests',
  };

  execFileSync(process.execPath, ['scripts/seed-admin.js'], {
    cwd: join(__dirname, '..'),
    env: seedEnvironment,
    stdio: 'pipe',
  });
  execFileSync(process.execPath, ['scripts/seed-admin.js'], {
    cwd: join(__dirname, '..'),
    env: seedEnvironment,
    stdio: 'pipe',
  });

  childProcess = spawn('node', ['src/main.js'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      SQLITE_STORAGE_PATH: sqlitePath,
      JWT_SECRET: 'integration-test-secret',
      ENABLE_DEMO_SEEDING: 'true',
      ALLOW_LEGACY_DEV_AUTH: 'false',
      RESEND_API_KEY: '',
      RECEIPT_FROM_EMAIL: '',
    },
    stdio: 'inherit',
  });

  await waitForServer(baseUrl);
});

after(async () => {
  if (childProcess) {
    childProcess.kill('SIGTERM');
  }
});

async function ensureAdminAuth() {
  if (authToken) {
    return authToken;
  }

  const normalLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin@example.test',
      password: 'normal-password-for-tests',
    }),
  });

  if (normalLoginResponse.status === 200) {
    const normalLoginPayload = await normalLoginResponse.json();
    authToken = normalLoginPayload.token;
    adminUserId = normalLoginPayload.user.id;
    return authToken;
  }

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin@example.test',
      password: 'bootstrap-password-for-tests',
    }),
  });

  const payload = await response.json();
  const changePasswordResponse = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'bootstrap-password-for-tests',
      newPassword: 'normal-password-for-tests',
    }),
  });

  const changedPasswordPayload = await changePasswordResponse.json();
  authToken = changedPasswordPayload.token || payload.token;
  adminUserId = (changedPasswordPayload.user || payload.user).id;
  return authToken;
}

beforeEach(async (t) => {
  if (t?.name === 'login returns a bearer token') {
    return;
  }
  if (!authToken) {
    await ensureAdminAuth();
  }
});

test('login returns a bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin@example.test',
      password: 'bootstrap-password-for-tests',
    }),
  });

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.user.role, 'admin');
  assert.equal(payload.user.mustChangePassword, false);
  assert.ok(payload.token);

  const changePasswordResponse = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'bootstrap-password-for-tests',
      newPassword: 'normal-password-for-tests',
    }),
  });

  assert.equal(changePasswordResponse.status, 200);
  const changedPasswordPayload = await changePasswordResponse.json();
  assert.equal(changedPasswordPayload.user.mustChangePassword, false);

  authToken = changedPasswordPayload.token || payload.token;

  const normalLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin@example.test',
      password: 'normal-password-for-tests',
    }),
  });
  assert.equal(normalLoginResponse.status, 200);
  const normalLoginPayload = await normalLoginResponse.json();
  assert.equal(normalLoginPayload.user.mustChangePassword, false);
  authToken = normalLoginPayload.token;
  adminUserId = normalLoginPayload.user.id;
});

test('staff support inbox is authenticated, searchable, paginated, and tracks inquiry status', async () => {
  const submission = await fetch(`${baseUrl}/api/support/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Support Inbox Test Customer',
      phone: '+260977123456',
      email: 'support-inbox-test@example.test',
      inquiryType: 'Order issue',
      message: 'Please check my test order.',
    }),
  });
  assert.equal(submission.status, 201);
  const submitted = await submission.json();

  const anonymousResponse = await fetch(`${baseUrl}/api/support/inquiries`);
  assert.equal(anonymousResponse.status, 401);

  const headers = { Authorization: `Bearer ${authToken}` };
  const inboxResponse = await fetch(
    `${baseUrl}/api/support/inquiries?search=Support%20Inbox%20Test%20Customer&status=New&page=1&limit=5`,
    { headers }
  );
  assert.equal(inboxResponse.status, 200);
  const inbox = await inboxResponse.json();
  assert.equal(inbox.pagination.total, 1);
  assert.equal(inbox.data[0].id, submitted.inquiry.id);
  assert.equal(inbox.data[0].status, 'New');

  const updateResponse = await fetch(
    `${baseUrl}/api/support/inquiries/${submitted.inquiry.id}/status`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Contacted' }),
    }
  );
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).status, 'Contacted');

  const invalidStatusResponse = await fetch(
    `${baseUrl}/api/support/inquiries/${submitted.inquiry.id}/status`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Ignored' }),
    }
  );
  assert.equal(invalidStatusResponse.status, 400);
});

test('removed seed and debug endpoints are not available', async () => {
  for (const endpoint of ['/api/force-seed', '/api/debug-env', '/api/debug-db', '/api/test']) {
    const response = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(response.status, 404, endpoint);
  }
});

test('inventory taxonomy is hierarchical and limits forms to the selected subcategory', async () => {
  const response = await fetch(`${baseUrl}/api/inventory/categories`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(response.status, 200);
  inventoryTaxonomy = await response.json();
  const medicines = inventoryTaxonomy.find((category) => category.slug === 'medicines');
  const babyProducts = inventoryTaxonomy.find((category) => category.slug === 'baby-products');
  assert.ok(medicines.subcategories.some((subcategory) => subcategory.name === 'Antibiotics'));
  assert.ok(medicines.subcategories.find((subcategory) => subcategory.name === 'Antibiotics')
    .forms.some((form) => form.name === 'Syrup'));
  assert.equal(babyProducts.subcategories.some((subcategory) =>
    subcategory.forms.some((form) => form.name === 'Injection')
  ), false);
});

test('new products save hierarchical classification and inventory filters use category IDs', async () => {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
  const mainCategory = taxonomyNode('medicines');
  const subcategory = taxonomyNode('medicines/antibiotics');
  const form = taxonomyNode('medicines/antibiotics/syrup');
  const createResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Taxonomy Integration Amoxicillin',
      genericName: 'Amoxicillin',
      brandName: 'Test Brand',
      supplier: 'Test Supply',
      strength: '125 mg/5 mL',
      packSize: '100',
      unitOfMeasure: 'mL',
      mainCategoryId: mainCategory.id,
      subcategoryId: subcategory.id,
      productFormId: form.id,
      batchNumber: 'TAXONOMY-001',
      quantity: 12,
      expiryDate: '2028-12-31',
      costPrice: 2,
      sellingPrice: 4,
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.ok(created.id);

  const filteredResponse = await fetch(
    `${baseUrl}/api/inventory?category=${mainCategory.id}&subcategory=${subcategory.id}&form=${form.id}`,
    { headers }
  );
  assert.equal(filteredResponse.status, 200);
  const filtered = await filteredResponse.json();
  const product = filtered.data.find((medicine) => medicine.id === created.id);
  assert.ok(product);
  assert.equal(product.MainCategory.id, mainCategory.id);
  assert.equal(product.Subcategory.id, subcategory.id);
  assert.equal(product.ProductForm.id, form.id);
  assert.equal(product.brandName, 'Test Brand');

  const formNameResponse = await fetch(
    `${baseUrl}/api/inventory?form=${encodeURIComponent(form.name)}`,
    { headers }
  );
  assert.equal(formNameResponse.status, 200);
  const formNameFiltered = await formNameResponse.json();
  assert.ok(formNameFiltered.data.some((medicine) => medicine.id === created.id));
  assert.ok(formNameFiltered.data.some((medicine) => medicine.name === 'Vitamin C Syrup'));

  const metadataFilteredResponse = await fetch(
    `${baseUrl}/api/inventory?genericName=Amoxicillin&brand=Test%20Brand&supplier=Test%20Supply&stockStatus=in&expiryStatus=valid`,
    { headers }
  );
  assert.equal(metadataFilteredResponse.status, 200);
  const metadataFiltered = await metadataFilteredResponse.json();
  assert.ok(metadataFiltered.data.some((medicine) => medicine.id === created.id));

  const invalidFormResponse = await fetch(
    `${baseUrl}/api/inventory?category=${mainCategory.id}&subcategory=${subcategory.id}&form=${taxonomyNode('medicines/pain-and-fever/tablet').id}`,
    { headers }
  );
  assert.equal(invalidFormResponse.status, 400);

  const missingMainCategoryResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Unclassified API Product' }),
  });
  assert.equal(missingMainCategoryResponse.status, 400);

  const mismatchedSubcategoryResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Mismatched Taxonomy Product',
      mainCategoryId: taxonomyNode('medicines').id,
      subcategoryId: taxonomyNode('personal-care/skin-care').id,
    }),
  });
  assert.equal(mismatchedSubcategoryResponse.status, 400);
});

test('admins cannot be created through the API', async () => {
  const response = await fetch(`${baseUrl}/api/auth/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'second-admin',
      email: 'second-admin@example.test',
      password: 'another-password-for-tests',
      role: 'admin',
    }),
  });

  assert.equal(response.status, 403);

  const usersResponse = await fetch(`${baseUrl}/api/auth/users`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(usersResponse.status, 200);
  const users = await usersResponse.json();
  assert.equal(users.filter((user) => user.role === 'admin').length, 1);
});

test('all staff roles can list full online orders and update fulfillment status', async () => {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
  const username = `order-staff-${Date.now()}`;
  const createStaffResponse = await fetch(`${baseUrl}/api/auth/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      password: 'order-staff-password-test',
      role: 'user',
    }),
  });
  assert.equal(createStaffResponse.status, 201);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'order-staff-password-test' }),
  });
  assert.equal(loginResponse.status, 200);
  const staffLogin = await loginResponse.json();
  const staffToken = staffLogin.token;
  const staffHeaders = {
    Authorization: `Bearer ${staffToken}`,
    'Content-Type': 'application/json',
  };

  const productsResponse = await fetch(`${baseUrl}/api/products?limit=10`);
  assert.equal(productsResponse.status, 200);
  const product = (await productsResponse.json()).data.find((item) => !item.prescriptionRequired);
  assert.ok(product, 'A customer-orderable product is available');
  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Order Queue Test Customer',
      customerPhone: '+260971238765',
      customerEmail: 'order-queue@example.test',
      deliveryMethod: 'pickup',
      paymentMethod: 'Cash on Delivery',
      items: [{ id: product.id, quantity: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 201);
  const createdOrder = (await createOrderResponse.json()).order;

  const listResponse = await fetch(`${baseUrl}/api/orders?limit=100`, { headers: staffHeaders });
  assert.equal(listResponse.status, 200);
  const listedOrders = (await listResponse.json()).data;
  const staffOrder = listedOrders.find((order) => order.orderNumber === createdOrder.orderNumber);
  assert.ok(staffOrder);
  assert.equal(staffOrder.customerEmail, 'order-queue@example.test');
  assert.equal(staffOrder.items.length, 1);

  const missingContentTypeResponse = await fetch(`${baseUrl}/api/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ status: 'Preparing' }),
  });
  assert.equal(missingContentTypeResponse.status, 400);

  const updateResponse = await fetch(`${baseUrl}/api/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'Preparing' }),
  });
  assert.equal(updateResponse.status, 409);
  assert.match((await updateResponse.json()).message, /Confirm the order before continuing fulfillment/);

  const missingReasonResponse = await fetch(`${baseUrl}/api/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'Cancelled', reason: '   ' }),
  });
  assert.equal(missingReasonResponse.status, 400);

  const cancellationReason = 'Customer could not be reached to confirm delivery';
  const cancelResponse = await fetch(`${baseUrl}/api/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'Cancelled', reason: cancellationReason }),
  });
  assert.equal(cancelResponse.status, 200);
  const cancelledOrder = await cancelResponse.json();
  assert.equal(cancelledOrder.orderStatus, 'Cancelled');
  assert.equal(cancelledOrder.cancellationReason, cancellationReason);
  assert.equal(cancelledOrder.cancelledByUserId, staffLogin.user.id);
  assert.ok(cancelledOrder.cancelledAt);

  const duplicateCancelResponse = await fetch(`${baseUrl}/api/orders/${createdOrder.id}/status`, {
    method: 'PUT',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'Cancelled', reason: cancellationReason }),
  });
  assert.equal(duplicateCancelResponse.status, 409);
});

test('inventory can be fetched with the issued token', async () => {
  const response = await fetch(`${baseUrl}/api/inventory`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  assert.equal(response.status, 200);

    const inventoryPayload = await response.json();
    const inventory = inventoryPayload.data;
  assert.ok(Array.isArray(inventory));
  assert.ok(inventory.length >= 1);
  assert.ok(inventory[0].name);
});

test('inventory batch can be imported with empty expiryDate and metadata', async () => {
  const response = await fetch(`${baseUrl}/api/inventory/batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata: {
        supplier: 'Rapid Test Supplier',
        warehouse: 'Main Pharmacy',
        orderDate: '2026-09-27',
        invoiceNumber: 'INV-TEST-001',
      },
      items: [
        {
          name: 'Amoxicillin 500mg Batch Test',
          mainCategoryId: taxonomyNode('medicines').id,
          subcategoryId: taxonomyNode('medicines/antibiotics').id,
          productFormId: taxonomyNode('medicines/antibiotics/capsule').id,
          quantity: 20,
          costPrice: '15.5',
          sellingPrice: '25.0',
          expiryDate: '',
          batchNumber: '',
        },
      ],
    }),
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.equal(result.count, 1);
});

test('a sale can be created through the API', async () => {
  const inventoryResponse = await fetch(`${baseUrl}/api/inventory`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
    const inventoryPayload = await inventoryResponse.json();
    const inventory = inventoryPayload.data;
  const firstItem = inventory[0];

  const response = await fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      medicineId: firstItem.id,
      quantity: 1,
      totalPrice: 5,
      paymentMethod: 'Cash',
      soldBy: 'forged-cashier',
      soldByUserId: 999999,
      clientTransactionId: `attribution_${Date.now()}`,
    }),
  });

  assert.equal(response.status, 201);

  const sale = await response.json();
  assert.ok(sale.id);
  assert.equal(sale.medicineId, firstItem.id);
  assert.equal(sale.soldByUserId, adminUserId);
  assert.notEqual(sale.soldBy, 'forged-cashier');
  assert.equal(sale.saleStatus, 'COMPLETED');

  createdSaleId = sale.id;
});

test('analytics include profit and loss data after a sale', async () => {
  assert.ok(createdSaleId);

  const response = await fetch(`${baseUrl}/api/analytics/profit-loss`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  assert.equal(response.status, 200);

  const analyticsPayload = await response.json();
  const analytics = analyticsPayload.data;
  assert.ok(Array.isArray(analytics));
  assert.equal(analyticsPayload.pagination.page, 1);
  assert.ok(analytics.length >= 1);
  assert.ok(typeof analytics[analytics.length - 1].netProfit === 'number');
});

test('predictive analytics expose forecasts, reorder suggestions, and risk signals', async () => {
  const inventoryResponse = await fetch(`${baseUrl}/api/inventory`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(inventoryResponse.status, 200);

    const inventoryPayload = await inventoryResponse.json();
    const inventory = inventoryPayload.data;
  const firstItem =
    inventory.find((item) => item.name === 'Paracetamol') ||
    inventory.find((item) =>
      Array.isArray(item.Batches)
        ? item.Batches.reduce((total, batch) => total + Number(batch.quantity || 0), 0) >= 100
        : Number(item.totalQuantity || item.quantity || 0) >= 100
    ) ||
    inventory[0];
  assert.ok(firstItem?.id);

  const demandSpikeResponse = await fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      medicineId: firstItem.id,
      quantity: 100,
      totalPrice: 250,
      paymentMethod: 'Cash',
      clientTransactionId: `forecast_sale_${Date.now()}`,
    }),
  });
  assert.equal(demandSpikeResponse.status, 201);

  const expiringDate = new Date();
  expiringDate.setDate(expiringDate.getDate() + 5);
  const expiringProductResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Expiry Risk Demo',
      genericName: 'Forecast Test Item',
      mainCategoryId: taxonomyNode('medical-devices').id,
      subcategoryId: taxonomyNode('medical-devices/other').id,
      productFormId: taxonomyNode('medical-devices/other/device').id,
      threshold: 5,
      batchNumber: 'EXP-TEST-001',
      quantity: 30,
      expiryDate: expiringDate.toISOString().slice(0, 10),
      costPrice: 4.5,
      sellingPrice: 8.5,
    }),
  });
  assert.equal(expiringProductResponse.status, 201);
  const expiringProduct = await expiringProductResponse.json();
  assert.ok(expiringProduct.id);

  const predictionsResponse = await fetch(`${baseUrl}/api/analytics/predictions`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(predictionsResponse.status, 200);

  const predictionsPayload = await predictionsResponse.json();
  assert.ok(Array.isArray(predictionsPayload.predictions));
  assert.ok(predictionsPayload.summary.totalProducts >= 4);
  const firstItemPrediction = predictionsPayload.predictions.find(
    (item) => item.medicineId === firstItem.id
  );
  assert.ok(firstItemPrediction);
  assert.equal(typeof firstItemPrediction.forecast.forecastDemand, 'number');
  assert.equal(typeof firstItemPrediction.forecast.seasonalityAdjustedForecastDemand, 'number');
  assert.ok(firstItemPrediction.sales.avgDailySales30 > 0);
  assert.ok(firstItemPrediction.seasonality);
  assert.equal(firstItemPrediction.seasonality.weeklyPattern.length, 7);
  assert.ok(firstItemPrediction.seasonality.peakWeekday);
  assert.equal(typeof firstItemPrediction.seasonality.description, 'string');

  const reorderResponse = await fetch(`${baseUrl}/api/analytics/reorder-suggestions`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(reorderResponse.status, 200);

  const reorderPayload = await reorderResponse.json();
  assert.ok(Array.isArray(reorderPayload.items));
  const firstItemReorder = reorderPayload.items.find((item) => item.medicineId === firstItem.id);
  assert.ok(firstItemReorder);
  assert.ok(firstItemReorder.suggestedReorderQuantity > 0);

  const risksResponse = await fetch(`${baseUrl}/api/analytics/risks`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(risksResponse.status, 200);

  const risksPayload = await risksResponse.json();
  assert.ok(Array.isArray(risksPayload.stockoutRisk));
  assert.ok(Array.isArray(risksPayload.expiryRisk));
  assert.ok(Array.isArray(risksPayload.deadStock));
  assert.ok(risksPayload.stockoutRisk.some((item) => item.medicineId === firstItem.id));
  assert.ok(risksPayload.expiryRisk.some((item) => item.medicineId === expiringProduct.id));
});

test('inventory persists across refresh/login, rejects duplicate products, and permits separate batches and strengths', async () => {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
  const product = {
    name: 'Persistence Test Paracetamol',
    genericName: 'Paracetamol',
    mainCategoryId: taxonomyNode('medicines').id,
    subcategoryId: taxonomyNode('medicines/pain-and-fever').id,
    productFormId: taxonomyNode('medicines/pain-and-fever/tablet').id,
    strength: '500 mg',
    dosage: 'Tablet',
    manufacturer: 'Test Manufacturer',
    batchNumber: 'PERSIST-500-A',
    quantity: 10,
    expiryDate: '2028-12-31',
    costPrice: 2,
    sellingPrice: 4,
  };

  const createResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST', headers, body: JSON.stringify(product),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.ok(created.id);
  assert.equal(created.Batches.length, 1);

  const refreshedResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
  assert.equal(refreshedResponse.status, 200);
  const refreshed = await refreshedResponse.json();
  assert.ok(refreshed.data.some((medicine) => medicine.id === created.id));

  const duplicateResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: product.name,
      genericName: product.genericName,
      strength: '500mg',
      dosage: product.dosage,
      manufacturer: product.manufacturer,
    }),
  });
  assert.equal(duplicateResponse.status, 409);

  const secondBatchResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...product, batchNumber: 'PERSIST-500-B', quantity: 10 }),
  });
  assert.equal(secondBatchResponse.status, 201);
  const secondBatchProduct = await secondBatchResponse.json();
  assert.equal(secondBatchProduct.id, created.id);
  assert.equal(secondBatchProduct.Batches.length, 2);

  const differentStrengthResponse = await fetch(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...product, strength: '1g', batchNumber: 'PERSIST-1G-A', quantity: 5 }),
  });
  assert.equal(differentStrengthResponse.status, 201);
  const differentStrength = await differentStrengthResponse.json();
  assert.notEqual(differentStrength.id, created.id);

  const updateResponse = await fetch(`${baseUrl}/api/inventory/${created.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ totalQuantity: 25 }),
  });
  assert.equal(updateResponse.status, 200);

  const updatedRefreshResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
  const updatedRefresh = await updatedRefreshResponse.json();
  const updated = updatedRefresh.data.find((medicine) => medicine.id === created.id);
  assert.equal(updated.Batches.reduce((total, batch) => total + batch.quantity, 0), 25);

  const movementsResponse = await fetch(`${baseUrl}/api/inventory/${created.id}/movements`, { headers });
  assert.equal(movementsResponse.status, 200);
  const movements = await movementsResponse.json();
  assert.ok(movements.data.some((movement) => movement.movementType === 'PURCHASE'));
  assert.ok(movements.data.some((movement) => movement.movementType === 'ADJUSTMENT'));

  const loginAgainResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@example.test', password: 'normal-password-for-tests' }),
  });
  assert.equal(loginAgainResponse.status, 200);
  const loginAgain = await loginAgainResponse.json();
  const afterLoginResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, {
    headers: { Authorization: `Bearer ${loginAgain.token}` },
  });
  const afterLogin = await afterLoginResponse.json();
  assert.ok(afterLogin.data.some((medicine) => medicine.id === created.id));

  const deleteResponse = await fetch(`${baseUrl}/api/inventory/${differentStrength.id}`, {
    method: 'DELETE', headers,
  });
  assert.equal(deleteResponse.status, 200);
  const afterDeleteResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
  const afterDelete = await afterDeleteResponse.json();
  assert.equal(afterDelete.data.some((medicine) => medicine.id === differentStrength.id), false);
});

test('sales creation is idempotent when clientTransactionId is supplied', async (t) => {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  // Find a product with available stock
  const invRes = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
  const inv = await invRes.json();
  const testMed = inv.data.find((m) => m.Batches && m.Batches.some((b) => b.quantity >= 5));
  assert.ok(testMed, 'Found product with sufficient stock');

  const stockBefore = testMed.Batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  const clientTxId = `test_tx_${Date.now()}_sale_idempotency`;

  const missingKeyResponse = await fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      medicineId: testMed.id,
      quantity: 1,
      totalPrice: 10,
      paymentMethod: 'Cash',
    }),
  });
  assert.equal(missingKeyResponse.status, 400);

  // First request
  const concurrentResponses = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      medicineId: testMed.id,
      quantity: 2,
      totalPrice: 20,
      paymentMethod: 'Cash',
      clientTransactionId: clientTxId,
    }),
  })));

  await t.test('admin reversal restores exact original batches once and excludes revenue', async () => {
    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
    const mainCategory = taxonomyNode('medicines');
    const subcategory = taxonomyNode('medicines/pain-and-fever');
    const form = taxonomyNode('medicines/pain-and-fever/tablet');
    const product = {
      name: `Reversal Integration Item ${Date.now()}`,
      genericName: 'Reversal test generic',
      mainCategoryId: mainCategory.id,
      subcategoryId: subcategory.id,
      productFormId: form.id,
      strength: '10 mg',
      dosage: 'Tablet',
    };

    const firstBatchResponse = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...product,
        batchNumber: 'REVERSAL-BATCH-A',
        quantity: 2,
        expiryDate: '2028-01-31',
        costPrice: 2,
        sellingPrice: 5,
      }),
    });
    assert.equal(firstBatchResponse.status, 201);
    const createdMedicine = await firstBatchResponse.json();

    const secondBatchResponse = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...product,
        batchNumber: 'REVERSAL-BATCH-B',
        quantity: 5,
        expiryDate: '2029-01-31',
        costPrice: 3,
        sellingPrice: 5,
      }),
    });
    assert.equal(secondBatchResponse.status, 201);

    const beforeResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
    const beforeInventory = await beforeResponse.json();
    const beforeMedicine = beforeInventory.data.find((medicine) => medicine.id === createdMedicine.id);
    const quantitiesBefore = new Map(beforeMedicine.Batches.map((batch) => [batch.batchNumber, batch.quantity]));
    const revenueBeforeResponse = await fetch(`${baseUrl}/api/analytics/profit-loss?page=1&limit=100`, { headers });
    const revenueBeforePayload = await revenueBeforeResponse.json();
    const revenueBeforeSale = revenueBeforePayload.data.reduce((sum, month) => sum + month.revenue, 0);
    const receiptNumber = `REV-${Date.now()}`;
    const transactionId = `reversal_test_${Date.now()}`;

    const saleResponse = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        medicineId: createdMedicine.id,
        quantity: 4,
        totalPrice: 20,
        paymentMethod: 'Cash',
        receiptNumber,
        clientTransactionId: transactionId,
      }]),
    });
    assert.equal(saleResponse.status, 201);
    const createdSales = await saleResponse.json();
    assert.equal(createdSales.length, 1);
    const sale = createdSales[0];
    assert.equal(sale.soldByUserId, adminUserId);

    const invalidEmailResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/email-receipt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    assert.equal(invalidEmailResponse.status, 400);
    const unconfiguredEmailResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/email-receipt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'customer@example.test' }),
    });
    assert.equal(unconfiguredEmailResponse.status, 409);

    const afterSaleResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
    const afterSaleInventory = await afterSaleResponse.json();
    const afterSaleMedicine = afterSaleInventory.data.find((medicine) => medicine.id === createdMedicine.id);
    assert.equal(afterSaleMedicine.Batches.find((batch) => batch.batchNumber === 'REVERSAL-BATCH-A').quantity, 0);
    assert.equal(afterSaleMedicine.Batches.find((batch) => batch.batchNumber === 'REVERSAL-BATCH-B').quantity, 3);

    const previewResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/reversal-preview`, { headers });
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json();
    assert.equal(preview.saleId, sale.id);
    assert.equal(preview.receiptNumber, receiptNumber);
    assert.equal(preview.soldBy, sale.soldBy);
    assert.deepEqual(
      preview.inventoryImpact.map((impact) => [impact.batchNumber, impact.quantity]),
      [['REVERSAL-BATCH-A', 2], ['REVERSAL-BATCH-B', 2]]
    );

    const createUserResponse = await fetch(`${baseUrl}/api/auth/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: `reversal-user-${Date.now()}`,
        password: 'regular-password-for-test',
        role: 'user',
      }),
    });
    assert.equal(createUserResponse.status, 201);
    const newUser = (await createUserResponse.json()).user;
    assert.equal(newUser.role, 'user');
    const userLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUser.username, password: 'regular-password-for-test' }),
    });
    assert.equal(userLoginResponse.status, 200);
    const userLogin = await userLoginResponse.json();
    assert.equal(userLogin.user.role, 'user');

    const forbiddenResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/reverse`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Unauthorized test reversal' }),
    });
    assert.equal(forbiddenResponse.status, 403);

    const missingReasonResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/reverse`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: '   ' }),
    });
    assert.equal(missingReasonResponse.status, 400);

    await runTestDatabaseStatement(`
      CREATE TRIGGER fail_sale_reversal
      BEFORE INSERT ON InventoryMovements
      WHEN NEW.movementType = 'SALE_REVERSAL'
      BEGIN
        SELECT RAISE(ABORT, 'injected reversal failure');
      END
    `);
    try {
      const failedReversalResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/reverse`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reason: 'Test transaction rollback' }),
      });
      assert.equal(failedReversalResponse.status, 500);

      const unchangedInventoryResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
      const unchangedInventory = await unchangedInventoryResponse.json();
      const unchangedMedicine = unchangedInventory.data.find((medicine) => medicine.id === createdMedicine.id);
      assert.deepEqual(
        unchangedMedicine.Batches.map((batch) => [batch.batchNumber, batch.quantity]),
        afterSaleMedicine.Batches.map((batch) => [batch.batchNumber, batch.quantity]),
      );

      const unchangedSaleResponse = await fetch(`${baseUrl}/api/sales?page=1&limit=100`, { headers });
      const unchangedSales = await unchangedSaleResponse.json();
      assert.equal(unchangedSales.data.find((item) => item.id === sale.id).saleStatus, 'COMPLETED');
    } finally {
      await runTestDatabaseStatement('DROP TRIGGER IF EXISTS fail_sale_reversal');
    }

    const reversalRequests = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/api/sales/${sale.id}/reverse`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: 'Integration test inventory correction' }),
    })));
    assert.equal(reversalRequests.filter((response) => response.status === 200).length, 1);
    assert.ok(reversalRequests.every((response) => [200, 409, 500].includes(response.status)));
    const reversal = await reversalRequests.find((response) => response.status === 200).json();
    assert.equal(reversal.saleStatus, 'REVERSED');
    assert.equal(reversal.refundProcessed, false);

    const duplicateReversalResponse = await fetch(`${baseUrl}/api/sales/${sale.id}/reverse`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: 'Duplicate integration test attempt' }),
    });
    assert.equal(duplicateReversalResponse.status, 409);

    const restoredResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
    const restoredInventory = await restoredResponse.json();
    const restoredMedicine = restoredInventory.data.find((medicine) => medicine.id === createdMedicine.id);
    for (const batch of restoredMedicine.Batches) {
      assert.equal(batch.quantity, quantitiesBefore.get(batch.batchNumber));
    }

    const salesResponse = await fetch(`${baseUrl}/api/sales?page=1&limit=100`, { headers });
    const salesPayload = await salesResponse.json();
    const reversedSale = salesPayload.data.find((item) => item.id === sale.id);
    assert.equal(reversedSale.saleStatus, 'REVERSED');
    assert.equal(reversedSale.reversalReason, 'Integration test inventory correction');
    assert.equal(reversedSale.ReversedBy.username, 'admin@example.test');

    const reportsResponse = await fetch(`${baseUrl}/api/analytics/profit-loss?page=1&limit=100`, { headers });
    assert.equal(reportsResponse.status, 200);
    const reportsPayload = await reportsResponse.json();
    assert.equal(
      reportsPayload.data.reduce((sum, month) => sum + month.revenue, 0),
      revenueBeforeSale,
      'Reversed sale revenue is excluded from analytics'
    );
  });
  assert.ok(concurrentResponses.every((response) => response.status === 201));
  const concurrentSales = await Promise.all(concurrentResponses.map((response) => response.json()));
  const firstSale = concurrentSales[0];
  assert.equal(concurrentSales[1].id, firstSale.id, 'Concurrent duplicate requests return the same sale');
  assert.ok(firstSale.id);
  assert.equal(firstSale.clientTransactionId, clientTxId);

  // Second duplicate request with SAME clientTransactionId (e.g. retry / offline replay)
  const duplicateRes = await fetch(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      medicineId: testMed.id,
      quantity: 2,
      totalPrice: 20,
      paymentMethod: 'Cash',
      clientTransactionId: clientTxId,
    }),
  });
  assert.equal(duplicateRes.status, 201);
  const duplicateSale = await duplicateRes.json();
  assert.equal(duplicateSale.id, firstSale.id, 'Duplicate request returned existing sale ID without re-creating');

  // Verify stock was only deducted ONCE (2 units, not 4)
  const afterRes = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
  const afterInv = await afterRes.json();
  const updatedMed = afterInv.data.find((m) => m.id === testMed.id);
  const stockAfter = updatedMed.Batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  assert.equal(stockAfter, stockBefore - 2, 'Stock was deducted only once despite duplicate request');
});

test('sync endpoint processes offline operations, enforces idempotency, and detects stock conflicts', async () => {
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  const invRes = await fetch(`${baseUrl}/api/inventory?page=1&limit=100`, { headers });
  const inv = await invRes.json();
  const testMed = inv.data.find((m) => m.Batches && m.Batches.some((b) => b.quantity >= 3));
  assert.ok(testMed, 'Found product for sync test');

  const availableStock = testMed.Batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  const validSaleTxId = `sync_tx_${Date.now()}_valid`;
  const conflictSaleTxId = `sync_tx_${Date.now()}_conflict`;

  // 1. Submit batch with valid sale and an over-quantity sale (conflict)
  const syncPayload = {
    operations: [
      {
        clientTransactionId: validSaleTxId,
        type: 'SALE',
        clientTimestamp: new Date().toISOString(),
        payload: {
          medicineId: testMed.id,
          quantity: 1,
          totalPrice: 15,
          paymentMethod: 'Cash',
          receiptNumber: 'REC-OFFLINE-001',
        },
      },
      {
        clientTransactionId: conflictSaleTxId,
        type: 'SALE',
        clientTimestamp: new Date().toISOString(),
        payload: {
          medicineId: testMed.id,
          quantity: availableStock + 9999, // Intentional conflict: impossible quantity
          totalPrice: 99999,
          paymentMethod: 'Cash',
          receiptNumber: 'REC-CONFLICT-001',
        },
      },
    ],
  };

  const syncRes = await fetch(`${baseUrl}/api/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify(syncPayload),
  });

  assert.equal(syncRes.status, 201);
  const syncData = await syncRes.json();
  assert.equal(syncData.success, true);
  assert.equal(syncData.processedCount, 2);
  assert.equal(syncData.syncedCount, 1);
  assert.equal(syncData.conflictCount, 1);

  const validResult = syncData.results.find((r) => r.clientTransactionId === validSaleTxId);
  assert.ok(validResult);
  assert.equal(validResult.status, 'synced');

  const conflictResult = syncData.results.find((r) => r.clientTransactionId === conflictSaleTxId);
  assert.ok(conflictResult);
  assert.equal(conflictResult.status, 'conflict');
  assert.ok(conflictResult.message.includes('Insufficient stock'));

  // 2. Test re-syncing the same operations (idempotency check)
  const resyncRes = await fetch(`${baseUrl}/api/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operations: [
        {
          clientTransactionId: validSaleTxId,
          type: 'SALE',
          payload: { medicineId: testMed.id, quantity: 1, totalPrice: 15 },
        },
      ],
    }),
  });
  assert.equal(resyncRes.status, 201);
  const resyncData = await resyncRes.json();
  assert.equal(resyncData.results[0].status, 'already_synced');

  // 3. Test inventory adjustment sync
  const adjTxId = `sync_adj_${Date.now()}`;
  const adjRes = await fetch(`${baseUrl}/api/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operations: [
        {
          clientTransactionId: adjTxId,
          type: 'ADJUSTMENT',
          payload: {
            medicineId: testMed.id,
            quantityChange: 5,
            reason: 'Received return / donation offline',
          },
        },
      ],
    }),
  });
  assert.equal(adjRes.status, 201);
  const adjData = await adjRes.json();
  assert.equal(adjData.results[0].status, 'synced');
});

  test('split payments are rounded, confirmed, persisted to one sale, and idempotent', async () => {
    const headers = { Authorization: `Bearer ${authToken}` };
    const inventoryResponse = await fetch(`${baseUrl}/api/inventory`, {
      headers,
    });
    const inventory = (await inventoryResponse.json()).data;
    const product = inventory.find((item) => (
      (item.Batches || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0) >= 4
    ));
    assert.ok(product, 'Found a product with stock for split payment tests');
    const stockBefore = product.Batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);

    const clientTransactionId = `split_payment_${Date.now()}`;
    const salePayload = {
      clientTransactionId,
      items: [0, 1].map((index) => ({
        clientTransactionId: `${clientTransactionId}_${index}`,
        medicineId: product.id,
        quantity: 1,
        pricePerUnit: 0.105,
        totalPrice: 0.105,
        paymentMethod: 'Split Payment',
        receiptNumber: `REC-${clientTransactionId}`,
      })),
      payments: [
        { method: 'Cash', amount: 0.11 },
        {
          method: 'Airtel Money',
          amount: 0.11,
          transactionReference: `AIR-${clientTransactionId}`,
          cashierConfirmed: true,
        },
      ],
    };

    const firstResponse = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload),
    });
    assert.equal(firstResponse.status, 201);
    const firstRows = await firstResponse.json();
    assert.equal(firstRows.length, 2);
    assert.equal(firstRows[0].totalPrice, 0.11);
    assert.equal(firstRows[0].paymentMethod, 'Split Payment');
    assert.equal(firstRows[0].saleId, firstRows[0].id);
    assert.ok(firstRows.every((row) => row.saleId === firstRows[0].saleId));
    assert.deepEqual(firstRows[0].payments.map(({ method, amount, status }) => ({ method, amount, status })), [
      { method: 'Cash', amount: 0.11, status: 'CONFIRMED' },
      { method: 'Airtel Money', amount: 0.11, status: 'CASHIER_CONFIRMED' },
    ]);
    assert.equal(firstRows[1].payments, undefined);

    const historyResponse = await fetch(`${baseUrl}/api/sales?limit=100`, { headers });
    assert.equal(historyResponse.status, 200);
    const history = (await historyResponse.json()).data;
    const historySale = history.find((sale) => sale.id === firstRows[0].saleId);
    assert.ok(historySale);
    assert.deepEqual(historySale.Payments.map(({ method, amount, status }) => ({ method, amount, status })), [
      { method: 'Cash', amount: 0.11, status: 'CONFIRMED' },
      { method: 'Airtel Money', amount: 0.11, status: 'CASHIER_CONFIRMED' },
    ]);

    const retryResponse = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload),
    });
    assert.equal(retryResponse.status, 201);
    const retryRows = await retryResponse.json();
    assert.deepEqual(retryRows.map((row) => row.id), firstRows.map((row) => row.id));
    assert.ok(retryRows.every((row) => row.saleId === firstRows[0].saleId));
    assert.deepEqual(retryRows[0].payments, firstRows[0].payments);

    const refreshedResponse = await fetch(`${baseUrl}/api/inventory`, { headers });
    const refreshedInventory = (await refreshedResponse.json()).data;
    const refreshedProduct = refreshedInventory.find((item) => item.id === product.id);
    const stockAfter = refreshedProduct.Batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    assert.equal(stockAfter, stockBefore - 2, 'A split-sale retry does not deduct stock twice');
  });

test('underpayment, overpayment, pending and failed electronic payments are rejected before stock changes', async () => {
  const headers = { Authorization: `Bearer ${authToken}` };
    const inventoryResponse = await fetch(`${baseUrl}/api/inventory`, {
      headers,
    });
    const inventory = (await inventoryResponse.json()).data;
    const product = inventory.find((item) => (
      (item.Batches || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0) >= 3
    ));
    assert.ok(product, 'Found a product with stock for payment validation tests');

    const stockBefore = product.Batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    const invalidPayments = [
      [{ method: 'Cash', amount: 4.99 }],
      [{ method: 'Cash', amount: 5.01 }],
      [{ method: 'Airtel Money', amount: 5, transactionReference: 'PENDING-REF', status: 'PENDING', cashierConfirmed: true }],
      [{ method: 'Card', amount: 5, transactionReference: 'FAILED-REF', status: 'FAILED', cashierConfirmed: true }],
      [{ method: 'MTN Mobile Money', amount: 5, transactionReference: 'NO-CONFIRMATION' }],
    ];

    for (const [index, payments] of invalidPayments.entries()) {
      const transactionId = `invalid_payment_${Date.now()}_${index}`;
      const response = await fetch(`${baseUrl}/api/sales`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientTransactionId: transactionId,
          items: [{
            clientTransactionId: `${transactionId}_0`,
            medicineId: product.id,
            quantity: 1,
            totalPrice: 5,
            paymentMethod: 'Cash',
            receiptNumber: `REC-${transactionId}`,
          }],
          payments,
        }),
      });
      assert.equal(response.status, 400);
    }

    const refreshedResponse = await fetch(`${baseUrl}/api/inventory`, {
      headers,
    });
    const refreshedInventory = (await refreshedResponse.json()).data;
    const refreshedProduct = refreshedInventory.find((item) => item.id === product.id);
    const stockAfter = refreshedProduct.Batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    assert.equal(stockAfter, stockBefore);
  });
