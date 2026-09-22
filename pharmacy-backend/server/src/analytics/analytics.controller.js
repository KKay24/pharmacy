const { Controller, Get, Inject, Query, UseGuards } = require('@nestjs/common');
const AnalyticsService = require('./analytics.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator, applyParameterDecorator } = require('../common/decorate');
const RequirePermissions = require('../auth/permissions.decorator');
const { Permissions } = require('../auth/permissions');
const PermissionsGuard = require('../auth/permissions.guard');

class AnalyticsController {
  constructor(service) { this.service = service; }
  profitLoss(query) { return this.service.profitLoss(query); }
  predictions(query) { return this.service.predictions(query); }
  reorderSuggestions(query) { return this.service.reorderSuggestions(query); }
  risks(query) { return this.service.risks(query); }
}

applyClassDecorator(Controller, AnalyticsController, 'api/analytics');
Inject(AnalyticsService)(AnalyticsController, undefined, 0);
applyMethodDecorator(Get, AnalyticsController.prototype, 'profitLoss', 'profit-loss');
applyMethodDecorator(Get, AnalyticsController.prototype, 'predictions', 'predictions');
applyMethodDecorator(Get, AnalyticsController.prototype, 'reorderSuggestions', 'reorder-suggestions');
applyMethodDecorator(Get, AnalyticsController.prototype, 'risks', 'risks');
for (const method of ['profitLoss', 'predictions', 'reorderSuggestions', 'risks']) { applyMethodDecorator(UseGuards, AnalyticsController.prototype, method, AuthGuard, RolesGuard, PermissionsGuard); Roles('admin', 'manager')(AnalyticsController.prototype, method); RequirePermissions(Permissions.ANALYTICS_READ)(AnalyticsController.prototype, method); }
for (const method of ['predictions', 'reorderSuggestions', 'risks']) applyParameterDecorator(Query, AnalyticsController.prototype, method, 0);
applyParameterDecorator(Query, AnalyticsController.prototype, 'profitLoss', 0);
module.exports = AnalyticsController;