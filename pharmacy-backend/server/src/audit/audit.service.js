const { Injectable } = require('@nestjs/common');
const { AuditLog } = require('../../models');

class AuditService {
  async record({ request, action, statusCode, metadata = null }) {
    try {
      await AuditLog.create({
        userId: request.user?.id || null,
        action,
        resource: request.path.split('/').filter(Boolean)[1] || 'api',
        method: request.method,
        path: request.originalUrl || request.path,
        statusCode: statusCode || null,
        metadata,
        ipAddress: request.ip || request.socket?.remoteAddress || null,
      });
    } catch (error) {
      console.error('Audit log write failed:', error.message);
    }
  }
}

Injectable()(AuditService);
module.exports = AuditService;