const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-search-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'search.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'true';
process.env.JWT_SECRET = 'search-test-secret-value-12345';

let storeService;
let searchService;
let sequelize;
let Medicine;
let Batch;
let SearchAnalytics;
let SearchSynonym;

describe('Intelligent Product Search Suite', () => {
  before(async () => {
    const { ensureApplicationReady } = require('../src/app.module');
    await ensureApplicationReady();

    const models = require('../models');
    sequelize = models.sequelize;
    Medicine = models.Medicine;
    Batch = models.Batch;
    SearchAnalytics = models.SearchAnalytics;
    SearchSynonym = models.SearchSynonym;

    const StoreService = require('../src/store/store.service');
    storeService = new StoreService();
    searchService = require('../src/store/search.service');

    // Ensure benchmark test products exist
    const { buildProductKey } = require('../src/inventory/product-identity');
    const benchmarkProducts = [
      {
        name: 'Panadol Extra Tablets',
        brandName: 'Panadol',
        genericName: 'Paracetamol',
        strength: '500mg',
        dosage: 'Tablet',
        category: 'Medicines',
        basePrice: 45.0,
        totalQuantity: 100,
        isCustomerVisible: true,
        description: 'Panadol Extra tablets with paracetamol and caffeine for fast relief of tough pain and headache.',
      },
      {
        name: 'Paracetamol 500mg Tablets',
        brandName: 'MediQuick',
        genericName: 'Paracetamol',
        strength: '500mg',
        dosage: 'Tablet',
        category: 'Medicines',
        basePrice: 20.0,
        totalQuantity: 150,
        isCustomerVisible: true,
        description: 'Generic paracetamol 500mg tablets for effective pain relief and fever reduction.',
      },
      {
        name: 'Amoxicillin 500mg Capsules',
        brandName: 'Amoxil',
        genericName: 'Amoxicillin',
        strength: '500mg',
        dosage: 'Capsule',
        category: 'Medicines',
        basePrice: 65.0,
        totalQuantity: 80,
        isCustomerVisible: true,
        prescriptionRequired: true,
        description: 'Amoxicillin 500mg broad-spectrum antibiotic capsules for bacterial infections.',
      },
      {
        name: 'Oral Rehydration Salts (ORS)',
        brandName: 'ORS',
        genericName: 'Oral Rehydration Salts',
        strength: '20.5g',
        dosage: 'Powder',
        category: 'Medicines',
        basePrice: 15.0,
        totalQuantity: 200,
        isCustomerVisible: true,
        description: 'WHO-formula Oral Rehydration Salts sachets for rapid electrolyte replacement.',
      },
      {
        name: 'Vit C plus',
        brandName: 'Vit C plus',
        genericName: 'Ascorbic Acid + Zinc',
        strength: '1000mg',
        dosage: 'Tablet',
        category: 'Vitamins & Supplements',
        basePrice: 55.0,
        totalQuantity: 90,
        isCustomerVisible: true,
        description: 'Effervescent Vitamin C plus Zinc tablets for daily immune defence.',
      },
    ];

    for (const p of benchmarkProducts) {
      const [med] = await Medicine.findOrCreate({
        where: { name: p.name },
        defaults: { ...p, productKey: buildProductKey(p) },
      });
      await med.update(p);

      const batches = await Batch.findAll({ where: { medicineId: med.id } });
      if (batches.length === 0) {
        await Batch.create({
          medicineId: med.id,
          batchNumber: `BATCH-TEST-${med.id}`,
          quantity: p.totalQuantity,
          expiryDate: '2028-12-31',
          costPrice: 10,
          sellingPrice: p.basePrice,
          warehouse: 'Dispensary',
        });
      }
    }
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  // 1. Case-Insensitive Search
  test('Case-insensitive search returns identical results for Panadol, PANADOL, panadol, and PaNaDoL', async () => {
    const r1 = await storeService.listProducts({ search: 'Panadol' });
    const r2 = await storeService.listProducts({ search: 'PANADOL' });
    const r3 = await storeService.listProducts({ search: 'panadol' });
    const r4 = await storeService.listProducts({ search: 'PaNaDoL' });

    assert.ok(r1.data.length > 0, 'Found results for Panadol');
    assert.equal(r1.pagination.total, r2.pagination.total);
    assert.equal(r1.pagination.total, r3.pagination.total);
    assert.equal(r1.pagination.total, r4.pagination.total);

    const names1 = r1.data.map((p) => p.name);
    const names2 = r2.data.map((p) => p.name);
    assert.deepEqual(names1, names2);
    assert.ok(names1.includes('Panadol Extra Tablets'));
  });

  // 2. Partial Search
  test('Partial search "parace" finds Paracetamol and Panadol', async () => {
    const res = await storeService.listProducts({ search: 'parace' });
    assert.ok(res.data.length > 0);
    const names = res.data.map((p) => p.name);
    assert.ok(names.some((n) => n.includes('Paracetamol') || n.includes('Panadol')));
  });

  test('Partial search "amox" finds Amoxicillin', async () => {
    const res = await storeService.listProducts({ search: 'amox' });
    assert.ok(res.data.length > 0);
    const names = res.data.map((p) => p.name);
    assert.ok(names.some((n) => n.includes('Amoxicillin')));
  });

  // 3. Typo Tolerance
  test('Typo tolerance: "paracetmol" finds paracetamol products and gives spelling suggestion', async () => {
    const res = await storeService.listProducts({ search: 'paracetmol' });
    assert.ok(res.data.length > 0, 'Should find products despite typo');
    const names = res.data.map((p) => p.name);
    assert.ok(names.some((n) => n.includes('Paracetamol') || n.includes('Panadol')));
    assert.ok(res.search?.spellingSuggestion, 'Should offer spelling suggestion');
  });

  test('Typo tolerance: "amoxilin" finds amoxicillin products', async () => {
    const res = await storeService.listProducts({ search: 'amoxilin' });
    assert.ok(res.data.length > 0, 'Should find Amoxicillin despite typo');
    const names = res.data.map((p) => p.name);
    assert.ok(names.some((n) => n.includes('Amoxicillin')));
  });

  test('Typo tolerance: "panadolx" finds Panadol', async () => {
    const res = await storeService.listProducts({ search: 'panadolx' });
    assert.ok(res.data.length > 0);
    const names = res.data.map((p) => p.name);
    assert.ok(names.some((n) => n.includes('Panadol')));
  });

  // 4. Brand and Generic Search
  test('Search by Brand Name ("Panadol")', async () => {
    const res = await storeService.listProducts({ search: 'Panadol' });
    assert.ok(res.data.length > 0);
    assert.equal(res.data[0].brandName, 'Panadol');
  });

  test('Search by Generic Name ("Paracetamol")', async () => {
    const res = await storeService.listProducts({ search: 'Paracetamol' });
    assert.ok(res.data.length > 0);
    assert.ok(res.data.some((p) => p.genericName === 'Paracetamol'));
  });

  test('Search by Active Ingredient in description or formulation ("Ascorbic Acid")', async () => {
    const res = await storeService.listProducts({ search: 'Ascorbic Acid' });
    assert.ok(res.data.length > 0);
    assert.ok(res.data.some((p) => p.name === 'Vit C plus' || p.genericName?.includes('Ascorbic Acid')));
  });

  // 5. Pharmacy-Specific Synonyms
  test('Synonym: "painkiller" finds pain relief medicines', async () => {
    const res = await storeService.listProducts({ search: 'painkiller' });
    assert.ok(res.data.length > 0);
    const names = res.data.map((p) => p.name);
    assert.ok(names.some((n) => n.includes('Paracetamol') || n.includes('Panadol') || n.includes('Brustan')));
  });

  test('Synonym: "headache medicine" finds pain relief medicines', async () => {
    const res = await storeService.listProducts({ search: 'headache medicine' });
    assert.ok(res.data.length > 0);
  });

  test('Synonym: "Vitamin C" finds Vit C plus', async () => {
    const res = await storeService.listProducts({ search: 'Vitamin C' });
    assert.ok(res.data.length > 0);
    assert.ok(res.data.some((p) => p.name === 'Vit C plus'));
  });

  test('Synonym: "ORS" finds Oral Rehydration Salts', async () => {
    const res = await storeService.listProducts({ search: 'ORS' });
    assert.ok(res.data.length > 0);
    assert.ok(res.data.some((p) => p.name.includes('Oral Rehydration')));
  });

  // 6. Empty and No-Result Queries
  test('Empty search query returns standard paginated catalogue without error', async () => {
    const res = await storeService.listProducts({ search: '' });
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length > 0);
    assert.ok(res.pagination.total > 0);
  });

  test('No-result search query returns empty list with suggested related products', async () => {
    const res = await storeService.listProducts({ search: 'nonexistentproductxyz999' });
    assert.equal(res.data.length, 0);
    assert.equal(res.pagination.total, 0);
    assert.ok(res.search);
    assert.ok(Array.isArray(res.search.relatedProducts));
    assert.ok(res.search.relatedProducts.length > 0, 'Offers related products as alternatives');
  });

  // 7. Duplicate Prevention and Pagination
  test('Search results contain no duplicate product IDs', async () => {
    const res = await storeService.listProducts({ search: 'paracetamol', limit: 50 });
    const ids = res.data.map((p) => p.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, 'All product IDs in search must be distinct');
  });

  test('Pagination works accurately on search queries', async () => {
    const page1 = await storeService.listProducts({ search: 'paracetamol', page: 1, limit: 1 });
    const page2 = await storeService.listProducts({ search: 'paracetamol', page: 2, limit: 1 });

    assert.equal(page1.data.length, 1);
    if (page1.pagination.total > 1) {
      assert.equal(page2.data.length, 1);
      assert.notEqual(page1.data[0].id, page2.data[0].id, 'Page 1 and Page 2 should not have overlapping items');
    }
  });

  // 8. Search Relevance Ranking
  test('Relevance ranking orders exact name > exact brand > exact generic > partial > fuzzy', async () => {
    const { buildProductKey } = require('../src/inventory/product-identity');
    const rankingFixtures = [
      {
        name: 'Ibuprofen',
        brandName: 'GenericCare',
        genericName: 'Ibuprofen',
        strength: '400mg',
        dosage: 'Tablet',
        category: 'Medicines',
        basePrice: 18.0,
        totalQuantity: 50,
        isCustomerVisible: true,
        description: 'Plain ibuprofen tablets.',
      },
      {
        name: 'Advil Pain Caplets',
        brandName: 'Ibuprofen',
        genericName: 'NSAID Compound',
        strength: '400mg',
        dosage: 'Tablet',
        category: 'Medicines',
        basePrice: 30.0,
        totalQuantity: 50,
        isCustomerVisible: true,
        description: 'Pain relief caplets.',
      },
      {
        name: 'FastRelief Tabs',
        brandName: 'FastRelief',
        genericName: 'Ibuprofen',
        strength: '200mg',
        dosage: 'Tablet',
        category: 'Medicines',
        basePrice: 22.0,
        totalQuantity: 50,
        isCustomerVisible: true,
        description: 'Gentle dose pain relief.',
      },
      {
        name: 'Ibuprofen Gel 5%',
        brandName: 'TopicalCare',
        genericName: 'Ibuprofen Topical',
        strength: '5%',
        dosage: 'Gel',
        category: 'Medicines',
        basePrice: 40.0,
        totalQuantity: 50,
        isCustomerVisible: true,
        description: 'Topical pain relief gel.',
      },
    ];

    for (const p of rankingFixtures) {
      const [med] = await Medicine.findOrCreate({
        where: { name: p.name },
        defaults: { ...p, productKey: buildProductKey(p) },
      });
      await med.update(p);
    }

    const res = await storeService.listProducts({ search: 'Ibuprofen', limit: 20 });
    assert.ok(res.data.length >= 4);
    assert.equal(res.data[0].name, 'Ibuprofen');
    assert.equal(res.data[0].searchMatchType, 'exact_name');
    assert.equal(res.data[1].name, 'Advil Pain Caplets');
    assert.equal(res.data[1].searchMatchType, 'exact_brand');
    assert.equal(res.data[2].name, 'FastRelief Tabs');
    assert.equal(res.data[2].searchMatchType, 'exact_generic');
    assert.ok(res.data[0].searchScore > res.data[1].searchScore);
    assert.ok(res.data[1].searchScore > res.data[2].searchScore);
    assert.ok(res.data[2].searchScore > res.data[3].searchScore);
  });

  test('Store search results preserve existing contract without exposing raw inventory fields', async () => {
    const res = await storeService.listProducts({ search: 'Panadol' });
    assert.ok(res.data.length > 0);
    assert.equal(res.data[0].stock, undefined);
    assert.equal(res.data[0].inStock, undefined);
    assert.equal(res.data[0].batches, undefined);
  });

  // 9. Autocomplete Suggestions
  test('Autocomplete endpoint returns structured suggestions, products, brand, strength, and batch price', async () => {
    const auto = await storeService.getAutocomplete({ q: 'panad' });
    assert.ok(auto);
    assert.ok(Array.isArray(auto.products));
    assert.ok(Array.isArray(auto.suggestions));
    assert.ok(auto.products.length > 0);
    assert.ok(auto.products[0].name.includes('Panadol'));
    assert.equal(auto.products[0].brandName, 'Panadol');
    assert.equal(auto.products[0].strength, '500mg');
    assert.ok(typeof auto.products[0].price === 'number');
  });

  // 10. Similar Products with Medical Safety
  test('Similar products clearly distinguishes generic equivalents from different strengths and active ingredients', async () => {
    const panadol = await Medicine.findOne({ where: { name: 'Panadol Extra Tablets' } });
    assert.ok(panadol, 'Panadol exists');

    // Add a different-strength Paracetamol (1000mg) to verify it is NOT classified as DIRECT_EQUIVALENT
    const { buildProductKey } = require('../src/inventory/product-identity');
    const highDose = {
      name: 'Paracetamol 1000mg Suppositories',
      brandName: 'MediQuick',
      genericName: 'Paracetamol',
      strength: '1000mg',
      dosage: 'Suppository',
      category: 'Medicines',
      basePrice: 35.0,
      totalQuantity: 40,
      isCustomerVisible: true,
    };
    const [highDoseMed] = await Medicine.findOrCreate({
      where: { name: highDose.name },
      defaults: { ...highDose, productKey: buildProductKey(highDose) },
    });
    await highDoseMed.update(highDose);

    const alternatives = await storeService.getProductAlternatives(panadol.id);
    assert.ok(alternatives);
    assert.ok(alternatives.targetProduct);

    // Paracetamol 500mg Tablet should be in directEquivalents
    assert.ok(Array.isArray(alternatives.directEquivalents));
    const equivNames = alternatives.directEquivalents.map((a) => a.medicine.name);
    assert.ok(equivNames.includes('Paracetamol 500mg Tablets'));
    assert.ok(!equivNames.includes('Paracetamol 1000mg Suppositories'), 'Different strength/form must never be DIRECT_EQUIVALENT');

    const directEquiv = alternatives.directEquivalents.find((a) => a.medicine.name === 'Paracetamol 500mg Tablets');
    assert.equal(directEquiv.level, 'DIRECT_EQUIVALENT');
    assert.equal(directEquiv.pharmacistReviewRequired, true);
    assert.ok(directEquiv.medicalSafetyNotice.includes('Equivalent active ingredient'));

    // Paracetamol 1000mg Suppository must be in differentStrengthOrForm
    assert.ok(
      alternatives.differentStrengthOrForm.some((a) => a.medicine.name === 'Paracetamol 1000mg Suppositories'),
      'Different strength/form should appear in differentStrengthOrForm'
    );

    // Check therapeutic class alternatives (different active ingredient)
    if (alternatives.relatedTherapeutic.length > 0) {
      for (const alt of alternatives.relatedTherapeutic) {
        assert.equal(alt.level, 'THERAPEUTIC_CLASS');
        assert.equal(alt.pharmacistReviewRequired, true);
        assert.ok(alt.medicalSafetyNotice.includes('NOT a direct substitute'));
      }
    }
  });

  // 11. Search Analytics & Auth Guard Verification
  test('Search analytics records search queries, zero results, and product clicks', async () => {
    const panadol = await Medicine.findOne({ where: { name: 'Panadol Extra Tablets' } });
    await storeService.listProducts({ search: 'nonexistentanalyticsquery777' });
    await storeService.recordSearchClick({
      query: 'panadol extra',
      productId: panadol.id,
      sessionId: 'test-session-123',
    });

    const summary = await storeService.getSearchAnalytics({ days: 1 });
    assert.ok(summary);
    assert.ok(summary.totals);
    assert.ok(summary.totals.totalClicks >= 1);
    assert.ok(Array.isArray(summary.popularTerms));
    assert.ok(Array.isArray(summary.zeroResultSearches));
    assert.ok(Array.isArray(summary.topClickedProducts));
    assert.ok(summary.zeroResultSearches.some((item) => item.query === 'nonexistentanalyticsquery777'));
    assert.ok(summary.topClickedProducts.some((item) => item.productId === panadol.id && item.name === 'Panadol Extra Tablets'));
  });

  test('GET /api/products/search/analytics is restricted to admin and manager roles', () => {
    const StoreController = require('../src/store/store.controller');
    const AuthGuard = require('../src/auth/auth.guard');
    const { ROLES_KEY, RolesGuard } = require('../src/auth/roles.guard');

    const guards = Reflect.getMetadata('__guards__', StoreController.prototype.searchAnalytics) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, StoreController.prototype.searchAnalytics) || [];

    assert.ok(guards.includes(AuthGuard), 'searchAnalytics must require AuthGuard');
    assert.ok(guards.includes(RolesGuard), 'searchAnalytics must require RolesGuard');
    assert.deepEqual(roles, ['admin', 'manager']);
  });
});

