const express = require('express')
const db = require('../database')
const { authenticateToken } = require('../middleware/auth')

const router = express.Router()
router.use(authenticateToken)

// GET /api/notifications/unread-count
router.get('/unread-count', (req, res) => {
  try {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id)
    return res.json({ count })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id=?
      ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id)
    return res.json({ notifications })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id)
    return res.json({ message: 'All marked as read' })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
    return res.json({ message: 'Marked as read' })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
