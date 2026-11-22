const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

const serverDirectory = join(__dirname, '..');

function runConfig(environment) {
  return () => execFileSync(process.execPath, ['-e', "require('./lib/config')"], {
    cwd: serverDirectory,
    env: environment,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

test('production requires DATABASE_URL', () => {
  assert.throws(runConfig({ NODE_ENV: 'production', JWT_SECRET: 'test-secret' }), /DATABASE_URL/);
});

test('production requires JWT_SECRET', () => {
  assert.throws(runConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://db.example.test/pharmacy' }), /JWT_SECRET/);
});

test('production rejects configured SQLite', () => {
  assert.throws(runConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'sqlite:/tmp/pharmacy.sqlite',
    JWT_SECRET: 'test-secret',
  }), /SQLite/);
});

test('production requires a PostgreSQL DATABASE_URL', () => {
  assert.throws(runConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'mysql://db.example.test/pharmacy',
    JWT_SECRET: 'test-secret',
  }), /PostgreSQL/);
});

test('development still supports SQLite', () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'pharmacy-config-')), 'test.sqlite');
  try {
    execFileSync(process.execPath, ['-e', "require('./config/db')"], {
      cwd: serverDirectory,
      env: {
        NODE_ENV: 'development',
        JWT_SECRET: 'test-secret',
        SQLITE_STORAGE_PATH: databasePath,
      },
      stdio: 'pipe',
    });
  } finally {
    rmSync(databasePath, { force: true });
  }
});

test('production allows mediquick.online and www.mediquick.online CORS origins', () => {
  execFileSync(
    process.execPath,
    [
      '-e',
      `
        const { isAllowedOrigin } = require('./src/app.module');
        const allowed1 = isAllowedOrigin('https://www.mediquick.online');
        const allowed2 = isAllowedOrigin('https://mediquick.online');
        const allowed3 = isAllowedOrigin('https://www.mediquick.online/');
        const forbidden = isAllowedOrigin('https://evil-phishing.online');
        if (!allowed1 || !allowed2 || !allowed3 || forbidden) {
          process.exit(1);
        }
      `,
    ],
    {
      cwd: serverDirectory,
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret',
        DATABASE_URL: 'postgres://db.example.test/pharmacy',
        POSTGRES_URL: '',
        SQLITE_STORAGE_PATH: '',
        FRONTEND_URL: 'https://www.mediquick.online',
        FRONTEND_URLS: '',
      },
      stdio: 'pipe',
    }
  );
});

test('production CORS rejects unconfigured local and preview origins', () => {
  execFileSync(
    process.execPath,
    [
      '-e',
      `
        const { isAllowedOrigin } = require('./src/app.module');
        const env = { NODE_ENV: 'production' };
        if (
          isAllowedOrigin('http://localhost:3000', env) ||
          isAllowedOrigin('http://localhost:3000', { ...env, FRONTEND_URL: 'http://localhost:3000' }) ||
          isAllowedOrigin('https://untrusted.vercel.app', env) ||
          isAllowedOrigin('https://evil.example', env) ||
          !isAllowedOrigin('https://preview.example', { ...env, FRONTEND_URLS: 'https://preview.example' })
        ) {
          process.exit(1);
        }
      `,
    ],
    {
      cwd: serverDirectory,
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret',
        DATABASE_URL: 'postgres://db.example.test/pharmacy',
        POSTGRES_URL: '',
        SQLITE_STORAGE_PATH: '',
        FRONTEND_URL: 'https://www.mediquick.online',
        FRONTEND_URLS: '',
      },
      stdio: 'pipe',
    }
  );
});

test('production CORS middleware rejects an unconfigured origin with 403', () => {
  execFileSync(
    process.execPath,
    [
      '-e',
      `
        const { rejectDisallowedOrigin } = require('./src/main');
        const req = { get: () => 'https://evil.example' };
        const res = {
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; },
        };
        let nextCalled = false;
        rejectDisallowedOrigin(req, res, () => { nextCalled = true; });
        if (nextCalled || res.statusCode !== 403 || res.body.message !== 'Origin not allowed') {
          process.exit(1);
        }
      `,
    ],
    {
      cwd: serverDirectory,
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret',
        DATABASE_URL: 'postgres://db.example.test/pharmacy',
        POSTGRES_URL: '',
        SQLITE_STORAGE_PATH: '',
        FRONTEND_URL: 'https://www.mediquick.online',
        FRONTEND_URLS: '',
      },
      stdio: 'pipe',
    }
  );
});
