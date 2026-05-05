const crypto = require('crypto');
const { jwtExpiresInHours, jwtSecret } = require('../config');

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(data) {
  return crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
}

function signAccessToken(user) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required to issue access tokens');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + jwtExpiresInHours * 60 * 60;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    email: user.email || null,
    locations: Array.isArray(user.locations) ? user.locations : [],
    iat: issuedAt,
    exp: expiresAt,
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyAccessToken(token) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required to verify access tokens');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload));

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
