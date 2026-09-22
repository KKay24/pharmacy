const { Body, Controller, Get, Inject, Param, Post, Put, Query, UseGuards } = require('@nestjs/common');
const PrescriptionsService = require('./prescriptions.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class PrescriptionsController {
  constructor(service) { this.service = service; }
  list(query) { return this.service.list(query); }
  create(body) { return this.service.create(body); }
  updateStatus(params, body) { return this.service.updateStatus(params.id, body.status); }
}

applyClassDecorator(Controller, PrescriptionsController, 'api/prescriptions');
Inject(PrescriptionsService)(PrescriptionsController, undefined, 0);
applyMethodDecorator(Get, PrescriptionsController.prototype, 'list');
applyMethodDecorator(Post, PrescriptionsController.prototype, 'create');
applyMethodDecorator(Put, PrescriptionsController.prototype, 'updateStatus', ':id/status');
for (const method of ['list', 'create', 'updateStatus']) { applyMethodDecorator(UseGuards, PrescriptionsController.prototype, method, AuthGuard, RolesGuard, PermissionsGuard); Roles('admin', 'manager')(PrescriptionsController.prototype, method); }
RequirePermissions(Permissions.PRESCRIPTIONS_READ)(PrescriptionsController.prototype, 'list');
for (const method of ['create', 'updateStatus']) RequirePermissions(Permissions.PRESCRIPTIONS_WRITE)(PrescriptionsController.prototype, method);
applyParameterDecorator(Body, PrescriptionsController.prototype, 'create', 0);
applyParameterDecorator(Query, PrescriptionsController.prototype, 'list', 0);
applyParameterDecorator(Param, PrescriptionsController.prototype, 'updateStatus', 0);
applyParameterDecorator(Body, PrescriptionsController.prototype, 'updateStatus', 1);
module.exports = PrescriptionsController;