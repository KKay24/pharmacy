const { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } = require('@nestjs/common');
const ExpensesService = require('./expenses.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');

class ExpensesController {
  constructor(service) { this.service = service; }
  list() { return this.service.list(); }
  create(body) { return this.service.create(body); }
  update(params, body) { return this.service.update(params.id, body); }
  remove(params) { return this.service.remove(params.id); }
}

applyClassDecorator(Controller, ExpensesController, 'api/expenses');
Inject(ExpensesService)(ExpensesController, undefined, 0);
applyMethodDecorator(Get, ExpensesController.prototype, 'list');
applyMethodDecorator(Post, ExpensesController.prototype, 'create');
applyMethodDecorator(Put, ExpensesController.prototype, 'update', ':id');
applyMethodDecorator(Delete, ExpensesController.prototype, 'remove', ':id');
for (const method of ['list', 'create', 'update', 'remove']) { applyMethodDecorator(UseGuards, ExpensesController.prototype, method, AuthGuard, RolesGuard); Roles('admin', 'manager')(ExpensesController.prototype, method); }
applyParameterDecorator(Body, ExpensesController.prototype, 'create', 0);
applyParameterDecorator(Param, ExpensesController.prototype, 'update', 0);
applyParameterDecorator(Body, ExpensesController.prototype, 'update', 1);
applyParameterDecorator(Param, ExpensesController.prototype, 'remove', 0);
module.exports = ExpensesController;