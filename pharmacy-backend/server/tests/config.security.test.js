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