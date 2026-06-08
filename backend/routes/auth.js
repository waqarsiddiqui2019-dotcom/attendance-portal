const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Block trainers that are not yet approved
    if (user.role === 'trainer') {
      if (user.status === 'pending') {
        return res.status(403).json({
          error: 'Your account is pending approval. Please wait for an owner to review your request.',
          status: 'pending'
        });
      }
      if (user.status === 'rejected') {
        return res.status(403).json({
          error: 'Your account request was not approved. Please contact Define Digital.',
          status: 'rejected'
        });
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/trainer-signup  (public — no auth required)
router.post('/trainer-signup', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'trainer','pending')`)
      .run(name, email, hashed);

    return res.status(201).json({ message: 'Registration submitted. Waiting for owner approval.' });
  } catch (err) {
    console.error('Trainer signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register-student (trainer or owner)
router.post('/register-student', authenticateToken, (req, res) => {
  try {
    if (!['trainer', 'owner', 'co_owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only trainers or owners can register students' });
    }
    const { name, email, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

    const hashed = bcrypt.hashSync(password || 'student123', 10);
    const result = db.prepare(`INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'student','active')`)
      .run(name, email, hashed);

    const newUser = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('Register student error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
