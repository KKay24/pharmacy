const {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} = require('@nestjs/common');
const authenticateToken = require('../../middleware/auth');

class OptionalAuthGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const legacyUsername = request.headers['x-username'];

    if (!authHeader?.startsWith('Bearer ') && !legacyUsername) {
      return true;
    }

    let statusCode = 200;
    let authenticationError = null;
    let authenticated = false;
    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        authenticationError = body;
      },
    };

    return authenticateToken(request, response, () => {
      authenticated = true;
    }).then(() => {
      if (authenticated) return true;
      const message = authenticationError?.error || 'Authentication failed';
      if (statusCode === 403) throw new ForbiddenException(message);
      throw new UnauthorizedException(message);
    });
  }
}

Injectable()(OptionalAuthGuard);

module.exports = OptionalAuthGuard;
