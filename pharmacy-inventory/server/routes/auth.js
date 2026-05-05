const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Login
router.post('/login', async (req, res) => {
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;
  const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';
  const password = typeof rawPassword === 'string' ? rawPassword.trim() : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // In a real app, use bcrypt and comparing hashes. 
    // Here we are comparing plain text as requested/implied by current simple setup.
    if (user.password === password) {
      res.json({ success: true, message: 'Logged in successfully', user: { username: user.username, role: 'user' } });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
