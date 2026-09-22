const { Injectable } = require('@nestjs/common');

const ROLES_KEY = 'pharmacy:roles';

class RolesGuard {
  canActivate(context) {
    const requiredRoles = Reflect.getMetadata(ROLES_KEY, context.getHandler()) || [];
    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    return Boolean(request.user && requiredRoles.includes(request.user.role));
  }
}

Injectable()(RolesGuard);

module.exports = { ROLES_KEY, RolesGuard };