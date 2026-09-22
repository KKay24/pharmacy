const path = require('path');
const express = require('express');
const { Module } = require('@nestjs/common');
const { sequelize } = require('../models');
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/roleMiddleware');
const { enableDemoSeeding, isProduction } = require('../lib/config');
const { runMigrations } = require('../lib/migrations');
const AuthController = require('./auth/auth.controller');
const AuthService = require('./auth/auth.service');
const AuthGuard = require('./auth/auth.guard');
const { RolesGuard } = require('./auth/roles.guard');
const InventoryController = require('./inventory/inventory.controller');
const InventoryService = require('./inventory/inventory.service');
const SalesController = require('./sales/sales.controller');
const SalesService = require('./sales/sales.service');
const CustomersController = require('./customers/customers.controller');
const CustomersService = require('./customers/customers.service');
const ExpensesController = require('./expenses/expenses.controller');
const ExpensesService = require('./expenses/expenses.service');
const PrescriptionsController = require('./prescriptions/prescriptions.controller');
const PrescriptionsService = require('./prescriptions/prescriptions.service');
const SuppliersController = require('./suppliers/suppliers.controller');
const SuppliersService = require('./suppliers/suppliers.service');
const AnalyticsController = require('./analytics/analytics.controller');
const ReportsController = require('./analytics/reports.controller');
const AnalyticsService = require('./analytics/analytics.service');

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

let readyPromise;

function ensureApplicationReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await sequelize.authenticate();
      await runMigrations();

      if (enableDemoSeeding && !isProduction) {
        const { seedDemoData } = require('../lib/seed');
        await seedDemoData();
      }
    })();
  }

  return readyPromise;
}

function mountLegacyApi(expressApp, { deferFallback = false } = {}) {
  expressApp.use(express.json({ limit: '50mb' }));

  expressApp.use(async (req, res, next) => {
    try {
      await ensureApplicationReady();
      next();
    } catch (error) {
      next(error);
    }
  });

  expressApp.get('/health', async (req, res, next) => {
    try {
      await ensureApplicationReady();
      res.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  });


  if (deferFallback) {
    return;
  }

  mountApiFallback(expressApp);
}

function mountApiFallback(expressApp) {
  expressApp.use('/api', (req, res) => {
    res.status(404).json({
      error: 'API route not found',
      method: req.method,
      url: req.originalUrl,
    });
  });

  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const buildPath = path.join(__dirname, '../../../pharmacy-inventory/build');
    expressApp.use(express.static(buildPath));
    expressApp.use((req, res, next) => {
      if (req.method === 'GET') {
        return res.sendFile(path.join(buildPath, 'index.html'));
      }
      next();
    });
  }

  expressApp.use((error, req, res, next) => {
    console.error('Unhandled API error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  });
}

class AppModule {
  configure() {}
}

Module({
  controllers: [
    AuthController,
    InventoryController,
    SalesController,
    CustomersController,
    ExpensesController,
    PrescriptionsController,
    SuppliersController,
    AnalyticsController,
    ReportsController,
  ],
  providers: [
    AuthService,
    InventoryService,
    SalesService,
    CustomersService,
    ExpensesService,
    PrescriptionsService,
    SuppliersService,
    AnalyticsService,
    AuthGuard,
    RolesGuard,
  ],
})(AppModule);

module.exports = {
  AppModule,
  ensureApplicationReady,
  isAllowedOrigin,
  mountApiFallback,
  mountLegacyApi,
};