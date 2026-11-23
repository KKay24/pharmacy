const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
  'x-mediquick-proxy-secret',
  'x-mediquick-client-ip',
]);

const RESPONSE_HEADERS_TO_OMIT = new Set([
  ...HOP_BY_HOP_HEADERS,
  'content-encoding',
]);

function shouldForwardResponseHeader(name) {
  return !RESPONSE_HEADERS_TO_OMIT.has(name.toLowerCase());
}

function extractVercelClientIp(req) {
  // Vercel sets x-vercel-forwarded-for / x-real-ip at the edge from the true peer connection.
  const vercelForwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.trim()) {
    const parts = vercelForwarded.split(',').map((item) => item.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const parts = forwarded.split(',').map((item) => item.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || '';
}

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function targetPathFromRequest(req) {
  const incomingUrl = new URL(req.url, 'http://vercel.local');
  const routedPath = req.query?.path ?? incomingUrl.searchParams.get('path');
  incomingUrl.searchParams.delete('path');

  const normalizedPath = Array.isArray(routedPath)
    ? routedPath.join('/')
    : typeof routedPath === 'string'
      ? routedPath.replace(/^\/+/, '')
      : incomingUrl.pathname.replace(/^\/+/, '');
  const isHealthPath = normalizedPath === 'health' || normalizedPath.startsWith('health/');
  const apiPath = isHealthPath
    ? `/${normalizedPath}`
    : normalizedPath === 'api' || normalizedPath === ''
      ? '/api'
      : normalizedPath.startsWith('api/')
        ? `/${normalizedPath}`
        : `/api/${normalizedPath}`;
  const query = incomingUrl.searchParams.toString();
  return `${apiPath}${query ? `?${query}` : ''}`;
}

const proxyHandler = async (req, res) => {
  const backendBaseUrl = process.env.BACKEND_API_URL || process.env.REACT_APP_API_BASE_URL;

  if (!backendBaseUrl) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'BACKEND_API_URL is not configured for the frontend proxy' }));
    return;
  }

  try {
    const normalizedBackendBaseUrl = `${backendBaseUrl.replace(/\/$/, '')}/`;
    const targetUrl = new URL(targetPathFromRequest(req), normalizedBackendBaseUrl);
    const requestHeaders = new Headers();

    Object.entries(req.headers).forEach(([key, value]) => {
      if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        return;
      }

      requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    });

    const proxySharedSecret = process.env.PROXY_SHARED_SECRET;
    if (proxySharedSecret) {
      const clientIp = extractVercelClientIp(req);
      if (clientIp) {
        requestHeaders.set('x-mediquick-proxy-secret', proxySharedSecret);
        requestHeaders.set('x-mediquick-client-ip', clientIp);
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await readRequestBody(req),
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (shouldForwardResponseHeader(key)) {
        res.setHeader(key, value);
      }
    });

    const payload = Buffer.from(await response.arrayBuffer());
    res.end(payload);
  } catch (error) {
    // Do not log backend URLs or request headers; they can contain credentials.
    console.error('Vercel API proxy error:', error?.name || 'UnknownError');
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: "We're temporarily unable to connect. Please try again." }));
  }
};

module.exports = proxyHandler;
// Exported for lightweight route verification; Vercel still receives the handler.
module.exports.targetPathFromRequest = targetPathFromRequest;
module.exports.shouldForwardResponseHeader = shouldForwardResponseHeader;
