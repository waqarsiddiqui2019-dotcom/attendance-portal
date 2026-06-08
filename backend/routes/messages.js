const express = require('express')
const db = require('../database')
const { authenticateToken } = require('../middleware/auth')
const notify = require('../utils/notify')

const router = express.Router()
router.use(authenticateToken)

const OWNER_ROLES = ['owner', 'co_owner', 'admin']

// ── GET /api/messages/unread-count ────────────────────────────────────────────
router.get('/unread-count', (req, res) => {
  try {
    const count = db.prepare(
      'SELECT COUNT(*) as c FROM messages WHERE recipient_id=? AND is_read=0'
    ).get(req.user.id).c
    return res.json({ count })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/messages/contacts ────────────────────────────────────────────────
// Returns list of people this user can start a conversation with
router.get('/contacts', (req, res) => {
  try {
    const { role, id } = req.user
    let rows = []

    if (OWNER_ROLES.includes(role)) {
      // Owner/co_owner/admin: can message any active trainer or student
      rows = db.prepare(`
        SELECT id, name, email, role, last_seen FROM users
        WHERE role IN ('trainer','student') AND status='active' AND id != ?
        ORDER BY role ASC, name ASC
      `).all(id)
    } else if (role === 'trainer') {
      // Trainer: can message own students + owner/co_owner/admin
      const students = db.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.role, u.last_seen
        FROM users u
        JOIN batch_students bs ON bs.student_id = u.id
        JOIN batches b ON b.id = bs.batch_id
        WHERE b.trainer_id = ? AND u.status = 'active'
        ORDER BY u.name ASC
      `).all(id)
      const owners = db.prepare(`
        SELECT id, name, email, role, last_seen FROM users
        WHERE role IN ('owner','co_owner','admin') AND status='active'
        ORDER BY name ASC
      `).all()
      rows = [...owners, ...students]
    } else if (role === 'student') {
      // Student: can message own trainers + owner/co_owner/admin
      const trainers = db.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.role, u.last_seen
        FROM users u
        JOIN batches b ON b.trainer_id = u.id
        JOIN batch_students bs ON bs.batch_id = b.id
        WHERE bs.student_id = ? AND u.status = 'active'
        ORDER BY u.name ASC
      `).all(id)
      const owners = db.prepare(`
        SELECT id, name, email, role, last_seen FROM users
        WHERE role IN ('owner','co_owner','admin') AND status='active'
        ORDER BY name ASC
      `).all()
      rows = [...owners, ...trainers]
    }

    // Enrich each contact with last message + unread count + online status
    const ONLINE_MS = 5 * 60 * 1000 // 5 minutes
    const enriched = rows.map(contact => {
      const lastMsg = db.prepare(`
        SELECT body, created_at, sender_id FROM messages
        WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
        ORDER BY created_at DESC LIMIT 1
      `).get(id, contact.id, contact.id, id)

      const unread = db.prepare(
        'SELECT COUNT(*) as c FROM messages WHERE sender_id=? AND recipient_id=? AND is_read=0'
      ).get(contact.id, id).c

      const isOnline = contact.last_seen
        ? (Date.now() - new Date(contact.last_seen.replace(' ', 'T') + 'Z').getTime()) < ONLINE_MS
        : false

      return { ...contact, last_message: lastMsg || null, unread_count: unread, is_online: isOnline }
    })

    // Sort: contacts with messages first (by recency), then alphabetically
    enriched.sort((a, b) => {
      if (a.last_message && b.last_message) {
        return new Date(b.last_message.created_at) - new Date(a.last_message.created_at)
      }
      if (a.last_message) return -1
      if (b.last_message) return 1
      return a.name.localeCompare(b.name)
    })

    return res.json({ contacts: enriched })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/messages/thread/:userId ─────────────────────────────────────────
router.get('/thread/:userId', (req, res) => {
  try {
    const myId = req.user.id
    const otherId = parseInt(req.params.userId)

    const other = db.prepare('SELECT id, name, email, role, last_seen FROM users WHERE id=?').get(otherId)
    if (!other) return res.status(404).json({ error: 'User not found' })
    const ONLINE_MS = 5 * 60 * 1000
    other.is_online = other.last_seen ? (Date.now() - new Date(other.last_seen.replace(' ', 'T') + 'Z').getTime()) < ONLINE_MS : false

    const msgs = db.prepare(`
      SELECT m.*, s.name AS sender_name, s.role AS sender_role
      FROM messages m
      JOIN users s ON s.id = m.sender_id
      WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?)
      ORDER BY m.created_at ASC
    `).all(myId, otherId, otherId, myId)

    // Mark incoming messages as read
    db.prepare(
      'UPDATE messages SET is_read=1 WHERE sender_id=? AND recipient_id=? AND is_read=0'
    ).run(otherId, myId)

    return res.json({ messages: msgs, other_user: other })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/messages ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { recipient_id, body } = req.body
    if (!recipient_id || !body?.trim()) {
      return res.status(400).json({ error: 'recipient_id and body are required' })
    }
    if (body.trim().length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' })
    }

    const recipient = db.prepare('SELECT id, name, role FROM users WHERE id=?').get(recipient_id)
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' })

    const { role, id, name } = req.user

    // Authorization: check sender can message this recipient
    let canMessage = false
    if (OWNER_ROLES.includes(role)) {
      canMessage = true // owner can message anyone
    } else if (role === 'trainer') {
      if (OWNER_ROLES.includes(recipient.role)) {
        canMessage = true
      } else if (recipient.role === 'student') {
        // Check student is in trainer's batch
        const enrollment = db.prepare(`
          SELECT bs.id FROM batch_students bs
          JOIN batches b ON b.id = bs.batch_id
          WHERE b.trainer_id = ? AND bs.student_id = ?
        `).get(id, recipient_id)
        canMessage = !!enrollment
      }
    } else if (role === 'student') {
      if (OWNER_ROLES.includes(recipient.role)) {
        canMessage = true
      } else if (recipient.role === 'trainer') {
        const enrollment = db.prepare(`
          SELECT bs.id FROM batch_students bs
          JOIN batches b ON b.id = bs.batch_id
          WHERE b.trainer_id = ? AND bs.student_id = ?
        `).get(recipient_id, id)
        canMessage = !!enrollment
      }
    }

    if (!canMessage) {
      return res.status(403).json({ error: 'You are not allowed to message this person' })
    }

    const result = db.prepare(
      'INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)'
    ).run(id, recipient_id, body.trim())

    const msg = db.prepare(`
      SELECT m.*, s.name AS sender_name, s.role AS sender_role
      FROM messages m JOIN users s ON s.id = m.sender_id
      WHERE m.id = ?
    `).get(result.lastInsertRowid)

    // Notify recipient
    notify(recipient_id, `New message from ${name}`, body.trim().slice(0, 80), 'info', 'message', result.lastInsertRowid)

    return res.status(201).json({ message: msg })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/messages/read/:userId ────────────────────────────────────────────
router.put('/read/:userId', (req, res) => {
  try {
    db.prepare(
      'UPDATE messages SET is_read=1 WHERE sender_id=? AND recipient_id=? AND is_read=0'
    ).run(req.params.userId, req.user.id)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/messages/all-logs (owner only) ───────────────────────────────────
router.get('/all-logs', (req, res) => {
  try {
    if (!OWNER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Owner access required' })
    }

    const conversations = db.prepare(`
      SELECT
        CASE WHEN sender_id < recipient_id THEN sender_id ELSE recipient_id END AS user1_id,
        CASE WHEN sender_id < recipient_id THEN recipient_id ELSE sender_id END AS user2_id,
        MAX(created_at) AS last_at,
        COUNT(*) AS msg_count
      FROM messages
      GROUP BY user1_id, user2_id
      ORDER BY last_at DESC
    `).all()

    const enriched = conversations.map(conv => {
      const user1 = db.prepare('SELECT id, name, email, role FROM users WHERE id=?').get(conv.user1_id)
      const user2 = db.prepare('SELECT id, name, email, role FROM users WHERE id=?').get(conv.user2_id)
      const lastMsg = db.prepare(`
        SELECT body, created_at, sender_id FROM messages
        WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
        ORDER BY created_at DESC LIMIT 1
      `).get(conv.user1_id, conv.user2_id, conv.user2_id, conv.user1_id)
      return { ...conv, user1, user2, last_message: lastMsg || null }
    })

    return res.json({ conversations: enriched })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/messages/conversation/:user1Id/:user2Id (owner only) ─────────────
router.get('/conversation/:user1Id/:user2Id', (req, res) => {
  try {
    if (!OWNER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Owner access required' })
    }

    const user1Id = parseInt(req.params.user1Id)
    const user2Id = parseInt(req.params.user2Id)

    const user1 = db.prepare('SELECT id, name, email, role FROM users WHERE id=?').get(user1Id)
    const user2 = db.prepare('SELECT id, name, email, role FROM users WHERE id=?').get(user2Id)
    if (!user1 || !user2) return res.status(404).json({ error: 'User not found' })

    const msgs = db.prepare(`
      SELECT m.*, s.name AS sender_name, s.role AS sender_role
      FROM messages m
      JOIN users s ON s.id = m.sender_id
      WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?)
      ORDER BY m.created_at ASC
    `).all(user1Id, user2Id, user2Id, user1Id)

    return res.json({ messages: msgs, user1, user2 })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
