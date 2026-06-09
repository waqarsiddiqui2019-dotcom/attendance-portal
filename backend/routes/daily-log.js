const express = require('express')
const router  = express.Router()
const db      = require('../database')
const { authenticateToken, requireOwner } = require('../middleware/auth')

router.use(authenticateToken, requireOwner)

function canManageLog(req) {
  if (['owner','co_owner'].includes(req.user.role)) return true
  const sp = db.prepare('SELECT can_manage_daily_log FROM staff_permissions WHERE user_id=?').get(req.user.id)
  return sp?.can_manage_daily_log === 1
}

// GET /api/daily-log?date=YYYY-MM-DD  — entries for a date (own logs for admins)
router.get('/', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10)
    let rows
    if (['owner','co_owner'].includes(req.user.role)) {
      rows = db.prepare(`
        SELECT dl.*, u.name AS logged_by_name, s.name AS student_name
        FROM daily_log dl
        JOIN users u ON u.id = dl.logged_by
        LEFT JOIN users s ON s.id = dl.student_id
        WHERE dl.log_date = ?
        ORDER BY dl.log_time ASC
      `).all(date)
    } else {
      if (!canManageLog(req)) return res.status(403).json({ error: 'Permission denied' })
      rows = db.prepare(`
        SELECT dl.*, u.name AS logged_by_name, s.name AS student_name
        FROM daily_log dl
        JOIN users u ON u.id = dl.logged_by
        LEFT JOIN users s ON s.id = dl.student_id
        WHERE dl.log_date = ? AND dl.logged_by = ?
        ORDER BY dl.log_time ASC
      `).all(date, req.user.id)
    }
    return res.json({ entries: rows, date })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/daily-log/calendar-dots?month=YYYY-MM  — dates with activity
router.get('/calendar-dots', (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    let rows
    if (['owner','co_owner'].includes(req.user.role)) {
      rows = db.prepare(`SELECT log_date, COUNT(*) as count FROM daily_log WHERE substr(log_date,1,7)=? GROUP BY log_date`).all(month)
    } else {
      rows = db.prepare(`SELECT log_date, COUNT(*) as count FROM daily_log WHERE substr(log_date,1,7)=? AND logged_by=? GROUP BY log_date`).all(month, req.user.id)
    }
    return res.json({ dots: rows })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/daily-log/pending-followups
router.get('/pending-followups', (req, res) => {
  try {
    let rows
    if (['owner','co_owner'].includes(req.user.role)) {
      rows = db.prepare(`
        SELECT dl.*, u.name AS logged_by_name, s.name AS student_name
        FROM daily_log dl
        JOIN users u ON u.id = dl.logged_by
        LEFT JOIN users s ON s.id = dl.student_id
        WHERE dl.followup_required=1 AND dl.followup_done=0
        ORDER BY dl.followup_date ASC, dl.log_date ASC
      `).all()
    } else {
      rows = db.prepare(`
        SELECT dl.*, u.name AS logged_by_name, s.name AS student_name
        FROM daily_log dl
        JOIN users u ON u.id = dl.logged_by
        LEFT JOIN users s ON s.id = dl.student_id
        WHERE dl.followup_required=1 AND dl.followup_done=0 AND dl.logged_by=?
        ORDER BY dl.followup_date ASC
      `).all(req.user.id)
    }
    return res.json({ followups: rows })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/daily-log
router.post('/', (req, res) => {
  try {
    if (!canManageLog(req)) return res.status(403).json({ error: 'Permission denied' })
    const { log_date, log_time, category, person_name, student_id, description, outcome, followup_required, followup_date, followup_note, priority } = req.body
    if (!description?.trim() || !category || !log_date || !log_time) {
      return res.status(400).json({ error: 'log_date, log_time, category, and description are required' })
    }
    const result = db.prepare(`
      INSERT INTO daily_log (logged_by, log_date, log_time, category, person_name, student_id, description, outcome, followup_required, followup_date, followup_note, priority)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.user.id, log_date, log_time, category,
      person_name?.trim() || null, student_id || null,
      description.trim(), outcome || 'informational',
      followup_required ? 1 : 0,
      followup_required && followup_date ? followup_date : null,
      followup_required && followup_note ? followup_note.trim() : null,
      priority || 'medium',
    )
    const entry = db.prepare('SELECT * FROM daily_log WHERE id=?').get(result.lastInsertRowid)
    return res.status(201).json({ entry })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/daily-log/:id
router.put('/:id', (req, res) => {
  try {
    if (!canManageLog(req)) return res.status(403).json({ error: 'Permission denied' })
    const entry = db.prepare('SELECT * FROM daily_log WHERE id=?').get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'Entry not found' })
    // Admins can only edit their own entries
    if (!['owner','co_owner'].includes(req.user.role) && entry.logged_by !== req.user.id) {
      return res.status(403).json({ error: 'Cannot edit another user\'s entry' })
    }
    const { log_time, category, person_name, student_id, description, outcome, followup_required, followup_date, followup_note, priority } = req.body
    db.prepare(`
      UPDATE daily_log SET log_time=?, category=?, person_name=?, student_id=?, description=?, outcome=?,
        followup_required=?, followup_date=?, followup_note=?, priority=?
      WHERE id=?
    `).run(
      log_time || entry.log_time, category || entry.category,
      person_name?.trim() || null, student_id || null,
      description?.trim() || entry.description, outcome || entry.outcome,
      followup_required ? 1 : 0,
      followup_required && followup_date ? followup_date : null,
      followup_required && followup_note ? followup_note.trim() : null,
      priority || entry.priority,
      req.params.id
    )
    return res.json({ message: 'Updated', entry: db.prepare('SELECT * FROM daily_log WHERE id=?').get(req.params.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/daily-log/:id/followup-done
router.patch('/:id/followup-done', (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM daily_log WHERE id=?').get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'Entry not found' })
    db.prepare('UPDATE daily_log SET followup_done=1 WHERE id=?').run(req.params.id)
    return res.json({ message: 'Follow-up marked as done' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/daily-log/:id
router.delete('/:id', (req, res) => {
  try {
    if (!canManageLog(req)) return res.status(403).json({ error: 'Permission denied' })
    const entry = db.prepare('SELECT * FROM daily_log WHERE id=?').get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'Entry not found' })
    if (!['owner','co_owner'].includes(req.user.role) && entry.logged_by !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete another user\'s entry' })
    }
    db.prepare('DELETE FROM daily_log WHERE id=?').run(req.params.id)
    return res.json({ message: 'Deleted' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/daily-log/send-report  — manual trigger
router.post('/send-report', (req, res) => {
  try {
    if (!['owner','co_owner'].includes(req.user.role)) return res.status(403).json({ error: 'Owner access required' })
    const { sendDailyReport } = require('../utils/dailyReport')
    const date = req.body.date || new Date().toISOString().slice(0, 10)
    sendDailyReport(date, true).catch(err => console.error('[DailyReport] Manual send failed:', err))
    return res.json({ message: 'Report triggered — will be sent shortly' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
