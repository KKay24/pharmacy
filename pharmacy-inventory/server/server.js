let canonicalBackend;
try {
  // Try monorepo path first
  canonicalBackend = require('../../pharmacy-backend/server/server');
} catch (error) {
  console.error('ERROR: Could not find canonical backend at ../../pharmacy-backend/server/server');
  console.error('This bridge only works if pharmacy-backend is present in the same container.');
  console.error('Original error:', error.message);
  
  // Create a dummy object to prevent further crashes
  canonicalBackend = { 
    startServer: () => Promise.reject(new Error('Backend not found. Please check Render Root Directory settings.')) 
  };
}

if (require.main === module && typeof canonicalBackend.startServer === 'function') {
  canonicalBackend.startServer().catch((error) => {
    console.error('Failed to start canonical backend from legacy bridge:', error);
    process.exitCode = 1;
  });
}

module.exports = canonicalBackend;
