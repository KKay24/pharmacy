function createConcurrencyLimit({
  maxConcurrent,
  shouldLimit = () => true,
  statusCode = 503,
  code = 'REQUEST_CAPACITY_EXCEEDED',
  message = 'This request is temporarily busy. Please try again shortly.',
  retryAfterSeconds = 5,
}) {
  let activeRequests = 0;

  return function concurrencyLimitMiddleware(req, res, next) {
    if (!shouldLimit(req)) return next();
    if (activeRequests >= maxConcurrent) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(statusCode).json({
        statusCode,
        error: statusCode === 429 ? 'Too Many Requests' : 'Service Unavailable',
        code,
        message,
      });
    }

    activeRequests += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeRequests = Math.max(0, activeRequests - 1);
    };
    res.once('finish', release);
    res.once('close', release);
    return next();
  };
}

module.exports = { createConcurrencyLimit };
