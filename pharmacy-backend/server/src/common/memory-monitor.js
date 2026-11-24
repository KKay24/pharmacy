const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_WARNING_RSS_MB = 400;

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function startMemoryMonitor({
  env = process.env,
  memoryUsage = process.memoryUsage,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger = console,
} = {}) {
  if (env.MEMORY_MONITOR_ENABLED === 'false') return { stop() {} };

  const intervalMs = boundedInteger(env.MEMORY_LOG_INTERVAL_MS, DEFAULT_INTERVAL_MS, 5_000, 300_000);
  const warningRssBytes = boundedInteger(env.MEMORY_WARNING_RSS_MB, DEFAULT_WARNING_RSS_MB, 128, 4096) * 1024 * 1024;
  const sample = () => {
    const usage = memoryUsage();
    const event = {
      event: 'process_memory_usage',
      rssBytes: usage.rss,
      heapUsedBytes: usage.heapUsed,
      heapTotalBytes: usage.heapTotal,
      externalBytes: usage.external,
      arrayBuffersBytes: usage.arrayBuffers,
      warningRssBytes,
      utilizationPercent: Math.round((usage.rss / warningRssBytes) * 100),
    };
    const output = JSON.stringify(event);
    if (usage.rss >= warningRssBytes) logger.warn(output);
    else logger.info(output);
  };

  sample();
  const timer = setIntervalFn(sample, intervalMs);
  timer.unref?.();
  return { stop: () => clearIntervalFn(timer) };
}

module.exports = { startMemoryMonitor };
