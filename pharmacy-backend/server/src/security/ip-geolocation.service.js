const { Injectable } = require('@nestjs/common');
const { isPublicIp, normalizeIp, sanitizeLogValue } = require('./request-context');

const EMPTY_GEO = Object.freeze({
  country: null,
  region: null,
  city: null,
  isp: null,
});

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_ENTRIES = 5000;

class IpGeolocationService {
  constructor(options = {}) {
    this.cache = new Map();
    this.inFlight = new Map();
    this.fetchImpl = options.fetchImpl || null;
    this.env = options.env || process.env;
  }

  isEnabled() {
    if (this.fetchImpl) {
      return this.env.IP_GEO_ENABLED !== 'false';
    }
    if (this.env.IP_GEO_ENABLED === 'false') {
      return false;
    }
    if (this.env.IP_GEO_ENABLED === 'true') {
      return true;
    }
    // Avoid unsolicited external network lookups during local test runs
    if (this.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
      return false;
    }
    return this.env.NODE_ENV === 'production' || this.env.RENDER === 'true';
  }

  getCached(ipAddress) {
    const normalized = normalizeIp(ipAddress);
    if (!normalized) return null;

    const entry = this.cache.get(normalized);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalized);
      return null;
    }

    return entry.value;
  }

  setCached(ipAddress, value, ttlMs) {
    const normalized = normalizeIp(ipAddress);
    if (!normalized) return;

    if (this.cache.size >= MAX_CACHE_ENTRIES && !this.cache.has(normalized)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(normalized, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clearCache() {
    this.cache.clear();
    this.inFlight.clear();
  }

  buildProviderRequest(ip) {
    const provider = String(this.env.IP_GEO_PROVIDER || 'ipwho').trim().toLowerCase();
    const apiKey = String(this.env.IP_GEO_API_KEY || '').trim();
    const customBase = String(this.env.IP_GEO_BASE_URL || '').trim().replace(/\/$/, '');

    if (customBase) {
      const url = `${customBase}/${encodeURIComponent(ip)}`;
      return {
        provider: 'custom',
        url,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      };
    }

    if (provider === 'ipinfo') {
      const tokenQuery = apiKey ? `?token=${encodeURIComponent(apiKey)}` : '';
      return {
        provider: 'ipinfo',
        url: `https://ipinfo.io/${encodeURIComponent(ip)}/json${tokenQuery}`,
        headers: { Accept: 'application/json' },
      };
    }

    // Default: ipwho.is (HTTPS, no key required, returns country/region/city/connection.isp)
    return {
      provider: 'ipwho',
      url: `https://ipwho.is/${encodeURIComponent(ip)}`,
      headers: { Accept: 'application/json' },
    };
  }

  parseProviderPayload(provider, payload) {
    if (!payload || typeof payload !== 'object') {
      return { ...EMPTY_GEO };
    }

    if (provider === 'ipwho' && payload.success === false) {
      return { ...EMPTY_GEO };
    }

    const country = sanitizeLogValue(payload.country || payload.country_name || '', 100) || null;
    const region = sanitizeLogValue(payload.region || payload.regionName || payload.state || '', 100) || null;
    const city = sanitizeLogValue(payload.city || '', 100) || null;
    const isp = sanitizeLogValue(
      payload.connection?.isp ||
        payload.connection?.org ||
        payload.isp ||
        payload.org ||
        '',
      150
    ) || null;

    return { country, region, city, isp };
  }

  async lookup(ipAddress) {
    const normalized = normalizeIp(ipAddress);
    if (!normalized || !isPublicIp(normalized)) {
      return { ...EMPTY_GEO };
    }

    const cached = this.getCached(normalized);
    if (cached) {
      return cached;
    }

    if (!this.isEnabled()) {
      return { ...EMPTY_GEO };
    }

    if (this.inFlight.has(normalized)) {
      return this.inFlight.get(normalized);
    }

    const fetchFn = this.fetchImpl || global.fetch;
    if (typeof fetchFn !== 'function') {
      return { ...EMPTY_GEO };
    }

    const timeoutMs = Math.max(
      250,
      Math.min(5000, Number.parseInt(this.env.IP_GEO_TIMEOUT_MS || '1500', 10) || 1500)
    );
    const cacheTtlMs = Math.max(
      60000,
      Number.parseInt(this.env.IP_GEO_CACHE_TTL_MS || String(DEFAULT_CACHE_TTL_MS), 10) || DEFAULT_CACHE_TTL_MS
    );

    const requestPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const { provider, url, headers } = this.buildProviderRequest(normalized);
        const response = await fetchFn(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (!response || !response.ok) {
          this.setCached(normalized, { ...EMPTY_GEO }, NEGATIVE_CACHE_TTL_MS);
          return { ...EMPTY_GEO };
        }

        const payload = await response.json();
        const parsed = this.parseProviderPayload(provider, payload);
        const hasAnyData = Boolean(parsed.country || parsed.region || parsed.city || parsed.isp);
        this.setCached(normalized, parsed, hasAnyData ? cacheTtlMs : NEGATIVE_CACHE_TTL_MS);
        return parsed;
      } catch (error) {
        // Never interrupt authentication if external geolocation fails or times out
        this.setCached(normalized, { ...EMPTY_GEO }, NEGATIVE_CACHE_TTL_MS);
        return { ...EMPTY_GEO };
      } finally {
        clearTimeout(timer);
        this.inFlight.delete(normalized);
      }
    })();

    this.inFlight.set(normalized, requestPromise);
    return requestPromise;
  }
}

Injectable()(IpGeolocationService);

module.exports = IpGeolocationService;
module.exports.EMPTY_GEO = EMPTY_GEO;
