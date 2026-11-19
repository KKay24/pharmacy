const { Inject, Injectable, BadRequestException } = require('@nestjs/common');
const { Op, col, fn, where } = require('sequelize');
const { AuthAuditLog } = require('../../models');
const { parsePagination, paginatedResponse } = require('../common/pagination');
const {
  extractRequestContext,
  normalizeIp,
  sanitizeLogValue,
} = require('./request-context');
const IpGeolocationService = require('./ip-geolocation.service');

const SUSPICIOUS_FLAG_LABELS = Object.freeze({
  repeated_ip_failures: 'Multiple failed attempts from this IP',
  account_failures: 'Multiple failed attempts on this account',
  credential_stuffing_multi_account: 'Multiple accounts targeted from one IP',
  short_burst_attempts: 'Rapid repeated login attempts',
  success_after_failures: 'Successful login after recent failures',
  unusual_ip_for_user: 'Unusual IP address for this account',
  rate_limited: 'Temporarily rate-limited',
});

const RETENTION_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const RATE_LIMITED_AUDIT_CAP_PER_MIN = 5;

function parsePositiveInt(raw, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

function parseDateFilter(raw, endOfDay = false) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Date-only YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const parsed = new Date(`${trimmed}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

class AuthSecurityService {
  constructor(ipGeolocationService, options = {}) {
    this.ipGeolocationService = ipGeolocationService || new IpGeolocationService();
    this.env = options.env || process.env;
    // Sliding-window trackers for fast, low-latency brute-force & burst detection
    this.ipAttempts = new Map();
    this.accountAttempts = new Map();
    this.pairFailures = new Map();
    this.lockouts = new Map();
    this.rateLimitedAuditCounts = new Map();
    this.lastRetentionSweepAt = 0;
    this.pendingGeoUpdates = new Set();
  }

  getConfig() {
    return {
      windowMs: parsePositiveInt(this.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 1000),
      lockoutDurationMs: parsePositiveInt(this.env.AUTH_LOCKOUT_DURATION_MS, 15 * 60 * 1000, 1000),
      ipMaxFailures: parsePositiveInt(this.env.AUTH_RATE_LIMIT_IP_MAX_FAILURES, 10, 2),
      pairMaxFailures: parsePositiveInt(this.env.AUTH_RATE_LIMIT_ACCOUNT_MAX_FAILURES, 5, 2),
      accountMaxFailures: parsePositiveInt(this.env.AUTH_RATE_LIMIT_ACCOUNT_GLOBAL_MAX_FAILURES, 8, 2),
      shortBurstWindowMs: parsePositiveInt(this.env.AUTH_SHORT_BURST_WINDOW_MS, 60 * 1000, 1000),
      shortBurstMax: parsePositiveInt(this.env.AUTH_SHORT_BURST_MAX, 3, 2),
      multiAccountIpThreshold: parsePositiveInt(this.env.AUTH_MULTI_ACCOUNT_IP_THRESHOLD, 3, 2),
      retentionDays: parsePositiveInt(this.env.AUTH_AUDIT_RETENTION_DAYS, 90, 7, 3650),
    };
  }

  resetRuntimeState() {
    this.ipAttempts.clear();
    this.accountAttempts.clear();
    this.pairFailures.clear();
    this.lockouts.clear();
    this.rateLimitedAuditCounts.clear();
  }

  pruneEvents(list, cutoffMs) {
    if (!Array.isArray(list)) return [];
    return list.filter((entry) => entry.ts >= cutoffMs);
  }

  getActiveLockout(key, now) {
    const until = this.lockouts.get(key);
    if (!until) return 0;
    if (until <= now) {
      this.lockouts.delete(key);
      return 0;
    }
    return Math.ceil((until - now) / 1000);
  }

  checkLoginAllowance({ ipAddress, attemptedEmail, now = Date.now() }) {
    const normalizedEmail = sanitizeLogValue(attemptedEmail, 255).toLowerCase();
    const safeIp = normalizeIp(ipAddress) || 'unknown';

    const ipRetry = safeIp !== 'unknown' ? this.getActiveLockout(`ip:${safeIp}`, now) : 0;
    if (ipRetry > 0) {
      return { allowed: false, retryAfterSeconds: ipRetry, scope: 'ip' };
    }

    if (normalizedEmail && safeIp !== 'unknown') {
      const pairRetry = this.getActiveLockout(`pair:${safeIp}:${normalizedEmail}`, now);
      if (pairRetry > 0) {
        return { allowed: false, retryAfterSeconds: pairRetry, scope: 'account_ip' };
      }
    }

    if (normalizedEmail) {
      const accountRetry = this.getActiveLockout(`account:${normalizedEmail}`, now);
      if (accountRetry > 0) {
        return { allowed: false, retryAfterSeconds: accountRetry, scope: 'account' };
      }
    }

    return { allowed: true, retryAfterSeconds: 0, scope: null };
  }

  isIpCurrentlyRateLimited(ipAddress, now = Date.now()) {
    const safeIp = normalizeIp(ipAddress);
    if (!safeIp) return false;
    return this.getActiveLockout(`ip:${safeIp}`, now) > 0;
  }

  trackAttemptInMemory({ ipAddress, attemptedEmail, status, now = Date.now() }) {
    const cfg = this.getConfig();
    const cutoff = now - cfg.windowMs;
    const normalizedEmail = sanitizeLogValue(attemptedEmail, 255).toLowerCase();
    const safeIp = normalizeIp(ipAddress) || 'unknown';
    const isFailed = status === 'FAILED';

    // Track per-IP attempts
    if (safeIp !== 'unknown') {
      const ipHistory = this.pruneEvents(this.ipAttempts.get(safeIp), cutoff);
      ipHistory.push({ ts: now, status, email: normalizedEmail });
      this.ipAttempts.set(safeIp, ipHistory);
    }

    // Track per-account attempts
    if (normalizedEmail) {
      const accHistory = this.pruneEvents(this.accountAttempts.get(normalizedEmail), cutoff);
      accHistory.push({ ts: now, status, ip: safeIp });
      this.accountAttempts.set(normalizedEmail, accHistory);
    }

    // Track per-(IP, account) failures; reset on successful login so legitimate users are not unfairly penalized
    if (safeIp !== 'unknown' && normalizedEmail) {
      const pairKey = `pair:${safeIp}:${normalizedEmail}`;
      if (status === 'SUCCESS') {
        this.pairFailures.delete(pairKey);
        this.lockouts.delete(pairKey);
        this.lockouts.delete(`account:${normalizedEmail}`);
      } else if (isFailed) {
        const pairHistory = this.pruneEvents(this.pairFailures.get(pairKey), cutoff);
        pairHistory.push({ ts: now });
        this.pairFailures.set(pairKey, pairHistory);

        if (pairHistory.length >= cfg.pairMaxFailures) {
          this.lockouts.set(pairKey, now + cfg.lockoutDurationMs);
        }
      }
    }

    if (isFailed && safeIp !== 'unknown') {
      const ipFailures = (this.ipAttempts.get(safeIp) || []).filter((item) => item.status === 'FAILED');
      if (ipFailures.length >= cfg.ipMaxFailures) {
        this.lockouts.set(`ip:${safeIp}`, now + cfg.lockoutDurationMs);
      }
    }

    if (isFailed && normalizedEmail) {
      const accFailures = (this.accountAttempts.get(normalizedEmail) || []).filter((item) => item.status === 'FAILED');
      if (accFailures.length >= cfg.accountMaxFailures) {
        this.lockouts.set(`account:${normalizedEmail}`, now + cfg.lockoutDurationMs);
      }
    }
  }

  async detectSuspiciousIndicators({ ipAddress, attemptedEmail, userId, status, failureReason, now = Date.now() }) {
    const cfg = this.getConfig();
    const flags = new Set();
    const normalizedEmail = sanitizeLogValue(attemptedEmail, 255).toLowerCase();
    const safeIp = normalizeIp(ipAddress) || 'unknown';
    const windowCutoff = now - cfg.windowMs;
    const burstCutoff = now - cfg.shortBurstWindowMs;

    if (failureReason === 'rate_limited') {
      flags.add('rate_limited');
    }

    const ipEvents = safeIp !== 'unknown'
      ? this.pruneEvents(this.ipAttempts.get(safeIp), windowCutoff)
      : [];
    const accEvents = normalizedEmail
      ? this.pruneEvents(this.accountAttempts.get(normalizedEmail), windowCutoff)
      : [];

    // 1. Multiple failed login attempts from the same IP
    const ipFailureCount = ipEvents.filter((e) => e.status === 'FAILED').length;
    if (ipFailureCount >= 3) {
      flags.add('repeated_ip_failures');
    }

    // 2. Multiple failed attempts against the same account
    const accFailureCount = accEvents.filter((e) => e.status === 'FAILED').length;
    if (accFailureCount >= 3) {
      flags.add('account_failures');
    }

    // 3. Attempts against multiple distinct accounts from one IP
    const distinctAccounts = new Set(ipEvents.map((e) => e.email).filter(Boolean));
    if (distinctAccounts.size >= cfg.multiAccountIpThreshold) {
      flags.add('credential_stuffing_multi_account');
    }

    // 4. Repeated login attempts within a short burst window (e.g., 3+ in 60s)
    const ipBurstCount = ipEvents.filter((e) => e.ts >= burstCutoff).length;
    const accBurstCount = accEvents.filter((e) => e.ts >= burstCutoff).length;
    if (ipBurstCount >= cfg.shortBurstMax || accBurstCount >= cfg.shortBurstMax) {
      flags.add('short_burst_attempts');
    }

    // 5. Successful login following several failed attempts
    if (status === 'SUCCESS') {
      const priorWindowCutoff = now - 30 * 60 * 1000;
      const recentAccFailures = accEvents.filter((e) => e.status === 'FAILED' && e.ts >= priorWindowCutoff).length;
      const recentIpFailures = ipEvents.filter((e) => e.status === 'FAILED' && e.ts >= priorWindowCutoff).length;
      if (recentAccFailures >= 2 || recentIpFailures >= 3) {
        flags.add('success_after_failures');
      }
    }

    // 6. Login attempts from an unusual IP address for a known user
    if (userId && safeIp !== 'unknown') {
      try {
        const priorSuccessCount = await AuthAuditLog.count({
          where: { userId, status: 'SUCCESS' },
        });
        if (priorSuccessCount > 0) {
          const sameIpSuccessCount = await AuthAuditLog.count({
            where: { userId, status: 'SUCCESS', ipAddress: safeIp },
          });
          if (sameIpSuccessCount === 0) {
            flags.add('unusual_ip_for_user');
          }
        }
      } catch (error) {
        // Non-fatal: do not interrupt authentication if history lookup fails
      }
    }

    return Array.from(flags);
  }

  shouldPersistRateLimitedAudit(ipAddress, now = Date.now()) {
    const safeIp = normalizeIp(ipAddress) || 'unknown';
    const minuteBucket = Math.floor(now / 60000);
    const key = `${safeIp}:${minuteBucket}`;
    const current = this.rateLimitedAuditCounts.get(key) || 0;
    if (current >= RATE_LIMITED_AUDIT_CAP_PER_MIN) {
      return false;
    }
    this.rateLimitedAuditCounts.set(key, current + 1);
    if (this.rateLimitedAuditCounts.size > 2000) {
      this.rateLimitedAuditCounts.clear();
    }
    return true;
  }

  scheduleRetentionCleanup(now = Date.now()) {
    if (now - this.lastRetentionSweepAt < RETENTION_SWEEP_INTERVAL_MS) {
      return;
    }
    this.lastRetentionSweepAt = now;
    const { retentionDays } = this.getConfig();
    const cutoffDate = new Date(now - retentionDays * 24 * 60 * 60 * 1000);

    Promise.resolve()
      .then(() => AuthAuditLog.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
        },
      }))
      .catch(() => {
        // Non-blocking maintenance
      });
  }

  enrichRecordGeoAsync(recordId, ipAddress) {
    if (!recordId || !ipAddress || ipAddress === 'unknown') return null;

    const promise = Promise.resolve()
      .then(async () => {
        const geo = await this.ipGeolocationService.lookup(ipAddress);
        if (!geo || (!geo.country && !geo.region && !geo.city && !geo.isp)) {
          return;
        }
        await AuthAuditLog.update(
          {
            geoCountry: geo.country,
            geoRegion: geo.region,
            geoCity: geo.city,
            geoIsp: geo.isp,
          },
          { where: { id: recordId } }
        );
      })
      .catch(() => {
        // Geolocation enrichment is strictly best-effort and must never fail auth
      })
      .finally(() => {
        this.pendingGeoUpdates.delete(promise);
      });

    this.pendingGeoUpdates.add(promise);
    return promise;
  }

  async waitForPendingGeoUpdates() {
    if (this.pendingGeoUpdates.size === 0) return;
    await Promise.allSettled(Array.from(this.pendingGeoUpdates));
  }

  async recordLoginAttempt({
    request = null,
    userId = null,
    attemptedEmail = '',
    status = 'FAILED',
    failureReason = null,
    now = Date.now(),
  }) {
    const context = extractRequestContext(request);
    const safeEmail = sanitizeLogValue(attemptedEmail, 255) || 'unknown';
    const safeStatus = status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    const safeReason = failureReason ? sanitizeLogValue(failureReason, 64) : null;

    this.trackAttemptInMemory({
      ipAddress: context.ipAddress,
      attemptedEmail: safeEmail,
      status: safeStatus,
      now,
    });

    const suspiciousFlags = await this.detectSuspiciousIndicators({
      ipAddress: context.ipAddress,
      attemptedEmail: safeEmail,
      userId,
      status: safeStatus,
      failureReason: safeReason,
      now,
    });
    const suspicious = suspiciousFlags.length > 0;

    // Structured, injection-safe log (never logs passwords, hashes, or tokens)
    const logPayload = {
      event: 'login_attempt',
      status: safeStatus,
      failureReason: safeReason,
      attemptedEmail: safeEmail,
      userId: userId || null,
      ipAddress: context.ipAddress,
      deviceType: context.deviceType,
      operatingSystem: context.operatingSystem,
      browser: context.browser,
      suspicious,
      suspiciousFlags,
      timestamp: new Date(now).toISOString(),
    };
    console.log(`[AUTH] ${JSON.stringify(logPayload)}`);

    if (safeReason === 'rate_limited' && !this.shouldPersistRateLimitedAudit(context.ipAddress, now)) {
      return { record: null, suspicious, suspiciousFlags, context };
    }

    const cachedGeo = this.ipGeolocationService.getCached(context.ipAddress);

    let record = null;
    try {
      record = await AuthAuditLog.create({
        userId: userId || null,
        attemptedEmail: safeEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceType: context.deviceType,
        operatingSystem: context.operatingSystem,
        browser: context.browser,
        status: safeStatus,
        failureReason: safeReason,
        geoCountry: cachedGeo?.country || null,
        geoRegion: cachedGeo?.region || null,
        geoCity: cachedGeo?.city || null,
        geoIsp: cachedGeo?.isp || null,
        suspicious,
        suspiciousFlags,
      });

      if (!cachedGeo && record?.id) {
        this.enrichRecordGeoAsync(record.id, context.ipAddress);
      }

      this.scheduleRetentionCleanup(now);
    } catch (error) {
      console.error('[AUTH] Failed to persist authentication audit log:', sanitizeLogValue(error?.message || 'Unknown error', 200));
    }

    return { record, suspicious, suspiciousFlags, context };
  }

  serializeAuditRecord(row) {
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    const flags = Array.isArray(plain.suspiciousFlags) ? plain.suspiciousFlags : [];
    return {
      id: plain.id,
      userId: plain.userId || null,
      attemptedEmail: plain.attemptedEmail,
      ipAddress: plain.ipAddress,
      userAgent: plain.userAgent || null,
      deviceType: plain.deviceType || 'unknown',
      operatingSystem: plain.operatingSystem || 'Unknown',
      browser: plain.browser || 'Unknown',
      status: plain.status,
      failureReason: plain.failureReason || null,
      location: {
        country: plain.geoCountry || null,
        region: plain.geoRegion || null,
        city: plain.geoCity || null,
        isp: plain.geoIsp || null,
      },
      suspicious: Boolean(plain.suspicious),
      suspiciousFlags: flags,
      suspiciousFlagLabels: flags.map((code) => SUSPICIOUS_FLAG_LABELS[code] || code),
      createdAt: plain.createdAt instanceof Date
        ? plain.createdAt.toISOString()
        : plain.createdAt,
    };
  }

  buildWhereClause(query = {}) {
    const clauses = [];

    if (query.status) {
      const normalizedStatus = String(query.status).trim().toUpperCase();
      if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'FAILED') {
        clauses.push({ status: normalizedStatus });
      }
    }

    if (query.suspicious === 'true' || query.suspicious === true) {
      clauses.push({ suspicious: true });
    } else if (query.suspicious === 'false' || query.suspicious === false) {
      clauses.push({ suspicious: false });
    }

    if (query.email && String(query.email).trim()) {
      const term = sanitizeLogValue(query.email, 255).toLowerCase();
      clauses.push(where(fn('lower', col('attemptedEmail')), { [Op.like]: `%${term}%` }));
    }

    if (query.ipAddress && String(query.ipAddress).trim()) {
      const ipTerm = sanitizeLogValue(query.ipAddress, 64).toLowerCase();
      clauses.push(where(fn('lower', col('ipAddress')), { [Op.like]: `%${ipTerm}%` }));
    }

    const startDate = parseDateFilter(query.startDate, false);
    const endDate = parseDateFilter(query.endDate, true);
    if (startDate || endDate) {
      const createdAtFilter = {};
      if (startDate) createdAtFilter[Op.gte] = startDate;
      if (endDate) createdAtFilter[Op.lte] = endDate;
      clauses.push({ createdAt: createdAtFilter });
    }

    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return { [Op.and]: clauses };
  }

  async listLoginActivity(query = {}) {
    const pagination = parsePagination(query);
    const whereClause = this.buildWhereClause(query);

    const { rows, count } = await AuthAuditLog.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    // Aggregate summary across matching records (capped scan-safe counts)
    const [successfulAttempts, failedAttempts, suspiciousAttempts, distinctIpRows] = await Promise.all([
      AuthAuditLog.count({
        where: Object.keys(whereClause).length ? { [Op.and]: [whereClause, { status: 'SUCCESS' }] } : { status: 'SUCCESS' },
      }),
      AuthAuditLog.count({
        where: Object.keys(whereClause).length ? { [Op.and]: [whereClause, { status: 'FAILED' }] } : { status: 'FAILED' },
      }),
      AuthAuditLog.count({
        where: Object.keys(whereClause).length ? { [Op.and]: [whereClause, { suspicious: true }] } : { suspicious: true },
      }),
      AuthAuditLog.findAll({
        where: whereClause,
        attributes: [[fn('DISTINCT', col('ipAddress')), 'ipAddress']],
        raw: true,
      }),
    ]);

    const recentSuspicious = await AuthAuditLog.findAll({
      where: Object.keys(whereClause).length ? { [Op.and]: [whereClause, { suspicious: true }] } : { suspicious: true },
      attributes: ['ipAddress', 'status', 'geoCountry', 'geoCity', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 200,
      raw: true,
    });

    const suspiciousByIp = new Map();
    for (const item of recentSuspicious) {
      const existing = suspiciousByIp.get(item.ipAddress) || {
        ipAddress: item.ipAddress,
        suspiciousEvents: 0,
        failedEvents: 0,
        country: item.geoCountry || null,
        city: item.geoCity || null,
        lastSeen: item.createdAt,
      };
      existing.suspiciousEvents += 1;
      if (item.status === 'FAILED') existing.failedEvents += 1;
      if (!existing.country && item.geoCountry) existing.country = item.geoCountry;
      if (!existing.city && item.geoCity) existing.city = item.geoCity;
      suspiciousByIp.set(item.ipAddress, existing);
    }

    const topSuspiciousIps = Array.from(suspiciousByIp.values())
      .sort((a, b) => b.suspiciousEvents - a.suspiciousEvents)
      .slice(0, 5);

    const response = paginatedResponse(
      rows.map((row) => this.serializeAuditRecord(row)),
      count,
      pagination
    );

    return {
      ...response,
      summary: {
        totalAttempts: count,
        successfulAttempts,
        failedAttempts,
        suspiciousAttempts,
        uniqueIps: distinctIpRows.length,
        topSuspiciousIps,
      },
      geolocationDisclaimer:
        'IP geolocation provides an approximate network location only and does not identify an exact physical address or individual.',
    };
  }

  async investigateIp(rawIpAddress, query = {}) {
    const normalized = normalizeIp(String(rawIpAddress || ''));
    if (!normalized) {
      throw new BadRequestException('A valid IPv4 or IPv6 address is required');
    }

    const pagination = parsePagination(query);

    const [{ rows, count }, allForStats] = await Promise.all([
      AuthAuditLog.findAndCountAll({
        where: { ipAddress: normalized },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: pagination.limit,
        offset: pagination.offset,
      }),
      AuthAuditLog.findAll({
        where: { ipAddress: normalized },
        attributes: ['attemptedEmail', 'status', 'suspicious', 'geoCountry', 'geoRegion', 'geoCity', 'geoIsp', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 500,
        raw: true,
      }),
    ]);

    const accountMap = new Map();
    let successfulAttempts = 0;
    let failedAttempts = 0;
    let suspiciousAttempts = 0;
    let geoFromRecords = null;

    for (const entry of allForStats) {
      if (entry.status === 'SUCCESS') successfulAttempts += 1;
      else failedAttempts += 1;
      if (entry.suspicious) suspiciousAttempts += 1;

      if (!geoFromRecords && (entry.geoCountry || entry.geoRegion || entry.geoCity || entry.geoIsp)) {
        geoFromRecords = {
          country: entry.geoCountry || null,
          region: entry.geoRegion || null,
          city: entry.geoCity || null,
          isp: entry.geoIsp || null,
        };
      }

      const key = String(entry.attemptedEmail || '').toLowerCase();
      if (key) {
        const acc = accountMap.get(key) || {
          attemptedEmail: entry.attemptedEmail,
          attempts: 0,
          failed: 0,
          succeeded: 0,
        };
        acc.attempts += 1;
        if (entry.status === 'SUCCESS') acc.succeeded += 1;
        else acc.failed += 1;
        accountMap.set(key, acc);
      }
    }

    const liveGeo = geoFromRecords || (await this.ipGeolocationService.lookup(normalized));
    const targetedAccounts = Array.from(accountMap.values()).sort((a, b) => b.attempts - a.attempts);
    const firstSeen = allForStats.length > 0 ? allForStats[allForStats.length - 1].createdAt : null;
    const lastSeen = allForStats.length > 0 ? allForStats[0].createdAt : null;

    return {
      ipAddress: normalized,
      approximateLocation: {
        country: liveGeo?.country || null,
        region: liveGeo?.region || null,
        city: liveGeo?.city || null,
        isp: liveGeo?.isp || null,
        disclaimer:
          'Approximate network geolocation only. IP addresses cannot reliably identify an exact physical location or a specific person.',
      },
      stats: {
        totalAttempts: count,
        successfulAttempts,
        failedAttempts,
        suspiciousAttempts,
        distinctAccountsTargeted: targetedAccounts.length,
        currentlyRateLimited: this.isIpCurrentlyRateLimited(normalized),
        firstSeen: firstSeen instanceof Date ? firstSeen.toISOString() : firstSeen,
        lastSeen: lastSeen instanceof Date ? lastSeen.toISOString() : lastSeen,
      },
      targetedAccounts,
      attempts: paginatedResponse(
        rows.map((row) => this.serializeAuditRecord(row)),
        count,
        pagination
      ),
    };
  }
}

Injectable()(AuthSecurityService);
Inject(IpGeolocationService)(AuthSecurityService, undefined, 0);

module.exports = AuthSecurityService;
module.exports.SUSPICIOUS_FLAG_LABELS = SUSPICIOUS_FLAG_LABELS;
