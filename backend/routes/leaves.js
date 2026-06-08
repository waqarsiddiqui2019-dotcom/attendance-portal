const express = require('express')
const db = require('../database')
const { authenticateToken } = require('../middleware/auth')
const notify = require('../utils/notify')

const router = express.Router()
router.use(authenticateToken)

const WEEK_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MAX_INFORMED = 2
const MAX_UNINFORMED = 3
const MIN_ATTENDANCE_PCT = 80

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClassDatesInRange(fromDate, toDate, classDaysJson) {
  try {
    const classDays = JSON.parse(classDaysJson || '[]')
    const dayNums = classDays.map(d => WEEK_DAYS.indexOf(d)).filter(n => n >= 0)
    if (!dayNums.length) return []
    const dates = []
    let cur = new Date(fromDate + 'T00:00:00')
    const end = new Date(toDate + 'T00:00:00')
    while (cur <= end) {
      if (dayNums.includes(cur.getDay())) dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  } catch { return [] }
}

function getApprovedLeaveDates(studentId, batchId) {
  const approved = db.prepare(`
    SELECT from_date, to_date FROM leave_requests
    WHERE student_id = ? AND batch_id = ? AND status IN ('approved','counter_accepted')
  `).all(studentId, batchId)
  const dates = new Set()
  for (const lr of approved) {
    let cur = new Date(lr.from_date + 'T00:00:00')
    const end = new Date(lr.to_date + 'T00:00:00')
    while (cur <= end) { dates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
  }
  return dates
}

function getLeaveBalance(studentId) {
  const now = new Date()
  const mon = now.toISOString().slice(0, 7)
  const informed = db.prepare(`
    SELECT COUNT(*) AS c FROM leave_requests
    WHERE student_id = ? AND status IN ('approved','counter_accepted')
    AND substr(from_date,1,7) = ?
  `).get(studentId, mon).c
  const uninformed = db.prepare(`
    SELECT COUNT(*) AS c FROM attendance
    WHERE student_id = ? AND status = 'absent'
    AND substr(date,1,7) = ?
  `).get(studentId, mon).c
  return {
    informed_this_month: informed,
    max_informed: MAX_INFORMED,
    uninformed_this_month: uninformed,
    max_uninformed: MAX_UNINFORMED,
    remaining_informed: Math.max(0, MAX_INFORMED - informed),
  }
}

function enrichLeave(lr) {
  const student = db.prepare('SELECT id, name, email FROM users WHERE id=?').get(lr.student_id)
  const batch   = db.prepare(`
    SELECT b.id, b.name, b.class_days, b.start_date, b.end_date, b.trainer_id, u.name AS trainer_name
    FROM batches b JOIN users u ON b.trainer_id = u.id WHERE b.id = ?
  `).get(lr.batch_id)
  return { ...lr, student, batch }
}

// ── GET /api/leaves/pending-count ─────────────────────────────────────────────
router.get('/pending-count', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.json({ count: 0 })
    const { count } = db.prepare(`
      SELECT COUNT(*) AS count FROM leave_requests lr
      JOIN batches b ON lr.batch_id = b.id
      WHERE b.trainer_id = ? AND lr.status = 'pending'
    `).get(req.user.id)
    return res.json({ count })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/leaves/balance ───────────────────────────────────────────────────
router.get('/balance', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const bal = getLeaveBalance(req.user.id)
    // All-time attendance
    const att = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS attended
      FROM attendance WHERE student_id = ?
    `).get(req.user.id)
    const pct = att.total > 0 ? Math.round(att.attended / att.total * 100) : 100
    return res.json({ ...bal, current_attendance_pct: pct, min_attendance_pct: MIN_ATTENDANCE_PCT })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/leaves/impact ────────────────────────────────────────────────────
router.get('/impact', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const { from_date, to_date, batch_id } = req.query
    if (!from_date || !to_date || !batch_id) return res.status(400).json({ error: 'from_date, to_date, batch_id required' })
    if (from_date > to_date) return res.status(400).json({ error: 'from_date must be before to_date' })

    const batch = db.prepare(`
      SELECT b.* FROM batches b
      JOIN batch_students bs ON bs.batch_id = b.id
      WHERE b.id = ? AND bs.student_id = ?
    `).get(batch_id, req.user.id)
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const classDates = getClassDatesInRange(from_date, to_date, batch.class_days)

    // Topics for those dates
    const topics_missed = classDates.map(date => {
      const t = db.prepare('SELECT title, duration_hours, mode FROM topics WHERE batch_id=? AND date=?').get(batch_id, date)
      return { date, title: t?.title || null, duration_hours: t?.duration_hours || 1 }
    })
    const hours_missed = topics_missed.reduce((s, t) => s + (t.duration_hours || 1), 0)

    // Current attendance
    const att = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS attended
      FROM attendance WHERE student_id = ? AND batch_id = ?
    `).get(req.user.id, batch_id)
    const current_pct = att.total > 0 ? Math.round(att.attended / att.total * 100) : 100

    // Worst case (all leave days count as absent)
    const new_total = att.total + classDates.length
    const worst_pct = new_total > 0 ? Math.round(att.attended / new_total * 100) : 100

    return res.json({
      class_days_affected: classDates.length,
      topics_missed,
      hours_missed: parseFloat(hours_missed.toFixed(1)),
      current_attendance_pct: current_pct,
      worst_case_attendance_pct: worst_pct,
      approved_attendance_pct: current_pct,
      at_risk: worst_pct < MIN_ATTENDANCE_PCT,
      min_pct: MIN_ATTENDANCE_PCT,
    })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/leaves ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    let rows
    if (req.user.role === 'student') {
      rows = db.prepare(`
        SELECT lr.*, b.name AS batch_name, t.name AS trainer_name
        FROM leave_requests lr
        JOIN batches b ON lr.batch_id = b.id
        JOIN users t ON b.trainer_id = t.id
        WHERE lr.student_id = ?
        ORDER BY lr.created_at DESC
      `).all(req.user.id)
    } else if (req.user.role === 'trainer') {
      rows = db.prepare(`
        SELECT lr.*, u.name AS student_name, u.email AS student_email,
               b.name AS batch_name
        FROM leave_requests lr
        JOIN users u ON lr.student_id = u.id
        JOIN batches b ON lr.batch_id = b.id
        WHERE b.trainer_id = ?
        ORDER BY
          CASE WHEN lr.leave_type = 'emergency' AND lr.status = 'pending' THEN 0 ELSE 1 END,
          CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END,
          lr.created_at DESC
      `).all(req.user.id)
    } else {
      // owner
      rows = db.prepare(`
        SELECT lr.*, u.name AS student_name, u.email AS student_email,
               b.name AS batch_name, t.name AS trainer_name
        FROM leave_requests lr
        JOIN users u ON lr.student_id = u.id
        JOIN batches b ON lr.batch_id = b.id
        JOIN users t ON b.trainer_id = t.id
        ORDER BY
          CASE WHEN lr.leave_type = 'emergency' AND lr.status = 'pending' THEN 0 ELSE 1 END,
          lr.created_at DESC
      `).all()
    }
    return res.json({ leaves: rows })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/leaves/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr) return res.status(404).json({ error: 'Leave request not found' })

    // Access check
    if (req.user.role === 'student' && lr.student_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    if (req.user.role === 'trainer') {
      const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
      if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    }

    const rich = enrichLeave(lr)

    // Attendance stats for student (trainer view)
    const att = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late
      FROM attendance WHERE student_id = ? AND batch_id = ?
    `).get(lr.student_id, lr.batch_id)
    const pct = att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : 0

    // Leave impact
    const classDates = rich.batch ? getClassDatesInRange(lr.from_date, lr.to_date, rich.batch.class_days) : []
    const topics_missed = classDates.map(date => {
      const t = db.prepare('SELECT title, duration_hours FROM topics WHERE batch_id=? AND date=?').get(lr.batch_id, date)
      return { date, title: t?.title || null, duration_hours: t?.duration_hours || 1 }
    })
    const hours_missed = topics_missed.reduce((s, t) => s + (t.duration_hours || 1), 0)
    const new_total = att.total + classDates.length
    const worst_pct = new_total > 0 ? Math.round((att.present + att.late) / new_total * 100) : 0

    const bal = getLeaveBalance(lr.student_id)

    return res.json({
      leave: rich,
      attendance: { ...att, pct, batch_id: lr.batch_id },
      impact: { class_days: classDates.length, topics_missed, hours_missed: parseFloat(hours_missed.toFixed(1)), worst_pct },
      balance: bal,
    })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/leaves — student submits ───────────────────────────────────────
router.post('/', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const { batch_id, leave_type, leave_type_note, from_date, to_date, reason } = req.body

    if (!batch_id || !leave_type || !from_date || !to_date || !reason?.trim()) {
      return res.status(400).json({ error: 'batch_id, leave_type, from_date, to_date, reason are required' })
    }
    if (reason.trim().length < 20) return res.status(400).json({ error: 'Reason must be at least 20 characters' })

    const today = new Date().toISOString().slice(0, 10)
    if (from_date < today) return res.status(400).json({ error: 'Cannot apply leave for past dates' })
    if (from_date > to_date) return res.status(400).json({ error: 'from_date must be before to_date' })

    const enrolled = db.prepare('SELECT id FROM batch_students WHERE batch_id=? AND student_id=?').get(batch_id, req.user.id)
    if (!enrolled) return res.status(404).json({ error: 'Batch not found or not enrolled' })

    const batch = db.prepare('SELECT trainer_id, name FROM batches WHERE id=?').get(batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)

    const result = db.prepare(`
      INSERT INTO leave_requests (student_id, batch_id, leave_type, leave_type_note, from_date, to_date, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, batch_id, leave_type, leave_type_note?.trim() || null, from_date, to_date, reason.trim())

    const leaveId = result.lastInsertRowid

    // Notify trainer
    const urgency = leave_type === 'emergency' ? 'urgent' : 'info'
    const prefix = leave_type === 'emergency' ? '🚨 EMERGENCY: ' : ''
    notify(
      batch.trainer_id,
      `${prefix}New Leave Request`,
      `${student.name} has submitted a ${leave_type} leave request for ${from_date} to ${to_date}`,
      urgency, 'leave', leaveId
    )

    // Notify student (confirmation)
    notify(req.user.id, 'Leave Request Submitted', `Your ${leave_type} leave request for ${from_date}–${to_date} has been submitted and is pending review.`, 'info', 'leave', leaveId)

    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(leaveId)
    return res.status(201).json({ leave: lr })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/leaves/:id/approve ───────────────────────────────────────────────
router.put('/:id/approve', (req, res) => {
  try {
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr) return res.status(404).json({ error: 'Leave not found' })

    if (req.user.role === 'trainer') {
      const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
      if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied — this is not your batch' })
    } else if (['owner', 'co_owner', 'admin'].includes(req.user.role)) {
      // Owner/co_owner/admin can approve any leave
    } else {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!['pending', 'counter_proposed'].includes(lr.status)) {
      return res.status(400).json({ error: `Cannot approve a request with status: ${lr.status}` })
    }

    const { trainer_note } = req.body
    db.prepare(`UPDATE leave_requests SET status='approved', trainer_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(trainer_note?.trim() || null, lr.id)

    const approver = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(lr.student_id, 'Leave Approved ✅', `Your ${lr.leave_type} leave from ${lr.from_date} to ${lr.to_date} has been approved by ${approver.name}.${trainer_note ? ' Note: ' + trainer_note : ''}`, 'success', 'leave', lr.id)

    return res.json({ message: 'Leave approved', leave: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(lr.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/leaves/:id/reject ────────────────────────────────────────────────
router.put('/:id/reject', (req, res) => {
  try {
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr) return res.status(404).json({ error: 'Leave not found' })

    if (req.user.role === 'trainer') {
      const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
      if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied — this is not your batch' })
    } else if (!['owner', 'co_owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!['pending', 'counter_proposed'].includes(lr.status)) {
      return res.status(400).json({ error: `Cannot reject a request with status: ${lr.status}` })
    }

    const { rejection_reason } = req.body
    if (!rejection_reason?.trim() || rejection_reason.trim().length < 30) {
      return res.status(400).json({ error: 'Rejection reason is required and must be at least 30 characters' })
    }

    db.prepare(`UPDATE leave_requests SET status='rejected', rejection_reason=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(rejection_reason.trim(), lr.id)

    notify(lr.student_id, 'Leave Request Rejected ❌', `Your ${lr.leave_type} leave from ${lr.from_date} to ${lr.to_date} was rejected. Reason: ${rejection_reason.trim()}`, 'error', 'leave', lr.id)

    return res.json({ message: 'Leave rejected', leave: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(lr.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/leaves/:id/counter ───────────────────────────────────────────────
router.put('/:id/counter', (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Trainers only' })
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr) return res.status(404).json({ error: 'Leave not found' })
    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
    if (!batch || batch.trainer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' })
    if (lr.status !== 'pending') return res.status(400).json({ error: 'Can only counter-propose pending requests' })

    const { counter_from_date, counter_to_date, counter_message } = req.body
    if (!counter_from_date || !counter_to_date || !counter_message?.trim()) {
      return res.status(400).json({ error: 'counter_from_date, counter_to_date, and counter_message are required' })
    }

    db.prepare(`
      UPDATE leave_requests
      SET status='counter_proposed', counter_from_date=?, counter_to_date=?, counter_message=?, reviewed_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(counter_from_date, counter_to_date, counter_message.trim(), lr.id)

    notify(lr.student_id, 'Counter Proposal Received 🔄', `Trainer has proposed alternative dates for your ${lr.leave_type} leave: ${counter_from_date} to ${counter_to_date}. Message: ${counter_message.trim()}`, 'warning', 'leave', lr.id)

    return res.json({ message: 'Counter proposal sent', leave: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(lr.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/leaves/:id/accept-counter ───────────────────────────────────────
router.put('/:id/accept-counter', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr || lr.student_id !== req.user.id) return res.status(404).json({ error: 'Leave not found' })
    if (lr.status !== 'counter_proposed') return res.status(400).json({ error: 'No counter proposal to accept' })

    db.prepare(`UPDATE leave_requests SET status='counter_accepted', from_date=?, to_date=? WHERE id=?`)
      .run(lr.counter_from_date, lr.counter_to_date, lr.id)

    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(batch.trainer_id, 'Counter Proposal Accepted ✅', `${student.name} accepted your counter proposal for leave (${lr.counter_from_date} to ${lr.counter_to_date}).`, 'success', 'leave', lr.id)
    notify(req.user.id, 'Counter Proposal Accepted', `You accepted the counter proposal. Your leave is now approved for ${lr.counter_from_date} to ${lr.counter_to_date}.`, 'success', 'leave', lr.id)

    return res.json({ message: 'Counter proposal accepted', leave: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(lr.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/leaves/:id/decline-counter ──────────────────────────────────────
router.put('/:id/decline-counter', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr || lr.student_id !== req.user.id) return res.status(404).json({ error: 'Leave not found' })
    if (lr.status !== 'counter_proposed') return res.status(400).json({ error: 'No counter proposal to decline' })

    db.prepare(`UPDATE leave_requests SET status='counter_declined' WHERE id=?`).run(lr.id)

    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(batch.trainer_id, 'Counter Proposal Declined', `${student.name} declined your counter proposal for leave.`, 'warning', 'leave', lr.id)

    return res.json({ message: 'Counter proposal declined', leave: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(lr.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PUT /api/leaves/:id/cancel ────────────────────────────────────────────────
router.put('/:id/cancel', (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' })
    const lr = db.prepare('SELECT * FROM leave_requests WHERE id=?').get(req.params.id)
    if (!lr || lr.student_id !== req.user.id) return res.status(404).json({ error: 'Leave not found' })
    if (lr.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be cancelled' })

    db.prepare(`UPDATE leave_requests SET status='cancelled' WHERE id=?`).run(lr.id)

    const batch = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(lr.batch_id)
    const student = db.prepare('SELECT name FROM users WHERE id=?').get(req.user.id)
    notify(batch.trainer_id, 'Leave Request Cancelled', `${student.name} cancelled their ${lr.leave_type} leave request for ${lr.from_date} to ${lr.to_date}.`, 'info', 'leave', lr.id)

    return res.json({ message: 'Leave cancelled', leave: db.prepare('SELECT * FROM leave_requests WHERE id=?').get(lr.id) })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
