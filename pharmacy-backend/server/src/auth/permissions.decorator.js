const { SetMetadata } = require('@nestjs/common');
const { PERMISSIONS_KEY } = require('./permissions');

function RequirePermissions(...permissions) {
  const apply = SetMetadata(PERMISSIONS_KEY, permissions);
  return (target, propertyKey, descriptor) => {
    const resolvedDescriptor =
      descriptor || (propertyKey ? Object.getOwnPropertyDescriptor(target, propertyKey) : undefined);
    return apply(target, propertyKey, resolvedDescriptor);
  };
}

module.exports = RequirePermissions;
