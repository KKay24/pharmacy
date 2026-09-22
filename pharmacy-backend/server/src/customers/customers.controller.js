const { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } = require('@nestjs/common');
const CustomersService = require('./customers.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class CustomersController {
  constructor(service) { this.service = service; }
  list(query) { return this.service.list(query); }
  search(query) { return this.service.search(query.q); }
  create(body) { return this.service.create(body); }
  get(params) { return this.service.get(params.id); }
}

applyClassDecorator(Controller, CustomersController, 'api/customers');
Inject(CustomersService)(CustomersController, undefined, 0);
applyMethodDecorator(Get, CustomersController.prototype, 'list');
applyMethodDecorator(Get, CustomersController.prototype, 'search', 'search');
applyMethodDecorator(Post, CustomersController.prototype, 'create');
applyMethodDecorator(Get, CustomersController.prototype, 'get', ':id');
for (const method of ['list', 'search', 'create', 'get']) applyMethodDecorator(UseGuards, CustomersController.prototype, method, AuthGuard, RolesGuard, PermissionsGuard);
for (const method of ['list', 'search', 'get']) RequirePermissions(Permissions.CUSTOMERS_READ)(CustomersController.prototype, method);
RequirePermissions(Permissions.CUSTOMERS_WRITE)(CustomersController.prototype, 'create');
for (const method of ['list', 'search', 'create', 'get']) Roles('admin', 'manager')(CustomersController.prototype, method);
applyParameterDecorator(Query, CustomersController.prototype, 'search', 0);
applyParameterDecorator(Query, CustomersController.prototype, 'list', 0);
applyParameterDecorator(Body, CustomersController.prototype, 'create', 0);
applyParameterDecorator(Param, CustomersController.prototype, 'get', 0);
module.exports = CustomersController;