const { Controller, Get, Inject, Query, UseGuards } = require('@nestjs/common');
const AnalyticsService = require('./analytics.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class ReportsController {
  constructor(service) { this.service = service; }
  analytics(query) { return this.service.profitLoss(query); }
}

applyClassDecorator(Controller, ReportsController, 'api/reports');
Inject(AnalyticsService)(ReportsController, undefined, 0);
applyMethodDecorator(Get, ReportsController.prototype, 'analytics', 'analytics');
applyMethodDecorator(UseGuards, ReportsController.prototype, 'analytics', AuthGuard, RolesGuard, PermissionsGuard);
Roles('admin', 'manager')(ReportsController.prototype, 'analytics');
RequirePermissions(Permissions.ANALYTICS_READ)(ReportsController.prototype, 'analytics');
applyParameterDecorator(Query, ReportsController.prototype, 'analytics', 0);
module.exports = ReportsController;