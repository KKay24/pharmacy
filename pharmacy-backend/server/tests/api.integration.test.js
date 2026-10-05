const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const { execFileSync } = require('node:child_process');
const net = require('node:net');

let childProcess;
let baseUrl;
let authToken;
let createdSaleId;
let inventoryTaxonomy = [];

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
    }),
  });

  assert.equal(response.status, 201);

  const sale = await response.json();
  assert.ok(sale.id);
  assert.equal(sale.medicineId, firstItem.id);

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

test('sales creation is idempotent when clientTransactionId is supplied', async () => {
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

  // First request
  const firstRes = await fetch(`${baseUrl}/api/sales`, {
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
  assert.equal(firstRes.status, 201);
  const firstSale = await firstRes.json();
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
          paymentMethod: 'Mobile',
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
