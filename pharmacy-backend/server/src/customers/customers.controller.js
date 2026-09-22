const { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } = require('@nestjs/common');
const CustomersService = require('./customers.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');

class CustomersController {
  constructor(service) { this.service = service; }
  list() { return this.service.list(); }
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
for (const method of ['list', 'search', 'create', 'get']) applyMethodDecorator(UseGuards, CustomersController.prototype, method, AuthGuard, RolesGuard);
for (const method of ['list', 'search', 'create', 'get']) Roles('admin', 'manager')(CustomersController.prototype, method);
applyParameterDecorator(Query, CustomersController.prototype, 'search', 0);
applyParameterDecorator(Body, CustomersController.prototype, 'create', 0);
applyParameterDecorator(Param, CustomersController.prototype, 'get', 0);
module.exports = CustomersController;