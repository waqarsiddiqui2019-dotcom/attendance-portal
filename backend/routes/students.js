const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail, passwordResetEmail } = require('../utils/emailService');

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

// PATCH /api/students/:studentId/reset-password — trainer (own students) or owner role
router.patch('/:studentId/reset-password', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    let student;
    if (['owner', 'co_owner', 'admin'].includes(req.user.role)) {
      student = db.prepare("SELECT id, name FROM users WHERE id=? AND role='student'").get(req.params.studentId);
    } else {
      student = db.prepare(`
        SELECT DISTINCT u.id, u.name FROM users u
        JOIN batch_students bs ON bs.student_id = u.id
        JOIN batches b ON b.id = bs.batch_id
        WHERE u.id=? AND u.role='student' AND b.trainer_id=?
      `).get(req.params.studentId, req.user.id);
    }
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password=? WHERE id=?").run(hashed, student.id);

    // Email student their new password
    try {
      const fullStudent = db.prepare('SELECT email FROM users WHERE id=?').get(student.id);
      if (fullStudent?.email) {
        const loginLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        sendEmail(fullStudent.email, 'Your Password Has Been Reset — Define Digital', passwordResetEmail(student.name, newPassword, loginLink)).catch(() => {});
      }
    } catch (e) { console.error('[Email] student password reset email error (non-fatal):', e.message); }

    return res.json({ message: `Password reset for ${student.name}` });
  } catch (err) {
    console.error('Reset student password error:', err);
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
