const crypto = require('crypto');

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

function isHashedPassword(value) {
  return typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || typeof storedPassword !== 'string') {
    return false;
  }

  if (!isHashedPassword(storedPassword)) {
    return storedPassword === password;
  }

  const [, salt, expectedKey] = storedPassword.split('$');
  if (!salt || !expectedKey) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  const expectedBuffer = Buffer.from(expectedKey, 'hex');
  const actualBuffer = Buffer.from(derivedKey, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

module.exports = {
  hashPassword,
  isHashedPassword,
  verifyPassword,
};
