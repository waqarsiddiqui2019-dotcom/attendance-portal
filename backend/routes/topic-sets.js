const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Any authenticated user (trainer or owner) can manage their own topic sets.
// Students cannot access this endpoint — they have no role-match below.
const canManage = (req) => ['trainer', 'owner'].includes(req.user.role);

// GET /api/topic-sets
// Owner: sees ALL sets across all creators, with creator name
// Trainer / Owner: sees own sets (+ all sets if owner)
router.get('/', (req, res) => {
  try {
    if (req.user.role === 'owner') {
      // Show all sets with creator name so owner can tell who made what
      const sets = db.prepare(`
        SELECT ts.*, u.name AS creator_name, COUNT(tsi.id) AS item_count
        FROM topic_sets ts
        JOIN users u ON ts.trainer_id = u.id
        LEFT JOIN topic_set_items tsi ON ts.id = tsi.set_id
        GROUP BY ts.id ORDER BY u.name, ts.created_at DESC
      `).all();
      return res.json({ sets });
    }
    // Trainer: own sets only
    const sets = db.prepare(`
      SELECT ts.*, COUNT(tsi.id) AS item_count
      FROM topic_sets ts
      LEFT JOIN topic_set_items tsi ON ts.id = tsi.set_id
      WHERE ts.trainer_id = ?
      GROUP BY ts.id ORDER BY ts.created_at DESC
    `).all(req.user.id);
    return res.json({ sets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topic-sets — trainer or owner can create their own sets
router.post('/', (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Access denied' });
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Set name required' });
    const result = db.prepare(
      'INSERT INTO topic_sets (trainer_id, name, description) VALUES (?, ?, ?)'
    ).run(req.user.id, name.trim(), description?.trim() || null);
    const set = db.prepare('SELECT * FROM topic_sets WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ set: { ...set, item_count: 0 } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/topic-sets/:id — only the creator can rename their set
router.put('/:id', (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Access denied' });
    const set = db.prepare('SELECT * FROM topic_sets WHERE id = ? AND trainer_id = ?')
      .get(req.params.id, req.user.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    const { name, description } = req.body;
    db.prepare('UPDATE topic_sets SET name=?, description=? WHERE id=?')
      .run(name?.trim() || set.name, description?.trim() || null, set.id);
    return res.json({ set: db.prepare('SELECT * FROM topic_sets WHERE id=?').get(set.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/topic-sets/:id — only the creator can delete their set
router.delete('/:id', (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Access denied' });
    const set = db.prepare('SELECT * FROM topic_sets WHERE id = ? AND trainer_id = ?')
      .get(req.params.id, req.user.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    db.prepare('DELETE FROM topic_sets WHERE id=?').run(set.id);
    return res.json({ message: 'Set deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/topic-sets/:id/items — creator or owner can read items
router.get('/:id/items', (req, res) => {
  try {
    // Owner can read any set; trainer/owner-as-creator reads only their own
    const set = req.user.role === 'owner'
      ? db.prepare('SELECT * FROM topic_sets WHERE id=?').get(req.params.id)
      : db.prepare('SELECT * FROM topic_sets WHERE id=? AND trainer_id=?').get(req.params.id, req.user.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    const items = db.prepare(
      'SELECT * FROM topic_set_items WHERE set_id=? ORDER BY order_index ASC'
    ).all(set.id);
    return res.json({ set, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topic-sets/:id/items — bulk replace; only the creator can modify items
router.post('/:id/items', (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'Access denied' });
    const set = db.prepare('SELECT * FROM topic_sets WHERE id=? AND trainer_id=?')
      .get(req.params.id, req.user.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const del = db.prepare('DELETE FROM topic_set_items WHERE set_id=?');
    const ins = db.prepare(
      'INSERT INTO topic_set_items (set_id, order_index, title, description, duration_hours, mode) VALUES (?,?,?,?,?,?)'
    );
    db.transaction(() => {
      del.run(set.id);
      items.forEach((t, i) =>
        ins.run(set.id, i, t.title?.trim() || 'Untitled', t.description?.trim() || null,
                parseFloat(t.duration_hours) || 1, t.mode || 'offline')
      );
    })();
    const saved = db.prepare('SELECT * FROM topic_set_items WHERE set_id=? ORDER BY order_index ASC').all(set.id);
    return res.json({ items: saved });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
