require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const {
  AppModule,
  ensureApplicationReady,
  isAllowedOrigin,
  mountApiFallback,
  mountLegacyApi,
} = require('./app.module');

async function createApplication() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    logger: ['error', 'warn', 'log'],
  });

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

  mountLegacyApi(app.getHttpAdapter().getInstance(), { deferFallback: true });
  await ensureApplicationReady();
  await app.init();
  mountApiFallback(app.getHttpAdapter().getInstance());
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