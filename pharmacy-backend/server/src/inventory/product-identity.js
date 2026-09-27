const { createHash } = require('node:crypto');

const IDENTITY_FIELDS = ['name', 'genericName', 'strength', 'dosage', 'manufacturer'];

function normalizeIdentityValue(value, { compact = false } = {}) {
  if (value === undefined || value === null) return '';

  const normalized = String(value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();

  return compact ? normalized.replace(/\s+/g, '') : normalized;
}

function productIdentityValues(medicine = {}) {
  return {
    name: normalizeIdentityValue(medicine.name),
    genericName: normalizeIdentityValue(medicine.genericName),
    strength: normalizeIdentityValue(medicine.strength, { compact: true }),
    dosage: normalizeIdentityValue(medicine.dosage),
    manufacturer: normalizeIdentityValue(medicine.manufacturer),
  };
}

function buildProductKey(medicine = {}) {
  const identity = productIdentityValues(medicine);
  if (!identity.name) return null;

  return createHash('sha256')
    .update(IDENTITY_FIELDS.map((field) => identity[field]).join('\u001f'))
    .digest('hex');
}

function hasProductIdentityDetails(medicine = {}) {
  return ['genericName', 'strength', 'dosage', 'manufacturer']
    .some((field) => normalizeIdentityValue(medicine[field]) !== '');
}

function sameProductIdentity(left, right) {
  return buildProductKey(left) === buildProductKey(right);
}

module.exports = {
  IDENTITY_FIELDS,
  buildProductKey,
  hasProductIdentityDetails,
  normalizeIdentityValue,
  productIdentityValues,
  sameProductIdentity,
};
