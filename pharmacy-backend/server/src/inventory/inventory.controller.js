const { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } = require('@nestjs/common');
const InventoryService = require('./inventory.service');
const AuthGuard = require('../auth/auth.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class InventoryController {
  constructor(service) { this.service = service; }
  categories() { return this.service.categories(); }
  list(query) { return this.service.list(query); }
  lowStock() { return this.service.lowStock(); }
  movements(params, query) { return this.service.movements(params.id, query); }
  batchHistory(params, query) { return this.service.batchHistory(params.id, query); }
  addBatch(body, req) { return this.service.addBatch(body, req?.user || null); }
  addBatchToMedicine(params, body, req) { return this.service.addBatchToMedicine(params.id, body, req?.user || null); }
  add(body, req) { return this.service.add(body, req?.user || null); }
  update(params, body, req) { return this.service.update(params.id, body, req?.user || null); }
  archiveBatch(params, body, req) { return this.service.archiveBatch(params.id, params.batchId, body, req?.user || null); }
  removeBatch(params, body, req) { return this.service.removeBatch(params.id, params.batchId, body, req?.user || null); }
  remove(params) { return this.service.remove(params.id); }
}

applyClassDecorator(Controller, InventoryController, 'api/inventory');
Inject(InventoryService)(InventoryController, undefined, 0);
applyMethodDecorator(Get, InventoryController.prototype, 'list');
applyMethodDecorator(Get, InventoryController.prototype, 'categories', 'categories');
applyMethodDecorator(Get, InventoryController.prototype, 'lowStock', 'low-stock');
applyMethodDecorator(Get, InventoryController.prototype, 'movements', ':id/movements');
applyMethodDecorator(Get, InventoryController.prototype, 'batchHistory', ':id/batches');
applyMethodDecorator(Post, InventoryController.prototype, 'addBatch', 'batch');
applyMethodDecorator(Post, InventoryController.prototype, 'addBatchToMedicine', ':id/batches');
applyMethodDecorator(Post, InventoryController.prototype, 'add');
applyMethodDecorator(Put, InventoryController.prototype, 'update', ':id');
applyMethodDecorator(Patch, InventoryController.prototype, 'archiveBatch', ':id/batches/:batchId/archive');
applyMethodDecorator(Delete, InventoryController.prototype, 'removeBatch', ':id/batches/:batchId');
applyMethodDecorator(Delete, InventoryController.prototype, 'remove', ':id');
for (const method of ['list', 'categories', 'lowStock', 'movements', 'batchHistory']) {
  applyMethodDecorator(UseGuards, InventoryController.prototype, method, AuthGuard, PermissionsGuard);
  RequirePermissions(Permissions.INVENTORY_READ)(InventoryController.prototype, method);
}
for (const method of ['addBatch', 'addBatchToMedicine', 'add', 'update', 'archiveBatch', 'removeBatch', 'remove']) {
  applyMethodDecorator(UseGuards, InventoryController.prototype, method, AuthGuard, PermissionsGuard);
  RequirePermissions(Permissions.INVENTORY_WRITE)(InventoryController.prototype, method);
}
applyParameterDecorator(Query, InventoryController.prototype, 'list', 0);
applyParameterDecorator(Param, InventoryController.prototype, 'movements', 0);
applyParameterDecorator(Query, InventoryController.prototype, 'movements', 1);
applyParameterDecorator(Param, InventoryController.prototype, 'batchHistory', 0);
applyParameterDecorator(Query, InventoryController.prototype, 'batchHistory', 1);
applyParameterDecorator(Body, InventoryController.prototype, 'addBatch', 0);
applyParameterDecorator(Req, InventoryController.prototype, 'addBatch', 1);
applyParameterDecorator(Param, InventoryController.prototype, 'addBatchToMedicine', 0);
applyParameterDecorator(Body, InventoryController.prototype, 'addBatchToMedicine', 1);
applyParameterDecorator(Req, InventoryController.prototype, 'addBatchToMedicine', 2);
applyParameterDecorator(Body, InventoryController.prototype, 'add', 0);
applyParameterDecorator(Req, InventoryController.prototype, 'add', 1);
applyParameterDecorator(Param, InventoryController.prototype, 'update', 0);
applyParameterDecorator(Body, InventoryController.prototype, 'update', 1);
applyParameterDecorator(Req, InventoryController.prototype, 'update', 2);
applyParameterDecorator(Param, InventoryController.prototype, 'archiveBatch', 0);
applyParameterDecorator(Body, InventoryController.prototype, 'archiveBatch', 1);
applyParameterDecorator(Req, InventoryController.prototype, 'archiveBatch', 2);
applyParameterDecorator(Param, InventoryController.prototype, 'removeBatch', 0);
applyParameterDecorator(Body, InventoryController.prototype, 'removeBatch', 1);
applyParameterDecorator(Req, InventoryController.prototype, 'removeBatch', 2);
applyParameterDecorator(Param, InventoryController.prototype, 'remove', 0);

module.exports = InventoryController;
