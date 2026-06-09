const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { sendEmail, passwordForgotEmail } = require('../utils/emailService');

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

    if (user.status === 'inactive') {
      return res.status(403).json({
        error: 'Your account has been deactivated. Please contact Define Digital admin.',
        status: 'inactive'
      });
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

// POST /api/auth/forgot-password — public
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Always return the same response (never reveal if email exists)
    const genericMsg = { message: 'If this email exists in our system, a reset link has been sent.' };

    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.json(genericMsg);

    // Invalidate any existing unused tokens for this user
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    const html = passwordForgotEmail(user.name, resetLink);
    sendEmail(user.email, 'Reset Your Password — Define Digital', html).catch(() => {});

    return res.json(genericMsg);
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/verify-reset-token/:token — public
router.get('/verify-reset-token/:token', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT prt.*, u.email, u.name FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ?
    `).get(req.params.token);

    if (!row || row.used || new Date(row.expires_at) < new Date()) {
      return res.json({ valid: false });
    }
    return res.json({ valid: true, email: row.email, name: row.name });
  } catch (err) {
    console.error('Verify reset token error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password — public
router.post('/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword are required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const row = db.prepare(`
      SELECT prt.*, u.email, u.name, u.id AS uid FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ?
    `).get(token);

    if (!row || row.used) return res.status(400).json({ error: 'This reset link is invalid or has already been used.' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, row.uid);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);

    // Confirmation email
    const html = `<p>Hi ${row.name}, your Define Digital Portal password was successfully reset. If you did not do this, contact admin immediately.</p>`;
    sendEmail(row.email, 'Password Reset Successful — Define Digital', html).catch(() => {});

    return res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
