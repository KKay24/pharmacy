const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
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
      const response = await fetch(`${url}/api/test`);
      if (response.ok) {
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

  childProcess = spawn('node', ['server.js'], {
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
      username: 'admin',
      password: 'admin1234',
    }),
  });

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.user.role, 'admin');
  assert.ok(payload.token);

  authToken = payload.token;
});

test('inventory can be fetched with the issued token', async () => {
  const response = await fetch(`${baseUrl}/api/inventory`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  assert.equal(response.status, 200);

  const inventory = await response.json();
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
  const inventory = await inventoryResponse.json();
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

  const analytics = await response.json();
  assert.ok(Array.isArray(analytics));
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

  const inventory = await inventoryResponse.json();
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
