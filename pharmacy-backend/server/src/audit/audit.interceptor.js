const { Inject, Injectable } = require('@nestjs/common');
const { tap } = require('rxjs');

class AuditInterceptor {
  constructor(auditService) { this.auditService = auditService; }

  intercept(context, next) {
    const request = context.switchToHttp().getRequest();
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (!isMutation) return next.handle();
    return next.handle().pipe(tap(() => this.auditService.record({
      request,
      action: `${request.method} ${request.path}`,
      statusCode: context.switchToHttp().getResponse().statusCode,
    })));
  }
}

Injectable()(AuditInterceptor);
Inject(require('./audit.service'))(AuditInterceptor, undefined, 0);
module.exports = AuditInterceptor;