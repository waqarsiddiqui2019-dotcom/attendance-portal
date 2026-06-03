const express = require('express');
const db = require('../database');
const { authenticateToken, requireOwner } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireOwner);

// GET /api/owner/stats
router.get('/stats', (req, res) => {
  try {
    const trainers  = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='trainer' AND status='active'").get().c;
    const pending   = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='trainer' AND status='pending'").get().c;
    const students  = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c;
    const batches   = db.prepare("SELECT COUNT(*) as c FROM batches").get().c;
    return res.json({ trainers, pending, students, batches });
  } catch (err) {
    console.error('Owner stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/trainers  — all trainers (all statuses), pending first
router.get('/trainers', (req, res) => {
  try {
    const trainers = db.prepare(`
      SELECT u.id, u.name, u.email, u.status, u.created_at,
             COUNT(b.id) AS batch_count
      FROM users u
      LEFT JOIN batches b ON b.trainer_id = u.id
      WHERE u.role = 'trainer'
      GROUP BY u.id
      ORDER BY
        CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
        u.created_at DESC
    `).all();
    return res.json({ trainers });
  } catch (err) {
    console.error('Owner get trainers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/owner/trainers/:id/approve
router.put('/trainers/:id/approve', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    db.prepare("UPDATE users SET status='active' WHERE id=?").run(req.params.id);
    return res.json({ message: 'Trainer approved successfully' });
  } catch (err) {
    console.error('Approve trainer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/owner/trainers/:id/reject
router.put('/trainers/:id/reject', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    db.prepare("UPDATE users SET status='rejected' WHERE id=?").run(req.params.id);
    return res.json({ message: 'Trainer rejected' });
  } catch (err) {
    console.error('Reject trainer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/owner/trainers/:id
router.delete('/trainers/:id', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    return res.json({ message: 'Trainer removed' });
  } catch (err) {
    console.error('Delete trainer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/batches — all batches across all trainers
router.get('/batches', (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT b.*, u.name AS trainer_name,
             COUNT(bs.student_id) AS student_count
      FROM batches b
      JOIN users u ON b.trainer_id = u.id
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all();
    return res.json({ batches });
  } catch (err) {
    console.error('Owner get batches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
