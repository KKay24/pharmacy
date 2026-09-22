const { ForbiddenException, Injectable } = require('@nestjs/common');
const { PERMISSIONS_KEY, ROLE_PERMISSIONS } = require('./permissions');

class PermissionsGuard {
  canActivate(context) {
    const required = Reflect.getMetadata(PERMISSIONS_KEY, context.getHandler()) || [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest();
    const granted = ROLE_PERMISSIONS[request.user?.role] || [];
    if (required.every((permission) => granted.includes(permission))) return true;
    throw new ForbiddenException('Insufficient permissions');
  }
}

Injectable()(PermissionsGuard);
module.exports = PermissionsGuard;