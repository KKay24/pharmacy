const { randomBytes } = require('node:crypto');
const { Op } = require('sequelize');

const BATCH_STATUSES = Object.freeze(['active', 'depleted', 'archived', 'deleted']);
const INACTIVE_BATCH_STATUSES = Object.freeze(['archived', 'deleted']);

const recentBatchNumbers = new Map();
const RECENT_TTL_MS = 10000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatBatchTimestamp(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const sec = pad2(d.getSeconds());
  return `${y}${m}${day}-${h}${min}${sec}`;
}

function formatUserToken(actor) {
  const numericId = Number(actor?.id);
  if (Number.isInteger(numericId) && numericId > 0) {
    return `USER${String(numericId).padStart(2, '0')}`;
  }
  const rawUsername = typeof actor?.username === 'string'
    ? actor.username.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    : '';
  return rawUsername ? `USER${rawUsername}` : 'SYSTEM';
}

function buildStructuredBatchNumber({ medicineId, actor = null, now = new Date(), suffix = '' }) {
  const productToken = String(medicineId || '0').replace(/[^A-Za-z0-9]/g, '');
  const timestamp = formatBatchTimestamp(now);
  const userToken = formatUserToken(actor);
  const base = `MQ-${productToken}-${timestamp}-${userToken}`;
  return suffix ? `${base}-${suffix}` : base;
}

function pruneRecentTracker(nowMs) {
  if (recentBatchNumbers.size < 256) return;
  for (const [key, expiresAt] of recentBatchNumbers.entries()) {
    if (expiresAt <= nowMs) recentBatchNumbers.delete(key);
  }
}

function reserveUniqueBatchNumberCandidate({ medicineId, actor = null, now = new Date(), attempt = 0 }) {
  const nowMs = Date.now();
  pruneRecentTracker(nowMs);

  let suffix = '';
  if (attempt > 0) {
    suffix = `${String(attempt + 1).padStart(2, '0')}${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  let candidate = buildStructuredBatchNumber({ medicineId, actor, now, suffix });
  let seq = attempt;
  while (recentBatchNumbers.has(candidate)) {
    seq += 1;
    const extraSuffix = `${String(seq + 1).padStart(2, '0')}${randomBytes(2).toString('hex').toUpperCase()}`;
    candidate = buildStructuredBatchNumber({ medicineId, actor, now, suffix: extraSuffix });
  }
  recentBatchNumbers.set(candidate, nowMs + RECENT_TTL_MS);
  return candidate;
}

function isBatchInactive(batch) {
  const status = String(batch?.status || '').toLowerCase();
  return status === 'deleted' || status === 'archived';
}

function isBatchAvailableForSale(batch) {
  return !isBatchInactive(batch) && Number(batch?.quantity || 0) > 0;
}

function resolveBatchStatus(quantity, currentStatus = 'active') {
  const normalized = String(currentStatus || 'active').toLowerCase();
  if (normalized === 'deleted' || normalized === 'archived') {
    return normalized;
  }
  return Number(quantity || 0) > 0 ? 'active' : 'depleted';
}

function activeBatchWhere(extra = {}) {
  return {
    ...extra,
    status: { [Op.notIn]: [...INACTIVE_BATCH_STATUSES] },
  };
}

module.exports = {
  BATCH_STATUSES,
  INACTIVE_BATCH_STATUSES,
  activeBatchWhere,
  buildStructuredBatchNumber,
  formatBatchTimestamp,
  formatUserToken,
  isBatchAvailableForSale,
  isBatchInactive,
  reserveUniqueBatchNumberCandidate,
  resolveBatchStatus,
};
