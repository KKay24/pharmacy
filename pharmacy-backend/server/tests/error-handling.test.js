const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException, InternalServerErrorException } = require('@nestjs/common');
const {
  DuplicateResourceException,
  InsufficientStockException,
  OrderStateException,
} = require('../src/common/errors');
const { safePersistenceException, safePublicMessage } = require('../src/common/error-handling');

test('business-rule exceptions expose stable conflict codes and safe messages', () => {
  const cases = [
    [new DuplicateResourceException('Medicine already exists'), 'DUPLICATE_RESOURCE', 'Medicine already exists'],
    [new InsufficientStockException('Not enough stock for Paracetamol'), 'INSUFFICIENT_STOCK', 'Not enough stock for Paracetamol'],
    [new OrderStateException('Confirm the order first'), 'INVALID_ORDER_STATE', 'Confirm the order first'],
  ];

  for (const [error, code, message] of cases) {
    assert.equal(error.getStatus(), 409);
    assert.deepEqual(error.getResponse(), { statusCode: 409, code, message });
  }
});

test('persistence errors expose only safe, actionable API responses', () => {
  const duplicate = safePersistenceException(
    { name: 'SequelizeUniqueConstraintError', message: 'SQLITE_CONSTRAINT: secret detail' },
    'Unable to save supplier'
  );
  assert.equal(duplicate.getStatus(), 409);
  assert.deepEqual(duplicate.getResponse(), {
    statusCode: 409,
    code: 'DUPLICATE_RESOURCE',
    message: 'A record with these details already exists',
  });

  const validation = safePersistenceException(
    { name: 'SequelizeValidationError', message: 'internal validation detail' },
    'Unable to save supplier',
    'Supplier data is invalid'
  );
  assert.equal(validation.getStatus(), 400);
  assert.equal(safePublicMessage(validation, 'fallback'), 'Supplier data is invalid');

  const unexpected = safePersistenceException(new Error('database password=hidden'), 'Unable to save supplier');
  assert.ok(unexpected instanceof InternalServerErrorException);
  assert.equal(safePublicMessage(unexpected, 'fallback'), 'Unable to save supplier');
});

test('existing HTTP exceptions are preserved', () => {
  const input = new BadRequestException('Required field is missing');
  assert.equal(safePersistenceException(input, 'fallback'), input);
});
