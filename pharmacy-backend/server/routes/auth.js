const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/roleMiddleware');
const { hashPassword, isHashedPassword, verifyPassword } = require('../lib/auth/passwords');
const { signAccessToken } = require('../lib/auth/tokens');
const {
  VALID_ROLES,
  VALID_STATUSES,
  findUserByUsername,
  normalizeUsernameInput,
  serializeUser,
} = require('../lib/users');

router.post('/login', async (req, res) => {
  const username = normalizeUsernameInput(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  console.log(`[AUTH] Login attempt for user: "${username}"`);
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      console.warn(`[AUTH] Login failed: User "${username}" not found in database.`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!verifyPassword(password, user.password)) {
      console.warn(`[AUTH] Login failed: Password mismatch for user "${username}".`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status !== 'active') {
      console.warn(`[AUTH] Login failed: Account "${username}" is ${user.status}.`);
      return res.status(403).json({ error: 'Account is suspended. Please contact administrator.' });
    }

    if (!isHashedPassword(user.password)) {
      user.password = hashPassword(password);
    }

    user.lastLogin = new Date();
    await user.save();

    return res.json({
      success: true,
      message: 'Logged in successfully',
      token: signAccessToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Login error detail:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ user: serializeUser(req.user) });
});

router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['createdAt', 'DESC']],
    });
    return res.json(users.map(serializeUser));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  const username = normalizeUsernameInput(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : 'user';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : null;
  const locations = Array.isArray(req.body?.locations)
    ? req.body.locations.filter(Boolean)
    : [];

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role supplied' });
  }

  try {
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const newUser = await User.create({
      username,
      password: hashPassword(password),
      role,
      email,
      locations,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: serializeUser(newUser),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own account status' });
    }

    user.status = status;
    await user.save();

    return res.json({ success: true, message: `User status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.put('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { email, role, locations, status } = req.body;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent Self-Demotion/Self-Suspension
    if (user.id === req.user.id) {
        if (role && role !== user.role) return res.status(400).json({ error: 'You cannot change your own role' });
        if (status && status !== user.status) return res.status(400).json({ error: 'You cannot change your own status' });
    }

    if (email !== undefined) user.email = email;
    if (role && VALID_ROLES.includes(role)) user.role = role;
    if (Array.isArray(locations)) user.locations = locations;
    if (status && VALID_STATUSES.includes(status)) user.status = status;

    await user.save();
    return res.json({ success: true, message: 'User updated successfully', user: serializeUser(user) });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await user.destroy();
    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
