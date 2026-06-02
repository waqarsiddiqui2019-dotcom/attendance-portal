const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/batches — Get all batches for the logged-in trainer
router.get('/', (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT b.*, COUNT(bs.student_id) AS student_count
      FROM batches b
      LEFT JOIN batch_students bs ON b.id = bs.batch_id
      WHERE b.trainer_id = ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all(req.user.id);

    return res.json({ batches });
  } catch (err) {
    console.error('Get batches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches — Create a new batch
router.post('/', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can create batches' });
    }

    const { name, description, start_date, end_date } = req.body;

    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }

    const result = db.prepare(`
      INSERT INTO batches (name, description, start_date, end_date, trainer_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description || null, start_date, end_date, req.user.id);

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({ batch });
  } catch (err) {
    console.error('Create batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/batches/:id — Get single batch with students
router.get('/:id', (req, res) => {
  try {
    const batch = db.prepare(`
      SELECT * FROM batches WHERE id = ? AND trainer_id = ?
    `).get(req.params.id, req.user.id);

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

    return res.json({ batch: { ...batch, students } });
  } catch (err) {
    console.error('Get batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/batches/:id — Update batch
router.put('/:id', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can update batches' });
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(req.params.id, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { name, description, start_date, end_date } = req.body;

    const updatedName = name !== undefined ? name : batch.name;
    const updatedDescription = description !== undefined ? description : batch.description;
    const updatedStartDate = start_date !== undefined ? start_date : batch.start_date;
    const updatedEndDate = end_date !== undefined ? end_date : batch.end_date;

    if (!updatedName || !updatedStartDate || !updatedEndDate) {
      return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }

    db.prepare(`
      UPDATE batches
      SET name = ?, description = ?, start_date = ?, end_date = ?
      WHERE id = ?
    `).run(updatedName, updatedDescription, updatedStartDate, updatedEndDate, batch.id);

    const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch.id);
    return res.json({ batch: updated });
  } catch (err) {
    console.error('Update batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/batches/:id — Delete batch
router.delete('/:id', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can delete batches' });
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(req.params.id, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    db.prepare('DELETE FROM batches WHERE id = ?').run(batch.id);

    return res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('Delete batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
