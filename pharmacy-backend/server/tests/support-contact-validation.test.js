const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-support-val-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'support.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'test-support-validation-secret-12345';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const { sequelize, SupportInquiry } = require('../models');
const { runMigrations } = require('../lib/migrations');
const StoreService = require('../src/store/store.service');
const {
  validateAndNormalizePhone,
  validateAndNormalizeOptionalEmail,
} = require('../src/store/contact-validation');

const storeService = new StoreService();

test.before(async () => {
  await sequelize.authenticate();
  await runMigrations();
});

test.after(async () => {
  await sequelize.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('validates and normalizes local Zambian and international phone numbers to E.164', () => {
  const validCases = [
    ['0977123456', undefined, '+260977123456'],
    ['0966 123 456', undefined, '+260966123456'],
    ['0771234567', undefined, '+260771234567'],
    ['0761234567', undefined, '+260761234567'],
    ['0955123456', undefined, '+260955123456'],
    ['0211 123 456', undefined, '+260211123456'],
    ['+260 97 712 3456', 'ZM', '+260977123456'],
    ['260977123456', 'ZM', '+260977123456'],
    ['+27 82 123 4567', 'ZM', '+27821234567'],
    ['082 123 4567', 'ZA', '+27821234567'],
  ];

  for (const [input, country, expected] of validCases) {
    const result = validateAndNormalizePhone(input, country);
    assert.equal(result.valid, true, `Expected ${input} (${country || 'ZM'}) to be valid`);
    assert.equal(result.normalized, expected);
  }

  const invalidCases = [
    '',
    '   ',
    '12345',
    '097123',
    '+260 12 345 6789',
    '0977abc456',
    '+260 97 712 3456789',
  ];

  for (const input of invalidCases) {
    const result = validateAndNormalizePhone(input, 'ZM');
    assert.equal(result.valid, false, `Expected "${input}" to be rejected`);
    assert.ok(result.error);
  }
});

test('validates optional email, trims whitespace, and rejects malformed addresses', () => {
  assert.deepEqual(validateAndNormalizeOptionalEmail(undefined), { valid: true, normalized: null, error: null });
  assert.deepEqual(validateAndNormalizeOptionalEmail(''), { valid: true, normalized: null, error: null });
  assert.deepEqual(validateAndNormalizeOptionalEmail('   '), { valid: true, normalized: null, error: null });
  assert.deepEqual(validateAndNormalizeOptionalEmail('  jane.banda@mediquick.co.zm  '), {
    valid: true,
    normalized: 'jane.banda@mediquick.co.zm',
    error: null,
  });

  for (const bad of ['not-an-email', 'jane@', '@example.com', 'jane@invalid', 'jane banda@example.com']) {
    const result = validateAndNormalizeOptionalEmail(bad);
    assert.equal(result.valid, false, `Expected "${bad}" to be invalid`);
    assert.ok(result.error);
  }
});

test('StoreService.createSupportInquiry enforces backend validation, stores E.164 phone, trims email, and preserves existing records', async () => {
  // Seed a legacy record directly to verify existing records are preserved cleanly
  const legacy = await SupportInquiry.create({
    inquiryType: 'Order issue',
    name: 'Legacy Customer',
    phone: '097-LEGACY',
    email: null,
    message: 'Existing historical ticket',
    status: 'New',
  });

  // Valid submission with local ZM format + whitespace around email
  const created = await storeService.createSupportInquiry({
    name: '  Chanda Mwale  ',
    phone: '0977 555 222',
    email: '  chanda@example.com  ',
    inquiryType: 'Prescription query',
    message: '  Can I refill my prescription?  ',
  });

  assert.equal(created.success, true);
  assert.equal(created.inquiry.name, 'Chanda Mwale');
  assert.equal(created.inquiry.phone, '+260977555222');
  assert.equal(created.inquiry.email, 'chanda@example.com');
  assert.equal(created.inquiry.message, 'Can I refill my prescription?');

  // Valid submission with blank optional email
  const withoutEmail = await storeService.createSupportInquiry({
    name: 'Bwalya Phiri',
    phone: '+260 96 612 3456',
    email: '   ',
    message: 'Do you stock Vitamin D3?',
  });
  assert.equal(withoutEmail.inquiry.phone, '+260966123456');
  assert.equal(withoutEmail.inquiry.email, null);

  // Reject invalid phone server-side
  await assert.rejects(
    () =>
      storeService.createSupportInquiry({
        name: 'Bad Phone User',
        phone: '09712',
        email: 'ok@example.com',
        message: 'Testing invalid phone',
      }),
    BadRequestException
  );

  // Reject invalid email server-side
  await assert.rejects(
    () =>
      storeService.createSupportInquiry({
        name: 'Bad Email User',
        phone: '0977123456',
        email: 'bad-email@nodomain',
        message: 'Testing invalid email',
      }),
    BadRequestException
  );

  // Confirm legacy record is untouched and admin listing + status update still work
  const listed = await storeService.listSupportInquiries({ page: 1, limit: 25 });
  assert.equal(listed.data.length, 3);
  const updatedLegacy = await storeService.updateSupportInquiryStatus(legacy.id, 'Contacted');
  assert.equal(updatedLegacy.status, 'Contacted');
  assert.equal(updatedLegacy.phone, '097-LEGACY');
});
