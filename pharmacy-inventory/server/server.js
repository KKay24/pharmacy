const express = require('express');
const fs = require('fs');
const path = require('path');

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
]);

const CANONICAL_BACKEND_CANDIDATES = [
  path.resolve(__dirname, '../../pharmacy-backend/server/server.js'),
  path.resolve(__dirname, '../pharmacy-backend/server/server.js'),
];

function tryLoadCanonicalBackend() {
  const errors = [];

  for (const candidate of CANONICAL_BACKEND_CANDIDATES) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    try {
      return {
        backend: require(candidate),
        path: candidate,
      };
    } catch (error) {
      errors.push({ candidate, error });
    }
  }

  return { errors };
}

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function createFallbackServer(loadErrors) {
  const app = express();
  const buildPath = path.resolve(__dirname, '../build');
  const buildIndexPath = path.join(buildPath, 'index.html');
  const backendBaseUrl = (process.env.BACKEND_API_URL || process.env.REACT_APP_API_BASE_URL || '').trim();
  const port = Number(process.env.PORT || 3000);

  app.disable('x-powered-by');

  app.get('/api/test', (req, res) => {
    res.json({
      status: backendBaseUrl ? 'proxy-ready' : 'degraded',
      mode: 'frontend-proxy',
      backendConfigured: Boolean(backendBaseUrl),
      buildPresent: fs.existsSync(buildIndexPath),
    });
  });

  app.use('/api', async (req, res) => {
    if (!backendBaseUrl) {
      res.status(502).json({
        error: 'BACKEND_API_URL is not configured for the frontend proxy',
      });
      return;
    }

    try {
      const normalizedBackendBaseUrl = `${backendBaseUrl.replace(/\/$/, '')}/`;
      const targetUrl = new URL(req.originalUrl, normalizedBackendBaseUrl);
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

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      const payload = Buffer.from(await response.arrayBuffer());
      res.end(payload);
    } catch (error) {
      console.error('Render frontend proxy error:', error);
      res.status(502).json({ error: 'Unable to reach the backend API' });
    }
  });

  if (fs.existsSync(buildIndexPath)) {
    app.use(express.static(buildPath));

    app.get('*', (req, res) => {
      res.sendFile(buildIndexPath);
    });
  } else {
    app.get('*', (req, res) => {
      res.status(503).json({
        error: 'Frontend build not found',
        message: 'Run the frontend build before starting the standalone Render proxy service.',
      });
    });
  }

  async function startServer() {
    if (loadErrors.length > 0) {
      loadErrors.forEach(({ candidate, error }) => {
        console.warn(`Skipping canonical backend at ${candidate}: ${error.message}`);
      });
    }

    if (!backendBaseUrl) {
      console.warn(
        'Canonical backend not bundled. Starting standalone frontend proxy without BACKEND_API_URL.'
      );
    } else {
      console.log(`Starting standalone frontend proxy to ${backendBaseUrl}`);
    }

    return new Promise((resolve) => {
      const server = app.listen(port, () => {
        console.log(`Frontend proxy running on http://localhost:${port}`);
        resolve(server);
      });
    });
  }

  return { app, startServer };
}

const canonicalBackend = tryLoadCanonicalBackend();

if (canonicalBackend.backend && typeof canonicalBackend.backend.startServer === 'function') {
  if (require.main === module) {
    canonicalBackend.backend.startServer().catch((error) => {
      console.error('Failed to start canonical backend from legacy bridge:', error);
      process.exitCode = 1;
    });
  }

  module.exports = canonicalBackend.backend;
  module.exports.backendBridgeMode = 'canonical-backend';
  module.exports.backendBridgePath = canonicalBackend.path;
} else {
  const fallbackServer = createFallbackServer(canonicalBackend.errors || []);

  if (require.main === module) {
    fallbackServer.startServer().catch((error) => {
      console.error('Failed to start standalone frontend proxy:', error);
      process.exitCode = 1;
    });
  }

  module.exports = fallbackServer.app;
  module.exports.startServer = fallbackServer.startServer;
  module.exports.backendBridgeMode = 'frontend-proxy';
}
