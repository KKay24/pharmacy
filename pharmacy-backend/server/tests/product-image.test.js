const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-product-image-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'product-image.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'product-image-test-secret-12345';

const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SAMPLE_PNG_URI = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
const SAMPLE_WEBP_URI = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
const SAMPLE_SVG_URI = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64')}`;

function createMockRes() {
  const headers = {};
  const result = {
    statusCode: 200,
    headers,
    body: undefined,
    redirectUrl: null,
    ended: false,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    redirect(code, url) {
      this.statusCode = code;
      this.redirectUrl = url;
      this.ended = true;
      return this;
    },
  };
  return result;
}

describe('Product image binary endpoint and compactImages mode', () => {
  let sequelize;
  let Medicine;
  let InventoryCategory;
  let InventoryService;
  let StoreService;
  let inventoryService;
  let storeService;
  let pngProduct;
  let webpProduct;
  let httpProduct;
  let svgProduct;
  let noImageProduct;

  before(async () => {
    const { ensureApplicationReady } = require('../src/app.module');
    await ensureApplicationReady();

    const models = require('../models');
    sequelize = models.sequelize;
    Medicine = models.Medicine;
    InventoryCategory = models.InventoryCategory;
    InventoryService = require('../src/inventory/inventory.service');
    StoreService = require('../src/store/store.service');

    inventoryService = new InventoryService();
    storeService = new StoreService();

    const category = await InventoryCategory.findOne({ where: { level: 1 } });

    pngProduct = await Medicine.create({
      name: 'PNG Medicine',
      mainCategoryId: category.id,
      category: category.name,
      imageUrl: SAMPLE_PNG_URI,
      basePrice: 10,
      isCustomerVisible: true,
    });
    webpProduct = await Medicine.create({
      name: 'WebP Medicine',
      mainCategoryId: category.id,
      category: category.name,
      imageUrl: SAMPLE_WEBP_URI,
      basePrice: 12,
      isCustomerVisible: true,
    });
    httpProduct = await Medicine.create({
      name: 'HTTP Medicine',
      mainCategoryId: category.id,
      category: category.name,
      imageUrl: 'https://cdn.example.com/med.jpg',
      basePrice: 15,
      isCustomerVisible: true,
    });
    svgProduct = await Medicine.create({
      name: 'Unsafe SVG Medicine',
      mainCategoryId: category.id,
      category: category.name,
      imageUrl: SAMPLE_SVG_URI,
      basePrice: 5,
      isCustomerVisible: true,
    });
    noImageProduct = await Medicine.create({
      name: 'No Image Medicine',
      mainCategoryId: category.id,
      category: category.name,
      imageUrl: null,
      basePrice: 8,
      isCustomerVisible: true,
    });
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('getProductImage streams decoded binary PNG/WebP with cache and security headers and supports 304', async () => {
    const pngRes = createMockRes();
    await storeService.getProductImage(pngProduct.id, { headers: {} }, pngRes);
    assert.equal(pngRes.statusCode, 200);
    assert.equal(pngRes.headers['content-type'], 'image/png');
    assert.equal(pngRes.headers['x-content-type-options'], 'nosniff');
    assert.equal(pngRes.headers['cross-origin-resource-policy'], 'cross-origin');
    assert.ok(pngRes.headers.etag);
    assert.deepEqual(pngRes.body, Buffer.from(SAMPLE_PNG_BASE64, 'base64'));

    const cachedRes = createMockRes();
    await storeService.getProductImage(
      pngProduct.id,
      { headers: { 'if-none-match': pngRes.headers.etag } },
      cachedRes
    );
    assert.equal(cachedRes.statusCode, 304);
    assert.equal(cachedRes.body, undefined);

    const webpRes = createMockRes();
    await storeService.getProductImage(webpProduct.id, { headers: {} }, webpRes);
    assert.equal(webpRes.statusCode, 200);
    assert.equal(webpRes.headers['content-type'], 'image/webp');
    assert.ok(Buffer.isBuffer(webpRes.body) && webpRes.body.length > 0);
  });

  test('getProductImage redirects https URLs and returns 404 for missing or unsafe SVG images', async () => {
    const httpRes = createMockRes();
    await storeService.getProductImage(httpProduct.id, { headers: {} }, httpRes);
    assert.equal(httpRes.statusCode, 302);
    assert.equal(httpRes.redirectUrl, 'https://cdn.example.com/med.jpg');

    await assert.rejects(
      () => storeService.getProductImage(svgProduct.id, { headers: {} }, createMockRes()),
      (err) => err.getStatus?.() === 404
    );

    await assert.rejects(
      () => storeService.getProductImage(noImageProduct.id, { headers: {} }, createMockRes()),
      (err) => err.getStatus?.() === 404
    );
  });

  test('inventory.list and store.listProducts rewrite data URIs to /api/products/:id/image when compactImages=true', async () => {
    const compactInv = await inventoryService.list({ page: 1, limit: 50, compactImages: 'true' });
    const pngInvRow = compactInv.data.find((m) => m.id === pngProduct.id);
    const webpInvRow = compactInv.data.find((m) => m.id === webpProduct.id);
    const httpInvRow = compactInv.data.find((m) => m.id === httpProduct.id);
    const noImgInvRow = compactInv.data.find((m) => m.id === noImageProduct.id);

    assert.match(pngInvRow.imageUrl, new RegExp(`^/api/products/${pngProduct.id}/image\\?v=\\d+$`));
    assert.match(webpInvRow.imageUrl, new RegExp(`^/api/products/${webpProduct.id}/image\\?v=\\d+$`));
    assert.equal(httpInvRow.imageUrl, 'https://cdn.example.com/med.jpg');
    assert.equal(noImgInvRow.imageUrl, null);

    // Default (without compactImages) preserves original data URI for backward compatibility
    const defaultInv = await inventoryService.list({ page: 1, limit: 50 });
    const defaultPngRow = defaultInv.data.find((m) => m.id === pngProduct.id);
    assert.equal(defaultPngRow.imageUrl, SAMPLE_PNG_URI);

    const compactStore = await storeService.listProducts({ page: 1, limit: 50, compactImages: 'true' });
    const pngStoreRow = compactStore.data.find((m) => m.id === pngProduct.id);
    assert.match(pngStoreRow.imageUrl, new RegExp(`^/api/products/${pngProduct.id}/image\\?v=\\d+$`));
  });
});
