const { Injectable } = require('@nestjs/common');
const { AuditLog } = require('../../models');
const { extractClientIp } = require('../security/request-context');

class AuditService {
  async record({ request, action, statusCode, metadata = null }) {
    try {
      const ipAddress = extractClientIp(request);
      await AuditLog.create({
        userId: request.user?.id || null,
        action,
        resource: request.path.split('/').filter(Boolean)[1] || 'api',
        method: request.method,
        path: request.originalUrl || request.path,
        statusCode: statusCode || null,
        metadata,
        ipAddress: ipAddress !== 'unknown' ? ipAddress : null,
      });
    } catch (error) {
      console.error('Audit log write failed:', error.message);
    }
  }
}

Injectable()(AuditService);
module.exports = AuditService;