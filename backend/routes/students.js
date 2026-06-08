const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const TRAINER_ROLES = ['trainer', 'owner', 'co_owner', 'admin'];

// Trainer: batch must be theirs. Owner roles: any batch.
function getBatch(batchId, user) {
  if (['owner', 'co_owner', 'admin'].includes(user.role)) {
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  }
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, user.id);
}

// GET /api/students/my-batches — student only
router.get('/my-batches', (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access this endpoint' });
    }
    const batches = db.prepare(`
      SELECT b.id, b.name, b.description, b.start_date, b.end_date, b.created_at
      FROM batch_students bs
      JOIN batches b ON bs.batch_id = b.id
      WHERE bs.student_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);
    return res.json({ batches });
  } catch (err) {
    console.error('Get my batches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/students/batch/:batchId — trainer, owner, co_owner, admin
router.get('/batch/:batchId', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const batch = getBatch(req.params.batchId, req.user);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.status, bs.enrolled_at
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      WHERE bs.batch_id = ?
      ORDER BY u.name ASC
    `).all(batch.id);

    return res.json({ students });
  } catch (err) {
    console.error('Get students error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/students/batch/:batchId — add/create student; trainer, owner, co_owner, admin
router.post('/batch/:batchId', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const batch = getBatch(req.params.batchId, req.user);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { name, email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let student = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, 'student');

    if (!student) {
      if (!name) {
        return res.status(400).json({ error: 'Name is required to create a new student' });
      }
      const hashed = bcrypt.hashSync(password || 'student123', 10);
      const result = db.prepare(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'student')"
      ).run(name, email, hashed);
      student = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    const existing = db.prepare(
      'SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?'
    ).get(batch.id, student.id);
    if (existing) {
      return res.status(409).json({ error: 'Student is already enrolled in this batch' });
    }

    db.prepare('INSERT INTO batch_students (batch_id, student_id) VALUES (?, ?)').run(batch.id, student.id);

    const enrolled = db.prepare(`
      SELECT u.id, u.name, u.email, bs.enrolled_at
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      WHERE bs.batch_id = ? AND bs.student_id = ?
    `).get(batch.id, student.id);

    return res.status(201).json({ student: enrolled });
  } catch (err) {
    console.error('Add student error:', err);
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Student is already enrolled in this batch' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/students/batch/:batchId/:studentId — trainer, owner, co_owner, admin
router.delete('/batch/:batchId/:studentId', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const batch = getBatch(req.params.batchId, req.user);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const enrollment = db.prepare(
      'SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?'
    ).get(batch.id, req.params.studentId);
    if (!enrollment) {
      return res.status(404).json({ error: 'Student is not enrolled in this batch' });
    }

    db.prepare('DELETE FROM batch_students WHERE batch_id = ? AND student_id = ?')
      .run(batch.id, req.params.studentId);

    return res.json({ message: 'Student removed from batch successfully' });
  } catch (err) {
    console.error('Remove student error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
