const { SetMetadata } = require('@nestjs/common');
const { ROLES_KEY } = require('./roles.guard');

function Roles(...roles) {
  return SetMetadata(ROLES_KEY, roles);
}

module.exports = Roles;