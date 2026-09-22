const { SetMetadata } = require('@nestjs/common');
const { PERMISSIONS_KEY } = require('./permissions');

function RequirePermissions(...permissions) {
  return SetMetadata(PERMISSIONS_KEY, permissions);
}

module.exports = RequirePermissions;