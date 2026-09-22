const { Body, Controller, Get, Inject, Post, UseGuards } = require('@nestjs/common');
const SalesService = require('./sales.service');
const AuthGuard = require('../auth/auth.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');

class SalesController {
  constructor(service) { this.service = service; }
  list() { return this.service.list(); }
  create(body) { return this.service.create(body); }
}

applyClassDecorator(Controller, SalesController, 'api/sales');
Inject(SalesService)(SalesController, undefined, 0);
applyMethodDecorator(Get, SalesController.prototype, 'list');
applyMethodDecorator(Post, SalesController.prototype, 'create');
applyMethodDecorator(UseGuards, SalesController.prototype, 'list', AuthGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'create', AuthGuard);
applyParameterDecorator(Body, SalesController.prototype, 'create', 0);

module.exports = SalesController;