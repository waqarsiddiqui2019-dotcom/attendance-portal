const express = require('express')
const router  = express.Router()
const db      = require('../database')
const { authenticateToken, requireOwner } = require('../middleware/auth')

const DEFAULTS = {
  report_enabled:   '1',
  report_time:      '19:00',
  report_recipients: '[]',
  report_sections:  JSON.stringify(['snapshot','activity','followups','attendance','leaves','tomorrow']),
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  return row ? row.value : (DEFAULTS[key] ?? null)
}

router.use(authenticateToken, requireOwner)

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const map  = {}
    for (const r of rows) map[r.key] = r.value
    return res.json({ settings: { ...DEFAULTS, ...map } })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    if (!['owner','co_owner'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Owner access required' })
    }
    const updates = req.body
    const stmt = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v !== 'undefined') stmt.run(k, String(v))
    }
    return res.json({ message: 'Settings saved' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
module.exports.getSetting = getSetting
