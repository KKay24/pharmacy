const { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards } = require('@nestjs/common');
const InventoryService = require('./inventory.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class InventoryController {
  constructor(service) { this.service = service; }
  list(query) { return this.service.list(query); }
  lowStock() { return this.service.lowStock(); }
  addBatch(body) { return this.service.addBatch(body); }
  add(body) { return this.service.add(body); }
  update(params, body) { return this.service.update(params.id, body); }
  remove(params) { return this.service.remove(params.id); }
}

applyClassDecorator(Controller, InventoryController, 'api/inventory');
Inject(InventoryService)(InventoryController, undefined, 0);
applyMethodDecorator(Get, InventoryController.prototype, 'list');
applyMethodDecorator(Get, InventoryController.prototype, 'lowStock', 'low-stock');
applyMethodDecorator(Post, InventoryController.prototype, 'addBatch', 'batch');
applyMethodDecorator(Post, InventoryController.prototype, 'add');
applyMethodDecorator(Put, InventoryController.prototype, 'update', ':id');
applyMethodDecorator(Delete, InventoryController.prototype, 'remove', ':id');
applyMethodDecorator(UseGuards, InventoryController.prototype, 'list', AuthGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, InventoryController.prototype, 'lowStock', AuthGuard, PermissionsGuard);
for (const method of ['addBatch', 'add', 'update', 'remove']) applyMethodDecorator(UseGuards, InventoryController.prototype, method, AuthGuard, PermissionsGuard);
for (const method of ['list', 'lowStock']) RequirePermissions(Permissions.INVENTORY_READ)(InventoryController.prototype, method);
for (const method of ['addBatch', 'add', 'update', 'remove']) RequirePermissions(Permissions.INVENTORY_WRITE)(InventoryController.prototype, method);
applyParameterDecorator(Body, InventoryController.prototype, 'addBatch', 0);
applyParameterDecorator(Query, InventoryController.prototype, 'list', 0);
applyParameterDecorator(Body, InventoryController.prototype, 'add', 0);
applyParameterDecorator(Param, InventoryController.prototype, 'update', 0);
applyParameterDecorator(Body, InventoryController.prototype, 'update', 1);
applyParameterDecorator(Param, InventoryController.prototype, 'remove', 0);

module.exports = InventoryController;