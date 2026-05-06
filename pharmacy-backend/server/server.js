const cors = require('cors');
const express = require('express');
const path = require('path');
const { sequelize } = require('./models');
const authenticateToken = require('./middleware/auth');
const requireRole = require('./middleware/roleMiddleware');
const { enableDemoSeeding, port } = require('./lib/config');
const { runMigrations } = require('./lib/migrations');
const { seedDemoData } = require('./lib/seed');
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const customerRoutes = require('./routes/customers');
const prescriptionRoutes = require('./routes/prescriptions');
const { getProfitLossAnalytics, router: analyticsRoutes } = require('./routes/analytics');
const expenseRoutes = require('./routes/expenses');
const supplierRoutes = require('./routes/suppliers');

const app = express();
let startupPromise = null;

const localhostOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5002',
  'http://localhost:8081',
  'http://localhost:19006',
];
const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
].filter(Boolean);
const configuredVercelOriginExists = configuredOrigins.some((origin) => {
  try {
    return new URL(origin).hostname.endsWith('.vercel.app');
  } catch (error) {
    return false;
  }
});
const allowVercelPreviews =
  process.env.ALLOW_VERCEL_PREVIEWS === 'true' ||
  (process.env.ALLOW_VERCEL_PREVIEWS !== 'false' && configuredVercelOriginExists);

function isAllowedOrigin(origin) {
  if (!origin || process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (localhostOrigins.includes(origin) || configuredOrigins.includes(origin)) {
    return true;
  }

  if (allowVercelPreviews) {
    try {
      const { hostname, protocol } = new URL(origin);
      return protocol === 'https:' && hostname.endsWith('.vercel.app');
    } catch (error) {
      return false;
    }
  }

  return false;
}

async function initializeApplication() {
  await sequelize.authenticate();
  await runMigrations();

  if (enableDemoSeeding) {
    await seedDemoData();
  }
}

function ensureApplicationReady() {
  if (!startupPromise) {
    startupPromise = initializeApplication();
  }

  return startupPromise;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(async (req, res, next) => {
  try {
    await ensureApplicationReady();
    next();
  } catch (error) {
    next(error);
  }
});

// Debug request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'API is working' });
});

app.get('/api/debug-env', (req, res) => {
  res.json({ 
    nodeEnv: process.env.NODE_ENV, 
    port: process.env.PORT,
    cwd: process.cwd()
  });
});

app.get('/api/debug-db', async (req, res) => {
  try {
    const { User } = require('./models');
    const count = await User.count();
    res.json({ status: 'connected', userCount: count });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/force-seed', async (req, res) => {
  try {
    console.log('[SEED] Manual force-seed triggered...');
    const { seedDemoData } = require('./lib/seed');
    await seedDemoData();
    console.log('[SEED] Manual force-seed completed successfully.');
    res.json({ status: 'success', message: 'Database seeded successfully' });
  } catch (error) {
    console.error('[SEED] Manual force-seed FAILED:', error);
    res.status(500).json({ status: 'error', message: error.message, stack: error.stack });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/inventory', authenticateToken, requireRole(['admin', 'manager', 'user']), inventoryRoutes);
app.use('/api/sales', authenticateToken, requireRole(['admin', 'manager', 'user']), salesRoutes);
app.use('/api/customers', authenticateToken, requireRole(['admin', 'manager']), customerRoutes);
app.use('/api/prescriptions', authenticateToken, requireRole(['admin', 'manager']), prescriptionRoutes);
app.use('/api/analytics', authenticateToken, requireRole(['admin', 'manager']), analyticsRoutes);
app.get(
  '/api/reports/analytics',
  authenticateToken,
  requireRole(['admin', 'manager']),
  getProfitLossAnalytics
);
app.use('/api/expenses', authenticateToken, requireRole(['admin', 'manager']), expenseRoutes);
app.use('/api/suppliers', authenticateToken, requireRole(['admin', 'manager']), supplierRoutes);

// Catch-all for API routes (unmatched)
app.use('/api', (req, res) => {
  console.log(`[404] API Route Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'API route not found',
    method: req.method,
    url: req.originalUrl 
  });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const buildPath = path.join(__dirname, '../../pharmacy-inventory/build');
  app.use(express.static(buildPath));
  
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      return res.sendFile(path.join(buildPath, 'index.html'));
    }
    next();
  });
}

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  await ensureApplicationReady();

  if (process.env.VERCEL) {
    return app;
  }

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('CRITICAL: Failed to start server:', error);
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.ensureApplicationReady = ensureApplicationReady;
module.exports.startServer = startServer;
