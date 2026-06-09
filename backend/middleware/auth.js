const jwt = require('jsonwebtoken');
const db  = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'attendance_portal_secret_2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role, name: decoded.name };
    // Update last_seen (throttled — skip if updated < 60s ago to reduce DB writes)
    try {
      const row = db.prepare('SELECT last_seen FROM users WHERE id=?').get(decoded.id);
      const lastMs = row?.last_seen ? new Date(row.last_seen.replace(' ', 'T') + 'Z').getTime() : 0;
      if (Date.now() - lastMs > 60000) {
        db.prepare('UPDATE users SET last_seen=CURRENT_TIMESTAMP WHERE id=?').run(decoded.id);
      }
    } catch {}
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireOwner(req, res, next) {
  if (!['owner', 'co_owner', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action. Please contact the portal owner.' });
  }
  next();
}

// Only the root owner account can do destructive/sensitive operations
function requireRootOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'This action requires root owner privileges. Please contact the portal owner.' });
  }
  next();
}

module.exports = { authenticateToken, requireOwner, requireRootOwner, JWT_SECRET };
