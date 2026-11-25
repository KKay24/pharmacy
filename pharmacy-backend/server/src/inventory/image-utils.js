const { createHash } = require('node:crypto');

const ALLOWED_IMAGE_MIME_TYPES = new Map([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
  ['image/gif', 'image/gif'],
]);

const DATA_IMAGE_URI_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

function parseImageDataUri(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const match = trimmed.match(DATA_IMAGE_URI_REGEX);
  if (!match) return null;

  const contentType = ALLOWED_IMAGE_MIME_TYPES.get(match[1].toLowerCase());
  if (!contentType) return null;

  const base64Payload = match[2].replace(/\s+/g, '');
  if (!base64Payload) return null;

  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length) return null;

  return {
    contentType,
    buffer,
    etag: `"med-img-${createHash('sha1').update(buffer).digest('hex').slice(0, 16)}"`,
  };
}

function toCompactProductImageUrl(medicine) {
  if (!medicine || typeof medicine.imageUrl !== 'string') return null;
  const trimmed = medicine.imageUrl.trim();
  if (!trimmed) return null;

  if (parseImageDataUri(trimmed)) {
    const version = medicine.updatedAt ? new Date(medicine.updatedAt).getTime() : null;
    const suffix = Number.isFinite(version) && version > 0 ? `?v=${version}` : '';
    return `/api/products/${medicine.id}/image${suffix}`;
  }

  return trimmed;
}

module.exports = {
  parseImageDataUri,
  toCompactProductImageUrl,
};
