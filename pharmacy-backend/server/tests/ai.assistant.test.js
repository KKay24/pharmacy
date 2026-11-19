const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-ai-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'ai.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'ai-test-secret-value-12345';

let sequelize;
let Medicine;
let Batch;
let AiService;
let resolveAiProviderConfig;
let generateAiCompletion;

describe('MediQuick Smart Assistant (Medical AI Backend)', () => {
  before(async () => {
    const { ensureApplicationReady } = require('../src/app.module');
    await ensureApplicationReady();

    const models = require('../models');
    sequelize = models.sequelize;
    Medicine = models.Medicine;
    Batch = models.Batch;
    AiService = require('../src/ai/ai.service');
    ({ resolveAiProviderConfig, generateAiCompletion } = require('../src/ai/ai-provider.service'));

    const { buildProductKey } = require('../src/inventory/product-identity');

    // 1. Out-of-stock branded Panadol 500mg Tablet (zero stock!)
    const panadolData = {
      name: 'Panadol 500mg Tablets',
      brandName: 'Panadol',
      genericName: 'Paracetamol',
      strength: '500mg',
      dosage: 'Tablet',
      category: 'Medicines',
      basePrice: 40,
      totalQuantity: 0,
      isCustomerVisible: true,
      prescriptionRequired: false,
    };
    const [panadol] = await Medicine.findOrCreate({
      where: { name: panadolData.name },
      defaults: { ...panadolData, productKey: buildProductKey(panadolData) },
    });
    await Batch.create({
      medicineId: panadol.id,
      batchNumber: 'AI-TEST-OOS-1',
      quantity: 0,
      expiryDate: '2029-12-31',
      costPrice: 20,
      sellingPrice: 42,
      warehouse: 'Dispensary',
    });

    // 2. In-stock exact generic equivalent (same active ingredient, strength, dosage form)
    const paraGenericData = {
      name: 'Paracetamol 500mg Tablets',
      brandName: 'MediQuick',
      genericName: 'Paracetamol',
      strength: '500mg',
      dosage: 'Tablet',
      category: 'Medicines',
      basePrice: 18,
      totalQuantity: 100,
      isCustomerVisible: true,
      prescriptionRequired: false,
    };
    const [paraGeneric] = await Medicine.findOrCreate({
      where: { name: paraGenericData.name },
      defaults: { ...paraGenericData, productKey: buildProductKey(paraGenericData) },
    });
    await Batch.create({
      medicineId: paraGeneric.id,
      batchNumber: 'AI-TEST-IN-1',
      quantity: 80,
      expiryDate: '2029-12-31',
      costPrice: 10,
      sellingPrice: 22,
      warehouse: 'Dispensary',
    });

    // 3. Different strength Paracetamol (1000mg Suppository) — MUST NOT appear as direct verified alternative
    const paraHighData = {
      name: 'Paracetamol 1000mg Suppositories',
      brandName: 'MediQuick',
      genericName: 'Paracetamol',
      strength: '1000mg',
      dosage: 'Suppository',
      category: 'Medicines',
      basePrice: 35,
      totalQuantity: 50,
      isCustomerVisible: true,
      prescriptionRequired: false,
    };
    const [paraHigh] = await Medicine.findOrCreate({
      where: { name: paraHighData.name },
      defaults: { ...paraHighData, productKey: buildProductKey(paraHighData) },
    });
    await Batch.create({
      medicineId: paraHigh.id,
      batchNumber: 'AI-TEST-HIGH-1',
      quantity: 50,
      expiryDate: '2029-12-31',
      costPrice: 18,
      sellingPrice: 35,
      warehouse: 'Dispensary',
    });

    // 4. Expired-only stock product — MUST report inStock: false!
    const expiredMedData = {
      name: 'Vitamin C 1000mg Effervescent',
      brandName: 'VitalC',
      genericName: 'Ascorbic Acid',
      strength: '1000mg',
      dosage: 'Tablet',
      category: 'Vitamins & Supplements',
      basePrice: 55,
      totalQuantity: 40,
      isCustomerVisible: true,
      prescriptionRequired: false,
    };
    const [expiredMed] = await Medicine.findOrCreate({
      where: { name: expiredMedData.name },
      defaults: { ...expiredMedData, productKey: buildProductKey(expiredMedData) },
    });
    await Batch.create({
      medicineId: expiredMed.id,
      batchNumber: 'AI-TEST-EXP-1',
      quantity: 40,
      expiryDate: '2020-01-01',
      costPrice: 25,
      sellingPrice: 55,
      warehouse: 'Dispensary',
    });
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('detects medical emergencies immediately without calling external AI provider', async () => {
    let aiCalled = false;
    const service = new AiService({
      completionFn: async () => {
        aiCalled = true;
        return { text: 'Should never be called', provider: 'test' };
      },
    });

    const result = await service.chat(
      { message: 'I have severe chest pain and trouble breathing right now' },
      { clientIp: '10.0.0.1' }
    );

    assert.equal(aiCalled, false);
    assert.equal(result.emergency, true);
    assert.equal(result.recommendPharmacist, true);
    assert.match(result.reply, /emergency/i);
    assert.ok(result.sessionId);
  });

  test('grounds AI prompts with real MediQuick prices, live batch stock, and only verified direct equivalents', async () => {
    let capturedPrompt = '';
    const service = new AiService({
      completionFn: async ({ systemPrompt }) => {
        capturedPrompt = systemPrompt;
        return {
          text: 'Panadol 500mg Tablets is currently out of stock, while Paracetamol 500mg Tablets (ZMW 22.00) is in stock. Please confirm any switch with our pharmacist.',
          provider: 'test-provider',
        };
      },
    });

    const res = await service.chat(
      { message: 'Do you have Panadol 500mg Tablets in stock?' },
      { clientIp: '10.0.0.2' }
    );

    assert.equal(res.emergency, false);
    assert.ok(res.products.length > 0);

    const panadol = res.products.find((p) => p.name === 'Panadol 500mg Tablets');
    assert.ok(panadol, 'Panadol returned from live DB');
    assert.equal(panadol.inStock, false, 'Zero-stock batch must never be marked inStock');
    assert.equal(panadol.price, 42);
    assert.match(panadol.url, /^\/product\/\d+$/);

    // Verify safe alternative logic: only same-ingredient + same-strength + same-form in-stock item included
    const altNames = res.verifiedAlternatives.map((a) => a.product.name);
    assert.ok(altNames.includes('Paracetamol 500mg Tablets'));
    assert.ok(
      !altNames.includes('Paracetamol 1000mg Suppositories'),
      'Different strength/form must NEVER appear in verifiedAlternatives'
    );
    assert.ok(capturedPrompt.includes('VERIFIED_CATALOGUE'));
    assert.ok(capturedPrompt.includes('Paracetamol 500mg Tablets'));
  });

  test('never marks expired-only stock as inStock', async () => {
    const service = new AiService({
      completionFn: async () => ({ text: 'Checked catalogue.', provider: 'test' }),
    });

    const res = await service.chat(
      { message: 'Is Vitamin C 1000mg Effervescent available?' },
      { clientIp: '10.0.0.3' }
    );

    const vitC = res.products.find((p) => p.name === 'Vitamin C 1000mg Effervescent');
    assert.ok(vitC);
    assert.equal(vitC.inStock, false, 'Expired batch must be treated as out of stock');
  });

  test('maintains multi-turn session history and supports clearing a session', async () => {
    const receivedHistories = [];
    const service = new AiService({
      completionFn: async ({ history, userMessage }) => {
        receivedHistories.push(history.map((h) => `${h.role}:${h.content}`));
        return { text: `Reply to: ${userMessage}`, provider: 'test' };
      },
    });

    const first = await service.chat({ message: 'Tell me about Paracetamol' }, { clientIp: '10.0.0.4' });
    const second = await service.chat(
      { sessionId: first.sessionId, message: 'What is the price?' },
      { clientIp: '10.0.0.4' }
    );

    assert.equal(second.sessionId, first.sessionId);
    assert.equal(receivedHistories[0].length, 0);
    assert.equal(receivedHistories[1].length, 2);

    const cleared = service.clearSession(first.sessionId);
    assert.equal(cleared.cleared, true);

    await service.chat({ sessionId: first.sessionId, message: 'Fresh start' }, { clientIp: '10.0.0.4' });
    assert.equal(receivedHistories[2].length, 0);
  });

  test('flags recommendPharmacist for dosing, pregnancy, or interaction questions', async () => {
    const service = new AiService({
      completionFn: async () => ({ text: 'Please consult a MediQuick pharmacist.', provider: 'test' }),
    });

    const res = await service.chat(
      { message: 'What dosage of ibuprofen is safe during pregnancy and can it interact with my blood pressure pills?' },
      { clientIp: '10.0.0.5' }
    );

    assert.equal(res.recommendPharmacist, true);
  });

  test('enforces rate limiting and returns 429 when exceeded', async () => {
    const prevMax = process.env.AI_RATE_LIMIT_MAX;
    process.env.AI_RATE_LIMIT_MAX = '2';
    try {
      const service = new AiService({
        completionFn: async () => ({ text: 'OK', provider: 'test' }),
      });

      await service.chat({ message: 'First question' }, { clientIp: '10.0.0.99' });
      await service.chat({ message: 'Second question' }, { clientIp: '10.0.0.99' });

      await assert.rejects(
        () => service.chat({ message: 'Third question' }, { clientIp: '10.0.0.99' }),
        (error) => error.getStatus && error.getStatus() === 429
      );
    } finally {
      if (prevMax === undefined) delete process.env.AI_RATE_LIMIT_MAX;
      else process.env.AI_RATE_LIMIT_MAX = prevMax;
    }
  });

  test('validates empty and excessively long messages with 400 BadRequestException', async () => {
    const service = new AiService({
      completionFn: async () => ({ text: 'OK', provider: 'test' }),
    });

    await assert.rejects(
      () => service.chat({ message: '   ' }, { clientIp: '10.0.0.6' }),
      (error) => error.getStatus && error.getStatus() === 400
    );

    await assert.rejects(
      () => service.chat({ message: 'a'.repeat(1005) }, { clientIp: '10.0.0.6' }),
      (error) => error.getStatus && error.getStatus() === 400
    );
  });

  test('never returns mock AI responses when AI credentials are unconfigured (returns 503)', async () => {
    await assert.rejects(
      () =>
        generateAiCompletion(
          { systemPrompt: 'sys', history: [], userMessage: 'Hello' },
          {} // empty env -> no credentials
        ),
      (error) => error.getStatus && error.getStatus() === 503
    );

    const geminiCfg = resolveAiProviderConfig({ GEMINI_API_KEY: 'test-key-placeholder' });
    assert.equal(geminiCfg.configured, true);
    assert.equal(geminiCfg.provider, 'gemini');

    const openaiCfg = resolveAiProviderConfig({ AI_PROVIDER: 'openai', AI_API_KEY: 'test-key-placeholder' });
    assert.equal(openaiCfg.configured, true);
    assert.equal(openaiCfg.provider, 'openai');
  });
});
