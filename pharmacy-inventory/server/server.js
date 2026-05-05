const canonicalBackend = require('../../pharmacy-backend/server/server');

if (require.main === module && typeof canonicalBackend.startServer === 'function') {
  canonicalBackend.startServer().catch((error) => {
    console.error('Failed to start canonical backend from legacy bridge:', error);
    process.exitCode = 1;
  });
}

module.exports = canonicalBackend;
