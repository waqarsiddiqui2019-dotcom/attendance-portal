const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication (trainer)
router.use(authenticateToken);

// Helper: verify batch belongs to trainer
function getBatchForTrainer(batchId, trainerId) {
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, trainerId);
}

// GET /api/students/my-batches — Get batches a student is enrolled in
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

// GET /api/students/batch/:batchId — Get all students in a batch
router.get('/batch/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can view batch students' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const students = db.prepare(`
      SELECT u.id, u.name, u.email, bs.enrolled_at
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

// POST /api/students/batch/:batchId — Add or create student and enroll in batch
router.post('/batch/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can add students to batches' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { name, email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let student = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, 'student');

    if (!student) {
      // Create new student
      if (!name) {
        return res.status(400).json({ error: 'Name is required to create a new student' });
      }

      const plainPassword = password || 'student123';
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);

      const result = db.prepare(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, 'student')
      `).run(name, email, hashedPassword);

      student = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    // Check if already enrolled
    const existingEnrollment = db.prepare(
      'SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?'
    ).get(batch.id, student.id);

    if (existingEnrollment) {
      return res.status(409).json({ error: 'Student is already enrolled in this batch' });
    }

    // Enroll student
    db.prepare(`
      INSERT INTO batch_students (batch_id, student_id)
      VALUES (?, ?)
    `).run(batch.id, student.id);

    const enrolled = db.prepare(`
      SELECT u.id, u.name, u.email, bs.enrolled_at
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      WHERE bs.batch_id = ? AND bs.student_id = ?
    `).get(batch.id, student.id);

    return res.status(201).json({ student: enrolled });
  } catch (err) {
    console.error('Add student error:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Student is already enrolled in this batch' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/students/batch/:batchId/:studentId — Remove student from batch
router.delete('/batch/:batchId/:studentId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can remove students from batches' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const enrollment = db.prepare(
      'SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?'
    ).get(batch.id, req.params.studentId);

    if (!enrollment) {
      return res.status(404).json({ error: 'Student is not enrolled in this batch' });
    }

    db.prepare('DELETE FROM batch_students WHERE batch_id = ? AND student_id = ?').run(batch.id, req.params.studentId);

    return res.json({ message: 'Student removed from batch successfully' });
  } catch (err) {
    console.error('Remove student error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
