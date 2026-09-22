const { Controller, Get, Inject, UseGuards } = require('@nestjs/common');
const AnalyticsService = require('./analytics.service');
const AuthGuard = require('../auth/auth.guard');
const Roles = require('../auth/roles.decorator');
const { RolesGuard } = require('../auth/roles.guard');
const { applyClassDecorator, applyMethodDecorator } = require('../common/decorate');

class ReportsController {
  constructor(service) { this.service = service; }
  analytics() { return this.service.profitLoss(); }
}

applyClassDecorator(Controller, ReportsController, 'api/reports');
Inject(AnalyticsService)(ReportsController, undefined, 0);
applyMethodDecorator(Get, ReportsController.prototype, 'analytics', 'analytics');
applyMethodDecorator(UseGuards, ReportsController.prototype, 'analytics', AuthGuard, RolesGuard);
Roles('admin', 'manager')(ReportsController.prototype, 'analytics');
module.exports = ReportsController;