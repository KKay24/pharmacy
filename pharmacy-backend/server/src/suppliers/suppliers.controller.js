const { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } = require('@nestjs/common');
const SuppliersService = require('./suppliers.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');

class SuppliersController {
  constructor(service) { this.service = service; }
  list() { return this.service.list(); }
  create(body) { return this.service.create(body); }
  update(params, body) { return this.service.update(params.id, body); }
  remove(params) { return this.service.remove(params.id); }
}

applyClassDecorator(Controller, SuppliersController, 'api/suppliers');
Inject(SuppliersService)(SuppliersController, undefined, 0);
applyMethodDecorator(Get, SuppliersController.prototype, 'list');
applyMethodDecorator(Post, SuppliersController.prototype, 'create');
applyMethodDecorator(Put, SuppliersController.prototype, 'update', ':id');
applyMethodDecorator(Delete, SuppliersController.prototype, 'remove', ':id');
for (const method of ['list', 'create', 'update', 'remove']) { applyMethodDecorator(UseGuards, SuppliersController.prototype, method, AuthGuard, RolesGuard); Roles('admin', 'manager')(SuppliersController.prototype, method); }
applyParameterDecorator(Body, SuppliersController.prototype, 'create', 0);
applyParameterDecorator(Param, SuppliersController.prototype, 'update', 0);
applyParameterDecorator(Body, SuppliersController.prototype, 'update', 1);
applyParameterDecorator(Param, SuppliersController.prototype, 'remove', 0);
module.exports = SuppliersController;