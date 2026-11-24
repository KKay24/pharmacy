const path = require('path');
const express = require('express');
const { Module } = require('@nestjs/common');
const { APP_INTERCEPTOR } = require('@nestjs/core');
const { sequelize } = require('../models');
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/roleMiddleware');
const { enableDemoSeeding, isProduction } = require('../lib/config');
const { runMigrations } = require('../lib/migrations');
const HealthController = require('./health/health.controller');
const AuthController = require('./auth/auth.controller');
const AuthService = require('./auth/auth.service');
const AuthGuard = require('./auth/auth.guard');
const OptionalAuthGuard = require('./auth/optional-auth.guard');
const { RolesGuard } = require('./auth/roles.guard');
const PermissionsGuard = require('./auth/permissions.guard');
const AuditService = require('./audit/audit.service');
const AuditInterceptor = require('./audit/audit.interceptor');
const RequestValidationMiddleware = require('./common/validation');
const { createConcurrencyLimit } = require('./common/concurrency-limit');
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
const SyncController = require('./sync/sync.controller');
const SyncService = require('./sync/sync.service');
const StoreController = require('./store/store.controller');
const StoreService = require('./store/store.service');
const AiController = require('./ai/ai.controller');
const AiService = require('./ai/ai.service');
const SecurityController = require('./security/security.controller');
const AuthSecurityService = require('./security/auth-security.service');
const IpGeolocationService = require('./security/ip-geolocation.service');
const CashReconciliationController = require('./cash-reconciliation/cash-reconciliation.controller');
const CashReconciliationService = require('./cash-reconciliation/cash-reconciliation.service');

const defaultProductionOrigins = [
  'https://www.mediquick.online',
  'https://mediquick.online',
];

function isAllowedOrigin(origin, env = process.env) {
  if (!origin || env.NODE_ENV !== 'production') {
    return true;
  }

  const normalized = String(origin).trim().replace(/\/$/, '');
  let hostname;
  try {
    hostname = new URL(normalized).hostname.toLowerCase();
  } catch (error) {
    return false;
  }
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
  ) {
    return false;
  }

  const configuredOrigins = [
    env.FRONTEND_URL,
    ...(env.FRONTEND_URLS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  ].filter(Boolean);
  return [...defaultProductionOrigins, ...configuredOrigins]
    .some((allowed) => allowed.replace(/\/$/, '') === normalized);
}

let readyPromise;

function ensureApplicationReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await sequelize.authenticate();
      if (!isProduction) {
        await runMigrations();
      }

      if (enableDemoSeeding && !isProduction) {
        const { seedDemoData } = require('../lib/seed');
        await seedDemoData();
      }
    })().catch((error) => {
      readyPromise = null;
      console.error(JSON.stringify({
        event: 'database_initialization_failed',
        errorName: error?.name || 'UnknownError',
        errorCode: error?.parent?.code || error?.code || null,
      }));
      throw error;
    });
  }

  return readyPromise;
}

function mountLegacyApi(expressApp, { deferFallback = false } = {}) {
  const uploadConcurrency = Math.min(
    4,
    Math.max(1, Number.parseInt(process.env.PRESCRIPTION_UPLOAD_CONCURRENCY || '2', 10) || 2)
  );
  expressApp.use(createConcurrencyLimit({
    maxConcurrent: uploadConcurrency,
    shouldLimit: (req) => req.method === 'POST' && req.path === '/api/prescriptions/upload',
    code: 'PRESCRIPTION_UPLOAD_BUSY',
    message: 'Prescription uploads are busy. Please retry shortly.',
  }));
  const defaultJsonParser = express.json({ limit: '2mb' });
  const prescriptionJsonParser = express.json({ limit: '8mb' });
  expressApp.use((req, res, next) => {
    const parser = req.method === 'POST' && req.path === '/api/prescriptions/upload'
      ? prescriptionJsonParser
      : defaultJsonParser;
    return parser(req, res, (error) => {
      if (error?.type === 'entity.too.large') {
        return res.status(413).json({
          statusCode: 413,
          error: 'Payload Too Large',
          message: 'Request body exceeds the allowed size.',
        });
      }
      return next(error);
    });
  });
  const validationMiddleware = new RequestValidationMiddleware();
  expressApp.use(validationMiddleware.use.bind(validationMiddleware));

  expressApp.use(async (req, res, next) => {
    if (req.path === '/health' || req.path === '/health/database') {
      return next();
    }

    try {
      await ensureApplicationReady();
      next();
    } catch (error) {
      res.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable.',
      });
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
    HealthController,
    AuthController,
    InventoryController,
    SalesController,
    CustomersController,
    ExpensesController,
    PrescriptionsController,
    SuppliersController,
    AnalyticsController,
    ReportsController,
    SyncController,
    StoreController,
    AiController,
    SecurityController,
    CashReconciliationController,
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
    SyncService,
    StoreService,
    AiService,
    IpGeolocationService,
    AuthSecurityService,
    CashReconciliationService,
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    PermissionsGuard,
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})(AppModule);

module.exports = {
  AppModule,
  ensureApplicationReady,
  isAllowedOrigin,
  mountApiFallback,
  mountLegacyApi,
};
