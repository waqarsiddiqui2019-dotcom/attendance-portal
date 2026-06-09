const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const TRAINER_ROLES = ['trainer', 'owner', 'co_owner', 'admin'];
const OWNER_ROLES   = ['owner', 'co_owner', 'admin'];

function parseBatch(batch) {
  if (!batch) return batch;
  try {
    batch.class_days = batch.class_days ? JSON.parse(batch.class_days) : [];
  } catch {
    batch.class_days = [];
  }
  return batch;
}

function getBatch(batchId, user) {
  if (OWNER_ROLES.includes(user.role)) {
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  }
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, user.id);
}

// GET /api/batches
router.get('/', (req, res) => {
  try {
    const today      = new Date().toISOString().slice(0, 10);
    const isOwner    = OWNER_ROLES.includes(req.user.role);
    const trainerFilter = isOwner ? '' : 'WHERE b.trainer_id = ?';
    const trainerArg    = isOwner ? [] : [req.user.id];

    const batches = db.prepare(`
      SELECT b.*, COUNT(bs.student_id) AS student_count
      FROM batches b
      LEFT JOIN batch_students bs ON b.id = bs.batch_id
      ${trainerFilter}
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all(...trainerArg);

    const { unique_student_count } = db.prepare(`
      SELECT COUNT(DISTINCT bs.student_id) AS unique_student_count
      FROM batch_students bs
      JOIN batches b ON bs.batch_id = b.id
      ${trainerFilter}
    `).get(...trainerArg);

    const { today_present } = isOwner
      ? db.prepare(`
          SELECT COUNT(DISTINCT a.student_id) AS today_present
          FROM attendance a WHERE a.date = ? AND a.status IN ('present','late')
        `).get(today)
      : db.prepare(`
          SELECT COUNT(DISTINCT a.student_id) AS today_present
          FROM attendance a JOIN batches b ON a.batch_id = b.id
          WHERE b.trainer_id = ? AND a.date = ? AND a.status IN ('present','late')
        `).get(req.user.id, today);

    const { today_total } = isOwner
      ? db.prepare(`
          SELECT COUNT(DISTINCT a.student_id) AS today_total
          FROM attendance a WHERE a.date = ?
        `).get(today)
      : db.prepare(`
          SELECT COUNT(DISTINCT a.student_id) AS today_total
          FROM attendance a JOIN batches b ON a.batch_id = b.id
          WHERE b.trainer_id = ? AND a.date = ?
        `).get(req.user.id, today);

    return res.json({
      batches: batches.map(parseBatch),
      unique_student_count,
      today_present,
      today_total,
    });
  } catch (err) {
    console.error('Get batches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches
router.post('/', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { name, description, start_date, end_date, mode, sessions_per_week, class_days } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }
    const classDaysJson = Array.isArray(class_days) && class_days.length
      ? JSON.stringify(class_days) : null;

    const result = db.prepare(`
      INSERT INTO batches (name, description, start_date, end_date, trainer_id, mode, sessions_per_week, class_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || null, start_date, end_date, req.user.id,
           mode || 'offline', sessions_per_week || null, classDaysJson);

    const batch = parseBatch(db.prepare('SELECT * FROM batches WHERE id = ?').get(result.lastInsertRowid));
    return res.status(201).json({ batch });
  } catch (err) {
    console.error('Create batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/batches/:id
router.get('/:id', (req, res) => {
  try {
    const batch = getBatch(req.params.id, req.user);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.status, bs.enrolled_at
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      WHERE bs.batch_id = ?
      ORDER BY u.name ASC
    `).all(batch.id);

    return res.json({ batch: { ...parseBatch(batch), students } });
  } catch (err) {
    console.error('Get batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/batches/:id/toggle-status
router.patch('/:id/toggle-status', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const batch = getBatch(req.params.id, req.user);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const newStatus = (batch.status || 'active') === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE batches SET status=? WHERE id=?').run(newStatus, batch.id);
    return res.json({ status: newStatus });
  } catch (err) {
    console.error('Toggle batch status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/batches/:id
router.put('/:id', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const batch = getBatch(req.params.id, req.user);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const {
      name, description, start_date, end_date,
      mode, sessions_per_week, class_days
    } = req.body;

    const updName        = name        !== undefined ? name        : batch.name;
    const updDesc        = description !== undefined ? description : batch.description;
    const updStart       = start_date  !== undefined ? start_date  : batch.start_date;
    const updEnd         = end_date    !== undefined ? end_date    : batch.end_date;
    const updMode        = mode        !== undefined ? mode        : (batch.mode || 'offline');
    const updSessions    = sessions_per_week !== undefined ? sessions_per_week : batch.sessions_per_week;
    const updClassDays   = class_days  !== undefined
      ? (Array.isArray(class_days) && class_days.length ? JSON.stringify(class_days) : null)
      : batch.class_days;

    if (!updName || !updStart || !updEnd) {
      return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }

    db.prepare(`
      UPDATE batches SET name=?, description=?, start_date=?, end_date=?,
        mode=?, sessions_per_week=?, class_days=?
      WHERE id=?
    `).run(updName, updDesc, updStart, updEnd, updMode, updSessions || null, updClassDays, batch.id);

    const updated = parseBatch(db.prepare('SELECT * FROM batches WHERE id = ?').get(batch.id));
    return res.json({ batch: updated });
  } catch (err) {
    console.error('Update batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/batches/:id
router.delete('/:id', (req, res) => {
  try {
    if (!TRAINER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const batch = getBatch(req.params.id, req.user);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    db.transaction(() => {
      db.prepare('DELETE FROM attendance           WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM batch_students       WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM topics               WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM syllabus_topics      WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM leave_requests       WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM appointment_requests WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM batches              WHERE id = ?').run(batch.id);
    })();

    return res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('Delete batch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
