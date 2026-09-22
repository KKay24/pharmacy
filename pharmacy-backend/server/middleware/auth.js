const User = require('../models/User');
const { verifyAccessToken } = require('../lib/auth/tokens');
const { allowLegacyDevAuth } = require('../lib/config');
const { findUserByUsername } = require('../lib/users');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice('Bearer '.length);
      const payload = verifyAccessToken(token);
      const user = await User.findByPk(payload.sub);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Account not found' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Account is suspended. Please contact administrator.' });
      }

      const isPasswordChangeRequest =
        req.method === 'POST' && req.path.endsWith('/change-password');
      if (user.mustChangePassword && !isPasswordChangeRequest) {
        return res.status(403).json({ error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' });
      }

      req.auth = payload;
      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
  }

  if (allowLegacyDevAuth) {
    const legacyUser = await findUserByUsername(req.headers['x-username']);
    if (legacyUser && legacyUser.status === 'active') {
      req.auth = { legacy: true, username: legacyUser.username };
      req.user = legacyUser;
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Bearer token required' });
};

module.exports = authenticateToken;
