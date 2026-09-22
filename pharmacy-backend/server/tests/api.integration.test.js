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
  assert.equal(payload.user.mustChangePassword, true);
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
      category: 'Diagnostics',
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
