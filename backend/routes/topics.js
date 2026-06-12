const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const OWNER_ROLES = ['owner', 'co_owner', 'admin'];

function getBatchForTrainer(batchId, trainerId) {
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, trainerId);
}

// ── Calendar topics (per-date) ─────────────────────────────────────────────

// GET /api/topics/batch/:batchId?month=YYYY-MM
// Accessible by: trainer (own batch), owner/admin (any batch), student (enrolled batch)
router.get('/batch/:batchId', (req, res) => {
  try {
    const { role, id } = req.user;
    let batch;

    if (role === 'trainer') {
      batch = getBatchForTrainer(req.params.batchId, id);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
    } else if (OWNER_ROLES.includes(role)) {
      batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.batchId);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
    } else if (role === 'student') {
      const enrolled = db.prepare('SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?').get(req.params.batchId, id);
      if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this batch' });
      batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.batchId);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

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

// POST /api/topics/batch/:batchId/distribute
router.post('/batch/:batchId/distribute', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments array required' });
    }

    const del = db.prepare('DELETE FROM topics WHERE batch_id=?');
    const ins = db.prepare(`
      INSERT INTO topics (batch_id, date, title, notes, mode, duration_hours, is_revision, completion_status)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    db.transaction(() => {
      del.run(batch.id);
      for (const a of assignments) {
        ins.run(batch.id, a.date, a.title, a.notes || null, a.mode || null,
                a.duration_hours || null, a.is_revision ? 1 : 0, 'pending');
      }
    })();
    return res.json({ message: 'Distributed', count: assignments.length });
  } catch (err) {
    console.error('Distribute error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/topics/batch/:batchId/date/:date/toggle-complete
router.patch('/batch/:batchId/date/:date/toggle-complete', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' });
    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const topic = db.prepare('SELECT * FROM topics WHERE batch_id=? AND date=?').get(batch.id, req.params.date);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    const newStatus = topic.completion_status === 'covered' ? 'pending' : 'covered';
    db.prepare('UPDATE topics SET completion_status=? WHERE batch_id=? AND date=?')
      .run(newStatus, batch.id, req.params.date);
    return res.json({ date: req.params.date, completion_status: newStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
