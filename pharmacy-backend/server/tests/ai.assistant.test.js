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
let getAiProviderDiagnostics;
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
    ({
      resolveAiProviderConfig,
      getAiProviderDiagnostics,
      generateAiCompletion,
    } = require('../src/ai/ai-provider.service'));

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

  test('does not reuse or overwrite sessions across authenticated and guest users', async () => {
    const receivedHistories = [];
    const service = new AiService({
      completionFn: async ({ history }) => {
        receivedHistories.push(history);
        return { text: 'Safe reply', provider: 'test' };
      },
    });

    const customerSession = await service.chat(
      { message: 'A private customer question' },
      { clientIp: '10.0.0.6', user: { id: 21, role: 'customer' } }
    );
    const guestSession = await service.chat(
      { sessionId: customerSession.sessionId, message: 'A guest question' },
      { clientIp: '10.0.0.7' }
    );
    const continuingCustomerSession = await service.chat(
      { sessionId: customerSession.sessionId, message: 'Continue privately' },
      { clientIp: '10.0.0.6', user: { id: 21, role: 'customer' } }
    );

    assert.notEqual(guestSession.sessionId, customerSession.sessionId);
    assert.equal(continuingCustomerSession.sessionId, customerSession.sessionId);
    assert.equal(receivedHistories[1].length, 0);
    assert.equal(receivedHistories[2].length, 2);
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
      (error) => {
        const res = error.getResponse?.();
        return error.getStatus?.() === 503 && res?.code === 'AI_NOT_CONFIGURED';
      }
    );

    const geminiCfg = resolveAiProviderConfig({ GEMINI_API_KEY: 'test-key-placeholder' });
    assert.equal(geminiCfg.configured, true);
    assert.equal(geminiCfg.provider, 'gemini');
    assert.equal(geminiCfg.keySource, 'GEMINI_API_KEY');

    const googleAliasCfg = resolveAiProviderConfig({ GOOGLE_API_KEY: 'test-google-key' });
    assert.equal(googleAliasCfg.configured, true);
    assert.equal(googleAliasCfg.provider, 'gemini');
    assert.equal(googleAliasCfg.keySource, 'GOOGLE_API_KEY');

    const genericKeyOnlyCfg = resolveAiProviderConfig({ AI_API_KEY: 'AIzaTestGenericKey123' });
    assert.equal(genericKeyOnlyCfg.configured, true);
    assert.equal(genericKeyOnlyCfg.provider, 'gemini');
    assert.equal(genericKeyOnlyCfg.keySource, 'AI_API_KEY');

    const openaiCfg = resolveAiProviderConfig({ AI_PROVIDER: 'openai', AI_API_KEY: 'test-key-placeholder' });
    assert.equal(openaiCfg.configured, true);
    assert.equal(openaiCfg.provider, 'openai');

    const anthropicAliasCfg = resolveAiProviderConfig({ AI_PROVIDER: 'claude', AI_API_KEY: 'sk-ant-test' });
    assert.equal(anthropicAliasCfg.configured, true);
    assert.equal(anthropicAliasCfg.provider, 'anthropic');

    const diagnostics = getAiProviderDiagnostics({ GEMINI_API_KEY: 'super-secret-value-never-log' });
    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.provider, 'gemini');
    assert.equal(diagnostics.hasApiKey, true);
    assert.equal(diagnostics.keySource, 'GEMINI_API_KEY');
    assert.ok(!JSON.stringify(diagnostics).includes('super-secret-value-never-log'));
  });

  test('sends Gemini key in x-goog-api-key header (never in URL) and returns completion on success', async () => {
    const originalFetch = global.fetch;
    let capturedUrl = '';
    let capturedHeaders = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedHeaders = options?.headers || {};
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Paracetamol 500mg Tablets are in stock at ZMW 22.00.' }],
              },
            },
          ],
        }),
      };
    };

    try {
      const result = await generateAiCompletion(
        { systemPrompt: 'sys', history: [], userMessage: 'Do you have Paracetamol?' },
        { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'secret-gemini-key-xyz', AI_MODEL: 'gemini-2.5-flash' }
      );

      assert.equal(result.provider, 'gemini');
      assert.equal(result.model, 'gemini-2.5-flash');
      assert.match(result.text, /Paracetamol 500mg Tablets/);
      assert.ok(!capturedUrl.includes('secret-gemini-key-xyz'), 'API key must never appear in request URL');
      assert.equal(capturedHeaders['x-goog-api-key'], 'secret-gemini-key-xyz');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('calls OpenAI /chat/completions with Bearer auth and gpt-4o-mini default on success', async () => {
    const originalFetch = global.fetch;
    let capturedUrl = '';
    let capturedHeaders = null;
    let capturedBody = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedHeaders = options?.headers || {};
      capturedBody = JSON.parse(options?.body || '{}');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Paracetamol 500mg Tablets are available in our catalogue for ZMW 22.00.',
              },
              finish_reason: 'stop',
            },
          ],
        }),
      };
    };

    try {
      const result = await generateAiCompletion(
        { systemPrompt: 'sys', history: [], userMessage: 'Do you have Paracetamol?' },
        { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-proj-test-key-xyz', AI_MODEL: '   ' }
      );

      assert.equal(result.provider, 'openai');
      assert.equal(result.model, 'gpt-4o-mini');
      assert.match(result.text, /Paracetamol 500mg Tablets/);
      assert.equal(capturedUrl, 'https://api.openai.com/v1/chat/completions');
      assert.equal(capturedHeaders.Authorization, 'Bearer sk-proj-test-key-xyz');
      assert.equal(capturedBody.model, 'gpt-4o-mini');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('classifies invalid API keys (401/403 and Gemini 400 API_KEY_INVALID) as 503 AI_AUTH_ERROR without exposing secrets', async () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    const loggedLines = [];
    console.error = (...args) => loggedLines.push(args.join(' '));

    try {
      // 401 unauthorized from provider
      global.fetch = async () => ({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: { status: 'UNAUTHENTICATED', message: 'Invalid API key secret-bad-key-123' } }),
      });

      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Hello' },
            { GEMINI_API_KEY: 'secret-bad-key-123' }
          ),
        (error) => {
          const res = error.getResponse?.();
          return (
            error.getStatus?.() === 503 &&
            res?.code === 'AI_AUTH_ERROR' &&
            !JSON.stringify(res).includes('secret-bad-key-123')
          );
        }
      );

      // Gemini 400 API_KEY_INVALID
      global.fetch = async () => ({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            message: 'API key not valid. Please pass a valid API key.',
            details: [{ reason: 'API_KEY_INVALID' }],
          },
        }),
      });

      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Hello' },
            { GEMINI_API_KEY: 'secret-bad-key-123' }
          ),
        (error) => error.getStatus?.() === 503 && error.getResponse?.()?.code === 'AI_AUTH_ERROR'
      );

      const allLogs = loggedLines.join('\n');
      assert.ok(allLogs.includes('"reason":"invalid_api_key"'));
      assert.ok(allLogs.includes('"applicationCode":"AI_AUTHENTICATION_FAILED"'));
      assert.ok(!allLogs.includes('secret-bad-key-123'), 'Logs must never contain API keys');
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  test('handles upstream timeouts (AbortError) as 504 AI_TIMEOUT with structured logging', async () => {
    const originalFetch = global.fetch;
    const originalConsoleWarn = console.warn;
    const warnLines = [];
    console.warn = (...args) => warnLines.push(args.join(' '));

    global.fetch = async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };

    try {
      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Slow query' },
            { GEMINI_API_KEY: 'test-key-timeout', AI_TIMEOUT_MS: '3000' }
          ),
        (error) => error.getStatus?.() === 504 && error.getResponse?.()?.code === 'AI_TIMEOUT'
      );

      global.fetch = async (url, options) => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Response body timed out');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        }),
      });

      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Slow response body' },
            { OPENAI_API_KEY: 'test-key-timeout', AI_TIMEOUT_MS: '2000' }
          ),
        (error) => error.getStatus?.() === 504 && error.getResponse?.()?.code === 'AI_TIMEOUT'
      );

      assert.ok(warnLines.join('\n').includes('"reason":"timeout"'));
      assert.ok(warnLines.join('\n').includes('"applicationCode":"AI_PROVIDER_TIMEOUT"'));
    } finally {
      global.fetch = originalFetch;
      console.warn = originalConsoleWarn;
    }
  });

  test('maps OpenAI rate_limit_exceeded to 429 AI_RATE_LIMITED with Retry-After', async () => {
    const originalFetch = global.fetch;
    const originalConsoleWarn = console.warn;
    const loggedLines = [];
    console.warn = (...args) => loggedLines.push(args.join(' '));
    global.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers({
        'content-type': 'application/json',
        'retry-after': '45',
      }),
      json: async () => ({
        error: {
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
          message: 'Rate limit exceeded',
        },
      }),
    });

    try {
      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Busy query' },
            { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-rl' }
          ),
        (error) => {
          const res = error.getResponse?.();
          return (
            error.getStatus?.() === 429 &&
            res?.code === 'AI_RATE_LIMITED' &&
            res?.retryAfterSeconds === 45
          );
        }
      );
      assert.ok(loggedLines.join('\n').includes('"applicationCode":"AI_RATE_LIMITED"'));
    } finally {
      global.fetch = originalFetch;
      console.warn = originalConsoleWarn;
    }
  });

  test('classifies exhausted OpenAI credits separately and does not return a retry delay', async () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    const loggedLines = [];
    console.error = (...args) => loggedLines.push(args.join(' '));

    try {
      for (const upstreamCode of ['credit_balance_exhausted', 'insufficient_quota']) {
        global.fetch = async () => ({
          ok: false,
          status: 429,
          headers: new Headers({
            'content-type': 'application/json',
            'retry-after': '30',
          }),
          json: async () => ({
            error: {
              type: 'insufficient_quota',
              code: upstreamCode,
              message: 'The account has no remaining API credits.',
            },
          }),
        });

        await assert.rejects(
          () =>
            generateAiCompletion(
              { systemPrompt: 'sys', history: [], userMessage: 'Credit exhaustion test' },
              { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-credits' }
            ),
          (error) => {
            const response = error.getResponse?.();
            return error.getStatus?.() === 503
              && response?.code === 'AI_CREDITS_EXHAUSTED'
              && response?.message === 'The AI assistant is temporarily unavailable. Please try again later.'
              && response?.retryAfterSeconds === undefined;
          }
        );
      }

      const events = loggedLines.map((line) => JSON.parse(line));
      assert.equal(events.length, 2);
      assert.ok(events.every((event) => event.applicationCode === 'AI_CREDITS_EXHAUSTED'));
      assert.ok(events.every((event) => event.reason === 'provider_credits_exhausted'));
      assert.ok(!loggedLines.join('\n').includes('test-key-credits'));
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  test('maps upstream provider outages (503/500 and network errors) to 503 AI_PROVIDER_UNAVAILABLE', async () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    const loggedLines = [];
    console.error = (...args) => loggedLines.push(args.join(' '));
    try {
      global.fetch = async () => ({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: { status: 'UNAVAILABLE', message: 'Overloaded' } }),
      });

      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Outage test' },
            { GEMINI_API_KEY: 'test-key-outage' }
          ),
        (error) => error.getStatus?.() === 503 && error.getResponse?.()?.code === 'AI_PROVIDER_UNAVAILABLE'
      );

      assert.ok(loggedLines.join('\n').includes('"applicationCode":"AI_PROVIDER_UNAVAILABLE"'));
      global.fetch = async () => {
        throw new TypeError('fetch failed');
      };

      await assert.rejects(
        () =>
          generateAiCompletion(
            { systemPrompt: 'sys', history: [], userMessage: 'Network failure test' },
            { GEMINI_API_KEY: 'test-key-net' }
          ),
        (error) => error.getStatus?.() === 503 && error.getResponse?.()?.code === 'AI_PROVIDER_UNAVAILABLE'
      );
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  test('caps high-cardinality in-memory rate-limit buckets', () => {
    const service = new AiService();
    for (let index = 0; index < 2100; index += 1) {
      service.enforceRateLimit(`client:${index}`);
    }
    assert.equal(service.rateLimitBuckets.size, 2000);
  });
});
