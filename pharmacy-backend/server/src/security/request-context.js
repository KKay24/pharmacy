const crypto = require('node:crypto');
const net = require('node:net');

function sanitizeLogValue(value, maxLength = 255) {
  if (value === null || value === undefined) {
    return '';
  }
  const cleaned = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function normalizeIp(raw) {
  if (typeof raw !== 'string') {
    return null;
  }

  let candidate = raw.trim();
  if (!candidate || /[\u0000-\u001f\u007f\s]/.test(candidate)) {
    return null;
  }

  // Handle bracketed IPv6, optionally with port: [2001:db8::1]:443
  if (candidate.startsWith('[')) {
    const closeIdx = candidate.indexOf(']');
    if (closeIdx === -1) return null;
    candidate = candidate.slice(1, closeIdx);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    // Handle IPv4 with port: 203.0.113.5:54321
    candidate = candidate.slice(0, candidate.lastIndexOf(':'));
  }

  // Strip IPv6 zone index if present (e.g. fe80::1%eth0)
  const zoneIdx = candidate.indexOf('%');
  if (zoneIdx !== -1) {
    candidate = candidate.slice(0, zoneIdx);
  }

  // Unwrap IPv4-mapped IPv6 addresses (::ffff:203.0.113.5)
  if (/^::ffff:/i.test(candidate)) {
    const mapped = candidate.slice(7);
    if (net.isIP(mapped) === 4) {
      return mapped;
    }
  }

  const version = net.isIP(candidate);
  if (version === 4) {
    return candidate;
  }
  if (version === 6) {
    return candidate.toLowerCase();
  }

  return null;
}

function isPublicIp(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;

  const version = net.isIP(normalized);
  if (version === 4) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a >= 224) return false; // multicast/reserved
    if (a === 192 && b === 0 && parts[2] === 2) return false; // TEST-NET-1
    if (a === 198 && b === 51 && parts[2] === 100) return false; // TEST-NET-2
    if (a === 203 && b === 0 && parts[2] === 113) return false; // TEST-NET-3
    return true;
  }

  if (version === 6) {
    if (normalized === '::1' || normalized === '::') return false;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false; // ULA
    if (/^fe[89ab]/i.test(normalized)) return false; // link-local
    if (normalized.startsWith('ff')) return false; // multicast
    if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) return false; // documentation
    return true;
  }

  return false;
}

function resolveTrustProxySetting(env = process.env) {
  if (env.TRUST_PROXY_HOPS !== undefined && env.TRUST_PROXY_HOPS !== '') {
    const parsed = Number.parseInt(env.TRUST_PROXY_HOPS, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5) {
      return parsed;
    }
  }

  if (env.NODE_ENV === 'production' || env.RENDER === 'true') {
    return 1;
  }

  return 0;
}

function safeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function getHeader(req, name) {
  if (!req || !req.headers) return '';
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return typeof value === 'string' ? value : '';
}

function extractClientIp(req, options = {}) {
  if (!req) return 'unknown';

  const sharedSecret = options.proxySharedSecret !== undefined
    ? options.proxySharedSecret
    : (process.env.PROXY_SHARED_SECRET || '');

  if (sharedSecret) {
    const providedSecret = getHeader(req, 'x-mediquick-proxy-secret').trim();
    if (safeEqualStrings(providedSecret, sharedSecret)) {
      const forwardedClientIp = normalizeIp(getHeader(req, 'x-mediquick-client-ip'));
      if (forwardedClientIp) {
        return forwardedClientIp;
      }
    }
  }

  let hops;
  if (typeof options.trustProxyHops === 'number') {
    hops = options.trustProxyHops;
  } else if (req.app && typeof req.app.get === 'function') {
    const expressTrustProxy = req.app.get('trust proxy');
    if (typeof expressTrustProxy === 'number') {
      hops = expressTrustProxy;
    } else if (expressTrustProxy === true) {
      hops = 1;
    } else if (expressTrustProxy === false) {
      hops = 0;
    }
  }

  if (typeof hops !== 'number') {
    hops = resolveTrustProxySetting();
  }

  if (hops > 0) {
    const xff = getHeader(req, 'x-forwarded-for');
    if (xff) {
      const chain = xff
        .split(',')
        .map((entry) => normalizeIp(entry))
        .filter(Boolean);

      if (chain.length > 0) {
        const targetIndex = Math.max(0, chain.length - hops);
        return chain[targetIndex];
      }
    }
  }

  const socketIp = normalizeIp(req.socket?.remoteAddress || req.connection?.remoteAddress || '');
  if (socketIp) {
    return socketIp;
  }

  const expressIp = normalizeIp(req.ip || '');
  return expressIp || 'unknown';
}

function parseUserAgent(rawUserAgent) {
  const userAgent = sanitizeLogValue(rawUserAgent, 512) || null;
  if (!userAgent) {
    return {
      userAgent: null,
      browser: 'Unknown',
      operatingSystem: 'Unknown',
      deviceType: 'unknown',
    };
  }

  const ua = userAgent;

  // Browser detection
  let browser = 'Unknown';
  if (/EdgA?\/|Edge\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//i.test(ua)) browser = 'Samsung Internet';
  else if (/CriOS\/|Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) browser = 'Chrome';
  else if (/Chromium\//i.test(ua)) browser = 'Chromium';
  else if (/FxiOS\/|Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\/|CriOS\/|Android/i.test(ua)) browser = 'Safari';
  else if (/curl\/|Wget\/|python-requests|axios\/|node-fetch|PostmanRuntime|Go-http-client|okhttp|Expo/i.test(ua)) {
    browser = 'API Client';
  }

  // Operating System detection
  let operatingSystem = 'Unknown';
  if (/iPhone|iPad|iPod/i.test(ua)) operatingSystem = 'iOS';
  else if (/Android/i.test(ua)) operatingSystem = 'Android';
  else if (/Windows NT|Windows Phone|Win64|WOW64/i.test(ua)) operatingSystem = 'Windows';
  else if (/CrOS/i.test(ua)) operatingSystem = 'ChromeOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) operatingSystem = 'macOS';
  else if (/Linux|X11/i.test(ua)) operatingSystem = 'Linux';

  // Device type detection
  let deviceType = 'unknown';
  if (/bot|crawler|spider|headless|curl\/|Wget\/|python-requests|Go-http-client/i.test(ua)) {
    deviceType = 'bot';
  } else if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'tablet';
  } else if (/Mobi|iPhone|iPod|Windows Phone|BlackBerry|IEMobile/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua))) {
    deviceType = 'mobile';
  } else if (['Windows', 'macOS', 'Linux', 'ChromeOS'].includes(operatingSystem)) {
    deviceType = 'desktop';
  }

  return {
    userAgent,
    browser,
    operatingSystem,
    deviceType,
  };
}

function extractRequestContext(req, options = {}) {
  const ipAddress = extractClientIp(req, options);
  const rawUa = getHeader(req, 'user-agent');
  const parsedUa = parseUserAgent(rawUa);

  return {
    ipAddress,
    ...parsedUa,
  };
}

module.exports = {
  extractClientIp,
  extractRequestContext,
  isPublicIp,
  normalizeIp,
  parseUserAgent,
  resolveTrustProxySetting,
  sanitizeLogValue,
};
