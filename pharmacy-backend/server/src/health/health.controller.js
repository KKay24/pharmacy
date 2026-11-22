const {
  Controller,
  Get,
  ServiceUnavailableException,
} = require('@nestjs/common');
const { sequelize } = require('../../models');
const { applyClassDecorator, applyMethodDecorator } = require('../common/decorate');

class HealthController {
  health() {
    return { status: 'ok' };
  }

  async database() {
    try {
      await sequelize.authenticate();
      return { status: 'ok', database: 'ok' };
    } catch (error) {
      console.error(JSON.stringify({
        event: 'database_health_check_failed',
        errorName: error?.name || 'UnknownError',
        errorCode: error?.parent?.code || error?.code || null,
      }));
      throw new ServiceUnavailableException('Database is temporarily unavailable.');
    }
  }
}

applyClassDecorator(Controller, HealthController);
applyMethodDecorator(Get, HealthController.prototype, 'health', 'health');
applyMethodDecorator(Get, HealthController.prototype, 'database', 'health/database');

module.exports = HealthController;
