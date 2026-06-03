const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function getBatchForTrainer(batchId, trainerId) {
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, trainerId);
}

// ── Calendar topics (per-date) ─────────────────────────────────────────────

// GET /api/topics/batch/:batchId?month=YYYY-MM
router.get('/batch/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
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

// POST /api/topics/batch/:batchId — upsert calendar topic for a date
router.post('/batch/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { date, title, notes, mode } = req.body;
    if (!date || !title?.trim()) return res.status(400).json({ error: 'date and title are required' });

    db.prepare(`
      INSERT INTO topics (batch_id, date, title, notes, mode)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(batch_id, date) DO UPDATE SET title=excluded.title, notes=excluded.notes, mode=excluded.mode
    `).run(batch.id, date, title.trim(), notes?.trim() || null, mode || null);

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
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    db.prepare('DELETE FROM topics WHERE batch_id = ? AND date = ?').run(batch.id, req.params.date);
    return res.json({ message: 'Topic deleted' });
  } catch (err) {
    console.error('Delete topic error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Syllabus (ordered topic list, not yet on calendar) ─────────────────────

// GET /api/topics/batch/:batchId/syllabus
router.get('/batch/:batchId/syllabus', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const topics = db.prepare(
      'SELECT * FROM syllabus_topics WHERE batch_id = ? ORDER BY order_index ASC'
    ).all(batch.id);
    return res.json({ topics });
  } catch (err) {
    console.error('Get syllabus error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topics/batch/:batchId/syllabus — replace entire syllabus list
router.post('/batch/:batchId/syllabus', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { topics } = req.body;
    if (!Array.isArray(topics)) return res.status(400).json({ error: 'topics array required' });

    const del = db.prepare('DELETE FROM syllabus_topics WHERE batch_id = ?');
    const ins = db.prepare(
      'INSERT INTO syllabus_topics (batch_id, order_index, title, description, mode) VALUES (?, ?, ?, ?, ?)'
    );
    db.transaction(() => {
      del.run(batch.id);
      topics.forEach((t, i) => {
        ins.run(batch.id, i, t.title?.trim() || 'Untitled', t.description?.trim() || null, t.mode || 'offline');
      });
    })();

    const saved = db.prepare(
      'SELECT * FROM syllabus_topics WHERE batch_id = ? ORDER BY order_index ASC'
    ).all(batch.id);
    return res.json({ topics: saved });
  } catch (err) {
    console.error('Save syllabus error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topics/batch/:batchId/distribute — save distributed topics to calendar
router.post('/batch/:batchId/distribute', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { assignments } = req.body; // [{date, title, notes, mode}]
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments array required' });
    }

    const del = db.prepare('DELETE FROM topics WHERE batch_id = ?');
    const ins = db.prepare(
      'INSERT INTO topics (batch_id, date, title, notes, mode) VALUES (?, ?, ?, ?, ?)'
    );
    db.transaction(() => {
      del.run(batch.id);
      for (const a of assignments) {
        ins.run(batch.id, a.date, a.title, a.notes || null, a.mode || null);
      }
    })();

    return res.json({ message: 'Topics distributed to calendar', count: assignments.length });
  } catch (err) {
    console.error('Distribute error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
