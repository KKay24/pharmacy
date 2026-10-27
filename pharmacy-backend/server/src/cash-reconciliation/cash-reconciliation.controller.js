const { Body, Controller, Get, Inject, Post, Req, UseGuards } = require('@nestjs/common');
const CashReconciliationService = require('./cash-reconciliation.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class CashReconciliationController {
  constructor(service) { this.service = service; }
  list() { return this.service.list(); }
  close(body, request) { return this.service.close(body, request?.user); }
}
applyClassDecorator(Controller, CashReconciliationController, 'api/cash-reconciliations');
Inject(CashReconciliationService)(CashReconciliationController, undefined, 0);
applyMethodDecorator(Get, CashReconciliationController.prototype, 'list');
applyMethodDecorator(Post, CashReconciliationController.prototype, 'close');
for (const method of ['list', 'close']) { applyMethodDecorator(UseGuards, CashReconciliationController.prototype, method, AuthGuard, RolesGuard, PermissionsGuard); Roles('admin', 'manager')(CashReconciliationController.prototype, method); }
RequirePermissions(Permissions.ANALYTICS_READ)(CashReconciliationController.prototype, 'list');
RequirePermissions(Permissions.EXPENSES_WRITE)(CashReconciliationController.prototype, 'close');
applyParameterDecorator(Body, CashReconciliationController.prototype, 'close', 0);
applyParameterDecorator(Req, CashReconciliationController.prototype, 'close', 1);
module.exports = CashReconciliationController;
