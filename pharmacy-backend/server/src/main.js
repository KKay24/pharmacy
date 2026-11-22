const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const {
  AppModule,
  ensureApplicationReady,
  isAllowedOrigin,
  mountApiFallback,
  mountLegacyApi,
} = require('./app.module');
const { resolveTrustProxySetting } = require('./security/request-context');
const { getAiProviderDiagnostics } = require('./ai/ai-provider.service');

async function createApplication() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    logger: ['error', 'warn', 'log'],
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', resolveTrustProxySetting());

  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  mountLegacyApi(expressApp, { deferFallback: true });
  await ensureApplicationReady();
  await app.init();
  mountApiFallback(expressApp);
  return app;
}

let applicationPromise;

async function getApplication() {
  if (!applicationPromise) {
    applicationPromise = createApplication();
  }

  return applicationPromise;
}

async function handler(req, res) {
  const app = await getApplication();
  return app.getHttpAdapter().getInstance()(req, res);
}

async function bootstrap() {
  const app = await createApplication();
  await app.listen(Number(process.env.PORT || 5001));
  console.log(`NestJS server running on http://localhost:${process.env.PORT || 5001}`);
  const aiDiagnostics = getAiProviderDiagnostics();
  const aiLog = JSON.stringify({
    event: 'ai_provider_startup',
    ...aiDiagnostics,
  });
  if (aiDiagnostics.configured) {
    console.info(aiLog);
  } else {
    console.warn(aiLog);
  }
  return app;
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('CRITICAL: Failed to start NestJS server:', error.message);
    process.exitCode = 1;
  });
}

module.exports = handler;
module.exports.bootstrap = bootstrap;
module.exports.createApplication = createApplication;
module.exports.handler = handler;