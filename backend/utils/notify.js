const db = require('../database')

function notify(userId, title, message, type = 'info', relatedType = null, relatedId = null) {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, title, message, type, relatedType, relatedId)
  } catch (err) {
    console.error('[notify] Error:', err.message)
  }
}

module.exports = notify
