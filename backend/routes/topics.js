const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function getBatchForTrainer(batchId, trainerId) {
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, trainerId);
}

// GET /api/topics/batch/:batchId?month=YYYY-MM
router.get('/batch/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can view topics' });
    }
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { month } = req.query;
    const topics = (month && /^\d{4}-\d{2}$/.test(month))
      ? db.prepare('SELECT * FROM topics WHERE batch_id = ? AND date LIKE ? ORDER BY date ASC').all(batch.id, `${month}%`)
      : db.prepare('SELECT * FROM topics WHERE batch_id = ? ORDER BY date ASC').all(batch.id);

    return res.json({ topics });
  } catch (err) {
    console.error('Get topics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topics/batch/:batchId — upsert topic for a date
router.post('/batch/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can add topics' });
    }
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { date, title, notes } = req.body;
    if (!date || !title?.trim()) {
      return res.status(400).json({ error: 'date and title are required' });
    }

    db.prepare(`
      INSERT INTO topics (batch_id, date, title, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(batch_id, date) DO UPDATE SET title = excluded.title, notes = excluded.notes
    `).run(batch.id, date, title.trim(), notes?.trim() || null);

    const topic = db.prepare('SELECT * FROM topics WHERE batch_id = ? AND date = ?').get(batch.id, date);
    return res.json({ topic });
  } catch (err) {
    console.error('Save topic error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/topics/batch/:batchId/date/:date
router.delete('/batch/:batchId/date/:date', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can delete topics' });
    }
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    db.prepare('DELETE FROM topics WHERE batch_id = ? AND date = ?').run(batch.id, req.params.date);
    return res.json({ message: 'Topic deleted' });
  } catch (err) {
    console.error('Delete topic error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
