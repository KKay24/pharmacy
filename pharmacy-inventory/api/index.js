const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
]);

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

module.exports = async (req, res) => {
  const backendBaseUrl = process.env.BACKEND_API_URL || process.env.REACT_APP_API_BASE_URL;

  if (!backendBaseUrl) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'BACKEND_API_URL is not configured for the frontend proxy' }));
    return;
  }

  try {
    const normalizedBackendBaseUrl = `${backendBaseUrl.replace(/\/$/, '')}/`;
    const targetUrl = new URL(req.url, normalizedBackendBaseUrl);
    const requestHeaders = new Headers();

    Object.entries(req.headers).forEach(([key, value]) => {
      if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        return;
      }

      requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    });

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await readRequestBody(req),
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const payload = Buffer.from(await response.arrayBuffer());
    res.end(payload);
  } catch (error) {
    console.error('Vercel API proxy error:', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unable to reach the backend API' }));
  }
};
