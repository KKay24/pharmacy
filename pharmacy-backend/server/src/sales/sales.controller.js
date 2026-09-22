const { Body, Controller, Get, Inject, Post, Query, UseGuards } = require('@nestjs/common');
const SalesService = require('./sales.service');
const AuthGuard = require('../auth/auth.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class SalesController {
  constructor(service) { this.service = service; }
  list(query) { return this.service.list(query); }
  create(body) { return this.service.create(body); }
}

applyClassDecorator(Controller, SalesController, 'api/sales');
Inject(SalesService)(SalesController, undefined, 0);
applyMethodDecorator(Get, SalesController.prototype, 'list');
applyMethodDecorator(Post, SalesController.prototype, 'create');
applyMethodDecorator(UseGuards, SalesController.prototype, 'list', AuthGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'create', AuthGuard, PermissionsGuard);
RequirePermissions(Permissions.SALES_READ)(SalesController.prototype, 'list');
RequirePermissions(Permissions.SALES_WRITE)(SalesController.prototype, 'create');
applyParameterDecorator(Body, SalesController.prototype, 'create', 0);
applyParameterDecorator(Query, SalesController.prototype, 'list', 0);

module.exports = SalesController;