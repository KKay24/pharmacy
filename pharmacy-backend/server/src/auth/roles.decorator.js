const { SetMetadata } = require('@nestjs/common');
const { ROLES_KEY } = require('./roles.guard');

function Roles(...roles) {
  const apply = SetMetadata(ROLES_KEY, roles);
  return (target, propertyKey, descriptor) => {
    const resolvedDescriptor =
      descriptor || (propertyKey ? Object.getOwnPropertyDescriptor(target, propertyKey) : undefined);
    return apply(target, propertyKey, resolvedDescriptor);
  };
}

module.exports = Roles;
