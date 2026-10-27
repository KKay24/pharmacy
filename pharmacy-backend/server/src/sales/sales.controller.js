const { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } = require('@nestjs/common');
const SalesService = require('./sales.service');
const AuthGuard = require('../auth/auth.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');

class SalesController {
  constructor(service) { this.service = service; }
  list(query) { return this.service.list(query); }
  create(body, request) { return this.service.create(body, request?.user); }
  reversalPreview(id) { return this.service.reversalPreview(id); }
  reverse(id, body, request) { return this.service.reverseSale(id, body?.reason, request?.user); }
  refund(id, body, request) { return this.service.refundReceipt(id, body, request?.user); }
  emailReceipt(id, body) { return this.service.emailReceipt(id, body?.email); }
}

applyClassDecorator(Controller, SalesController, 'api/sales');
Inject(SalesService)(SalesController, undefined, 0);
applyMethodDecorator(Get, SalesController.prototype, 'list');
applyMethodDecorator(Get, SalesController.prototype, 'reversalPreview', ':id/reversal-preview');
applyMethodDecorator(Post, SalesController.prototype, 'create');
applyMethodDecorator(Patch, SalesController.prototype, 'reverse', ':id/reverse');
applyMethodDecorator(Post, SalesController.prototype, 'refund', ':id/refund');
applyMethodDecorator(Post, SalesController.prototype, 'emailReceipt', ':id/email-receipt');
applyMethodDecorator(UseGuards, SalesController.prototype, 'list', AuthGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'reversalPreview', AuthGuard, RolesGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'create', AuthGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'reverse', AuthGuard, RolesGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'refund', AuthGuard, RolesGuard, PermissionsGuard);
applyMethodDecorator(UseGuards, SalesController.prototype, 'emailReceipt', AuthGuard, PermissionsGuard);
applyMethodDecorator(Roles, SalesController.prototype, 'reversalPreview', 'admin');
applyMethodDecorator(Roles, SalesController.prototype, 'reverse', 'admin');
applyMethodDecorator(Roles, SalesController.prototype, 'refund', 'admin');
applyMethodDecorator(RequirePermissions, SalesController.prototype, 'list', Permissions.SALES_READ);
applyMethodDecorator(RequirePermissions, SalesController.prototype, 'reversalPreview', Permissions.SALES_READ);
applyMethodDecorator(RequirePermissions, SalesController.prototype, 'create', Permissions.SALES_WRITE);
applyMethodDecorator(RequirePermissions, SalesController.prototype, 'reverse', Permissions.SALES_WRITE);
applyMethodDecorator(RequirePermissions, SalesController.prototype, 'refund', Permissions.SALES_WRITE);
applyMethodDecorator(RequirePermissions, SalesController.prototype, 'emailReceipt', Permissions.SALES_READ);
applyParameterDecorator(Body, SalesController.prototype, 'create', 0);
applyParameterDecorator(Req, SalesController.prototype, 'create', 1);
applyParameterDecorator(Query, SalesController.prototype, 'list', 0);
applyParameterDecorator(Param, SalesController.prototype, 'reversalPreview', 0, 'id');
applyParameterDecorator(Param, SalesController.prototype, 'reverse', 0, 'id');
applyParameterDecorator(Body, SalesController.prototype, 'reverse', 1);
applyParameterDecorator(Req, SalesController.prototype, 'reverse', 2);
applyParameterDecorator(Param, SalesController.prototype, 'refund', 0, 'id');
applyParameterDecorator(Body, SalesController.prototype, 'refund', 1);
applyParameterDecorator(Req, SalesController.prototype, 'refund', 2);
applyParameterDecorator(Param, SalesController.prototype, 'emailReceipt', 0, 'id');
applyParameterDecorator(Body, SalesController.prototype, 'emailReceipt', 1);

module.exports = SalesController;
