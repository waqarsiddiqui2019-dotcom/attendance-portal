const express = require('express')
const db = require('../database')
const { authenticateToken } = require('../middleware/auth')
const notify = require('../utils/notify')

const router = express.Router()
router.use(authenticateToken)

// ── GET /api/appointments/pending-count ───────────────────────────────────────
router.get('/pending-count', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.json({ count: 0 })
    const { count } = db.prepare(`
      SELECT COUNT(*) AS count FROM appointment_requests ar
      JOIN batches b ON ar.batch_id = b.id
      WHERE b.trainer_id = ? AND ar.status = 'pending'
    `).get(req.user.id)
    return res.json({ count })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/appointments ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    let rows
    if (req.user.role === 'student') {
      rows = db.prepare(`
        SELECT ar.*, b.name AS batch_name, t.name AS trainer_name
        FROM appointment_requests ar
        JOIN batches b ON ar.batch_id = b.id
        JOIN users t ON b.trainer_id = t.id
        WHERE ar.student_id = ?
        ORDER BY ar.created_at DESC
      `).all(req.user.id)
    } else if (req.user.role === 'trainer') {
      rows = db.prepare(`
        SELECT ar.*, u.name AS student_name, u.email AS student_email,
               b.name AS batch_name
        FROM appointment_requests ar
        JOIN users u ON ar.student_id = u.id
        JOIN batches b ON ar.batch_id = b.id
        WHERE b.trainer_id = ?
        ORDER BY
          CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END,
          ar.created_at DESC
      `).all(req.user.id)
    } else {
      rows = db.prepare(`
        SELECT ar.*, u.name AS student_name, b.name AS batch_name, t.name AS trainer_name
        FROM appointment_requests ar
        JOIN users u ON ar.student_id = u.id
        JOIN batches b ON ar.batch_id = b.id
        JOIN users t ON b.trainer_id = t.id
        ORDER BY ar.created_at DESC
      `).all()
    }
    return res.json({ appointments: rows })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/appointments/:id ─────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar) return res.status(404).json({ error: 'Appointment not found' })
    if (req.user.role === 'student' && ar.student_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    if (req.user.role === 'trainer') {
      const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
      if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    }
    const student = db.prepare('SELECT id, name, email FROM users WHERE id=?').get(ar.student_id)
    const batch   = db.prepare('SELECT id, name FROM batches WHERE id=?').get(ar.batch_id)
    return res.json({ appointment: { ...ar, student, batch } })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/appointments — student submits ──────────────────────────────────
router.post('/', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const { batch_id, preferred_date, preferred_time, duration_minutes, topic_question, mode } = req.body

    if (!batch_id || !preferred_date || !preferred_time || !topic_question?.trim()) {
      return res.status(400).json({ error: 'batch_id, preferred_date, preferred_time, topic_question are required' })
    }

    const today = new Date().toISOString().slice(0, 10)
    if (preferred_date < today) return res.status(400).json({ error: 'Cannot request appointment for past dates' })

    const enrolled = db.prepare('SELECT id FROM batch_students WHERE batch_id=? AND student_id=?').get(batch_id, req.user.id)
    if (!enrolled) return res.status(404).json({ error: 'Batch not found or not enrolled' })

    const batch   = db.prepare('SELECT trainer_id, name FROM batches WHERE id=?').get(batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)

    const result = db.prepare(`
      INSERT INTO appointment_requests (student_id, batch_id, preferred_date, preferred_time, duration_minutes, topic_question, mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, batch_id, preferred_date, preferred_time, duration_minutes || 30, topic_question.trim(), mode || 'online')

    const apptId = result.lastInsertRowid

    notify(batch.trainer_id, 'New Appointment Request', `${student.name} has requested an appointment on ${preferred_date} at ${preferred_time} (${duration_minutes || 30} min).`, 'info', 'appointment', apptId)
    notify(req.user.id, 'Appointment Request Submitted', `Your appointment request for ${preferred_date} at ${preferred_time} has been submitted.`, 'info', 'appointment', apptId)

    return res.status(201).json({ appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(apptId) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/appointments/:id/confirm ─────────────────────────────────────────
router.put('/:id/confirm', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' })
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar) return res.status(404).json({ error: 'Appointment not found' })
    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
    if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    if (!['pending','suggested'].includes(ar.status)) return res.status(400).json({ error: `Cannot confirm from status: ${ar.status}` })

    const { trainer_note } = req.body
    db.prepare(`UPDATE appointment_requests SET status='confirmed', trainer_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).run(trainer_note?.trim() || null, ar.id)

    const trainer = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(ar.student_id, 'Appointment Confirmed ✅', `Your appointment on ${ar.preferred_date} at ${ar.preferred_time} has been confirmed by ${trainer.name}.`, 'success', 'appointment', ar.id)

    return res.json({ message: 'Confirmed', appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(ar.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/appointments/:id/decline ─────────────────────────────────────────
router.put('/:id/decline', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' })
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar) return res.status(404).json({ error: 'Appointment not found' })
    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
    if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })

    const { trainer_note } = req.body
    if (!trainer_note?.trim() || trainer_note.trim().length < 10) return res.status(400).json({ error: 'Decline reason required (min 10 characters)' })

    db.prepare(`UPDATE appointment_requests SET status='declined', trainer_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).run(trainer_note.trim(), ar.id)

    notify(ar.student_id, 'Appointment Declined ❌', `Your appointment request for ${ar.preferred_date} was declined. Reason: ${trainer_note.trim()}`, 'error', 'appointment', ar.id)

    return res.json({ message: 'Declined', appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(ar.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/appointments/:id/suggest ────────────────────────────────────────
router.put('/:id/suggest', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' })
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar) return res.status(404).json({ error: 'Appointment not found' })
    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
    if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    if (ar.status !== 'pending') return res.status(400).json({ error: 'Can only suggest from pending status' })

    const { suggested_date, suggested_time, trainer_note } = req.body
    if (!suggested_date || !suggested_time) return res.status(400).json({ error: 'suggested_date and suggested_time required' })

    db.prepare(`UPDATE appointment_requests SET status='suggested', suggested_date=?, suggested_time=?, trainer_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(suggested_date, suggested_time, trainer_note?.trim() || null, ar.id)

    notify(ar.student_id, 'Alternative Time Suggested 🔄', `Trainer suggested ${suggested_date} at ${suggested_time} for your appointment.${trainer_note ? ' Note: ' + trainer_note : ''}`, 'warning', 'appointment', ar.id)

    return res.json({ message: 'Suggestion sent', appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(ar.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/appointments/:id/accept-suggestion ───────────────────────────────
router.put('/:id/accept-suggestion', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar || ar.student_id !== req.user.id) return res.status(404).json({ error: 'Appointment not found' })
    if (ar.status !== 'suggested') return res.status(400).json({ error: 'No suggestion to accept' })

    db.prepare(`UPDATE appointment_requests SET status='suggestion_accepted', preferred_date=?, preferred_time=? WHERE id=?`).run(ar.suggested_date, ar.suggested_time, ar.id)

    const batch   = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(batch.trainer_id, 'Appointment Suggestion Accepted ✅', `${student.name} accepted your suggested time: ${ar.suggested_date} at ${ar.suggested_time}.`, 'success', 'appointment', ar.id)

    return res.json({ message: 'Suggestion accepted', appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(ar.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/appointments/:id/decline-suggestion ──────────────────────────────
router.put('/:id/decline-suggestion', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar || ar.student_id !== req.user.id) return res.status(404).json({ error: 'Appointment not found' })
    if (ar.status !== 'suggested') return res.status(400).json({ error: 'No suggestion to decline' })

    db.prepare(`UPDATE appointment_requests SET status='suggestion_declined' WHERE id=?`).run(ar.id)

    const batch   = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(batch.trainer_id, 'Appointment Suggestion Declined', `${student.name} declined your suggested time.`, 'warning', 'appointment', ar.id)

    return res.json({ message: 'Suggestion declined', appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(ar.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/appointments/:id/cancel ─────────────────────────────────────────
router.put('/:id/cancel', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const ar = db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(req.params.id)
    if (!ar || ar.student_id !== req.user.id) return res.status(404).json({ error: 'Appointment not found' })
    if (ar.status !== 'pending') return res.status(400).json({ error: 'Only pending appointments can be cancelled' })

    db.prepare(`UPDATE appointment_requests SET status='cancelled' WHERE id=?`).run(ar.id)

    const batch   = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(ar.batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(batch.trainer_id, 'Appointment Cancelled', `${student.name} cancelled their appointment request for ${ar.preferred_date}.`, 'info', 'appointment', ar.id)

    return res.json({ message: 'Appointment cancelled', appointment: db.prepare('SELECT * FROM appointment_requests WHERE id=?').get(ar.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
