const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { createConcurrencyLimit } = require('../src/common/concurrency-limit');
const { startMemoryMonitor } = require('../src/common/memory-monitor');

function makeResponse() {
  const response = new EventEmitter();
  response.headers = {};
  response.setHeader = (name, value) => { response.headers[name] = value; };
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body) => {
    response.body = body;
    return response;
  };
  return response;
}

test('concurrency limit rejects excess uploads and releases capacity on response close', () => {
  const middleware = createConcurrencyLimit({
    maxConcurrent: 1,
    shouldLimit: (req) => req.path === '/upload',
    code: 'PRESCRIPTION_UPLOAD_BUSY',
  });
  let entered = 0;
  const next = () => { entered += 1; };
  const firstResponse = makeResponse();
  middleware({ path: '/upload' }, firstResponse, next);

  const rejectedResponse = makeResponse();
  middleware({ path: '/upload' }, rejectedResponse, next);
  assert.equal(entered, 1);
  assert.equal(rejectedResponse.statusCode, 503);
  assert.equal(rejectedResponse.headers['Retry-After'], '5');
  assert.equal(rejectedResponse.body.code, 'PRESCRIPTION_UPLOAD_BUSY');

  firstResponse.emit('close');
  const nextResponse = makeResponse();
  middleware({ path: '/upload' }, nextResponse, next);
  assert.equal(entered, 2);
});

test('memory monitor logs bounded process memory metrics and stops its timer', () => {
  let intervalCallback;
  let intervalDuration;
  let clearedTimer;
  const timer = { unrefCalled: false, unref() { this.unrefCalled = true; } };
  const warnings = [];
  const infos = [];
  const monitor = startMemoryMonitor({
    env: { MEMORY_WARNING_RSS_MB: '400', MEMORY_LOG_INTERVAL_MS: '10000' },
    memoryUsage: () => ({
      rss: 450 * 1024 * 1024,
      heapUsed: 20 * 1024 * 1024,
      heapTotal: 40 * 1024 * 1024,
      external: 3 * 1024 * 1024,
      arrayBuffers: 2 * 1024 * 1024,
    }),
    setIntervalFn: (callback, duration) => {
      intervalCallback = callback;
      intervalDuration = duration;
      return timer;
    },
    clearIntervalFn: (value) => { clearedTimer = value; },
    logger: {
      info: (line) => infos.push(JSON.parse(line)),
      warn: (line) => warnings.push(JSON.parse(line)),
    },
  });

  assert.equal(intervalDuration, 10_000);
  assert.equal(timer.unrefCalled, true);
  assert.equal(infos.length, 0);
  assert.equal(warnings[0].event, 'process_memory_usage');
  assert.equal(warnings[0].rssBytes, 450 * 1024 * 1024);
  assert.equal(warnings[0].utilizationPercent, 113);
  intervalCallback();
  assert.equal(warnings.length, 2);
  monitor.stop();
  assert.equal(clearedTimer, timer);
});

test('memory monitor can be disabled without starting a timer', () => {
  let started = false;
  const monitor = startMemoryMonitor({
    env: { MEMORY_MONITOR_ENABLED: 'false' },
    setIntervalFn: () => { started = true; },
  });
  monitor.stop();
  assert.equal(started, false);
});
