const { Injectable } = require('@nestjs/common');
const authenticateToken = require('../../middleware/auth');

class AuthGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return new Promise((resolve) => {
      authenticateToken(request, response, () => resolve(true)).catch(() => resolve(false));
    });
  }
}

Injectable()(AuthGuard);

module.exports = AuthGuard;