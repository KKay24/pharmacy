const {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} = require('@nestjs/common');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');
const {
  applyClassDecorator,
  applyMethodDecorator,
  applyParameterDecorator,
} = require('../common/decorate');
const AuthSecurityService = require('./auth-security.service');

class SecurityController {
  constructor(authSecurityService) {
    this.authSecurityService = authSecurityService;
  }

  listLoginActivity(query) {
    return this.authSecurityService.listLoginActivity(query);
  }

  investigateIp(params, query) {
    return this.authSecurityService.investigateIp(params?.ipAddress, query);
  }
}

applyClassDecorator(Controller, SecurityController, 'api/security');
Inject(AuthSecurityService)(SecurityController, undefined, 0);

applyMethodDecorator(Get, SecurityController.prototype, 'listLoginActivity', 'login-activity');
applyParameterDecorator(Query, SecurityController.prototype, 'listLoginActivity', 0);
applyMethodDecorator(
  UseGuards,
  SecurityController.prototype,
  'listLoginActivity',
  AuthGuard,
  RolesGuard,
  PermissionsGuard
);
applyMethodDecorator(Roles, SecurityController.prototype, 'listLoginActivity', 'admin');
applyMethodDecorator(
  RequirePermissions,
  SecurityController.prototype,
  'listLoginActivity',
  Permissions.SECURITY_READ
);

applyMethodDecorator(Get, SecurityController.prototype, 'investigateIp', 'login-activity/ip/:ipAddress');
applyParameterDecorator(Param, SecurityController.prototype, 'investigateIp', 0);
applyParameterDecorator(Query, SecurityController.prototype, 'investigateIp', 1);
applyMethodDecorator(
  UseGuards,
  SecurityController.prototype,
  'investigateIp',
  AuthGuard,
  RolesGuard,
  PermissionsGuard
);
applyMethodDecorator(Roles, SecurityController.prototype, 'investigateIp', 'admin');
applyMethodDecorator(
  RequirePermissions,
  SecurityController.prototype,
  'investigateIp',
  Permissions.SECURITY_READ
);

module.exports = SecurityController;
