const { parsePhoneNumberFromString, isSupportedCountry } = require('libphonenumber-js/max');
const validator = require('validator');

const DEFAULT_COUNTRY = 'ZM';

function resolveDefaultCountry(countryCode) {
  if (typeof countryCode === 'string') {
    const normalized = countryCode.trim().toUpperCase();
    if (isSupportedCountry(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_COUNTRY;
}

function validateAndNormalizePhone(rawPhone, countryCode = DEFAULT_COUNTRY) {
  const input = typeof rawPhone === 'string' ? rawPhone.trim() : '';
  if (!input) {
    return {
      valid: false,
      normalized: null,
      country: null,
      error: 'Please enter a phone number.',
    };
  }

  // Reject alphabetic characters or invalid control characters early
  if (/[a-zA-Z]/.test(input) || /[\u0000-\u001f\u007f]/.test(input)) {
    return {
      valid: false,
      normalized: null,
      country: null,
      error: 'Please enter a valid Zambian (e.g. 0977 123 456 or +260 977 123 456) or international phone number.',
    };
  }

  const defaultCountry = resolveDefaultCountry(countryCode);
  const parsed = parsePhoneNumberFromString(input, defaultCountry);

  if (!parsed || !parsed.isValid()) {
    return {
      valid: false,
      normalized: null,
      country: null,
      error: 'Please enter a valid Zambian (e.g. 0977 123 456 or +260 977 123 456) or international phone number.',
    };
  }

  return {
    valid: true,
    normalized: parsed.number, // E.164 format, e.g. +260977123456
    country: parsed.country || defaultCountry,
    error: null,
  };
}

function validateAndNormalizeOptionalEmail(rawEmail) {
  if (rawEmail === null || rawEmail === undefined) {
    return { valid: true, normalized: null, error: null };
  }

  if (typeof rawEmail !== 'string') {
    return {
      valid: false,
      normalized: null,
      error: 'Please enter a valid email address.',
    };
  }

  const trimmed = rawEmail.trim();
  if (!trimmed) {
    return { valid: true, normalized: null, error: null };
  }

  if (
    trimmed.length > 254 ||
    !validator.isEmail(trimmed, {
      allow_utf8_local_part: false,
      require_tld: true,
    })
  ) {
    return {
      valid: false,
      normalized: null,
      error: 'Please enter a valid email address (e.g. name@example.com).',
    };
  }

  return {
    valid: true,
    normalized: trimmed,
    error: null,
  };
}

module.exports = {
  DEFAULT_COUNTRY,
  validateAndNormalizePhone,
  validateAndNormalizeOptionalEmail,
};
