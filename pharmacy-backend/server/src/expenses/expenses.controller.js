const { Body, Controller, Delete, Get, Inject, Param, Post, Put, Req, UseGuards } = require('@nestjs/common');
const ExpensesService = require('./expenses.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class ExpensesController {
  constructor(service) { this.service = service; }
  list() { return this.service.list(); }
  create(body, request) { return this.service.create(body, request?.user); }
  update(params, body, request) { return this.service.update(params.id, body, request?.user); }
  remove(params, body, request) { return this.service.void(params.id, body?.reason, request?.user); }
}

applyClassDecorator(Controller, ExpensesController, 'api/expenses');
Inject(ExpensesService)(ExpensesController, undefined, 0);
applyMethodDecorator(Get, ExpensesController.prototype, 'list');
applyMethodDecorator(Post, ExpensesController.prototype, 'create');
applyMethodDecorator(Put, ExpensesController.prototype, 'update', ':id');
applyMethodDecorator(Delete, ExpensesController.prototype, 'remove', ':id');
for (const method of ['list', 'create', 'update', 'remove']) { applyMethodDecorator(UseGuards, ExpensesController.prototype, method, AuthGuard, RolesGuard, PermissionsGuard); Roles('admin', 'manager')(ExpensesController.prototype, method); }
RequirePermissions(Permissions.EXPENSES_READ)(ExpensesController.prototype, 'list');
for (const method of ['create', 'update', 'remove']) RequirePermissions(Permissions.EXPENSES_WRITE)(ExpensesController.prototype, method);
applyParameterDecorator(Body, ExpensesController.prototype, 'create', 0);
applyParameterDecorator(Req, ExpensesController.prototype, 'create', 1);
applyParameterDecorator(Param, ExpensesController.prototype, 'update', 0);
applyParameterDecorator(Body, ExpensesController.prototype, 'update', 1);
applyParameterDecorator(Req, ExpensesController.prototype, 'update', 2);
applyParameterDecorator(Param, ExpensesController.prototype, 'remove', 0);
applyParameterDecorator(Body, ExpensesController.prototype, 'remove', 1);
applyParameterDecorator(Req, ExpensesController.prototype, 'remove', 2);
module.exports = ExpensesController;
