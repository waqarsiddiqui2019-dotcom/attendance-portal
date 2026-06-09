const express = require('express');
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireOwner, requireRootOwner } = require('../middleware/auth');
const { sendEmail, passwordResetEmail } = require('../utils/emailService');

const router = express.Router();
router.use(authenticateToken, requireOwner);

// GET /api/owner/stats
router.get('/stats', (req, res) => {
  try {
    const trainers        = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='trainer' AND status='active'").get().c;
    const inactive        = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='trainer' AND status='inactive'").get().c;
    const pending         = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='trainer' AND status='pending'").get().c;
    const students        = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c;
    const batches         = db.prepare("SELECT COUNT(*) as c FROM batches").get().c;
    const activeBatches   = db.prepare("SELECT COUNT(*) as c FROM batches WHERE status='active' OR status IS NULL").get().c;
    const inactiveBatches = db.prepare("SELECT COUNT(*) as c FROM batches WHERE status='inactive'").get().c;
    return res.json({ trainers, inactive, pending, students, batches, activeBatches, inactiveBatches });
  } catch (err) {
    console.error('Owner stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/trainers  — all trainers (all statuses), pending first
router.get('/trainers', (req, res) => {
  try {
    const trainers = db.prepare(`
      SELECT u.id, u.name, u.email, u.status, u.created_at,
             COUNT(b.id) AS batch_count
      FROM users u
      LEFT JOIN batches b ON b.trainer_id = u.id
      WHERE u.role = 'trainer'
      GROUP BY u.id
      ORDER BY
        CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
        u.created_at DESC
    `).all();
    return res.json({ trainers });
  } catch (err) {
    console.error('Owner get trainers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/owner/trainers/:id/approve
router.put('/trainers/:id/approve', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    db.prepare("UPDATE users SET status='active' WHERE id=?").run(req.params.id);
    return res.json({ message: 'Trainer approved successfully' });
  } catch (err) {
    console.error('Approve trainer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/owner/trainers/:id/reject
router.put('/trainers/:id/reject', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    db.prepare("UPDATE users SET status='rejected' WHERE id=?").run(req.params.id);
    return res.json({ message: 'Trainer rejected' });
  } catch (err) {
    console.error('Reject trainer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/owner/trainers/:id/toggle-status — activate or deactivate a trainer
router.patch('/trainers/:id/toggle-status', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id, name, status FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    if (!['active', 'inactive'].includes(trainer.status)) {
      return res.status(400).json({ error: 'Only active or inactive trainers can be toggled' });
    }
    const newStatus = trainer.status === 'active' ? 'inactive' : 'active';
    db.prepare("UPDATE users SET status=? WHERE id=?").run(newStatus, trainer.id);
    return res.json({ status: newStatus, message: `${trainer.name} has been ${newStatus === 'inactive' ? 'deactivated' : 'reactivated'}` });
  } catch (err) {
    console.error('Toggle trainer status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/owner/users/:id/reset-password
router.patch('/users/:id/reset-password', (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const user = db.prepare("SELECT id, name, email FROM users WHERE id=?").get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password=? WHERE id=?").run(hashed, user.id);

    // Email the user their new password
    try {
      if (user.email) {
        const loginLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        sendEmail(user.email, 'Your Password Has Been Reset — Define Digital', passwordResetEmail(user.name, newPassword, loginLink)).catch(() => {});
      }
    } catch (e) { console.error('[Email] password reset email error (non-fatal):', e.message); }

    return res.json({ message: `Password reset for ${user.name}` });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/owner/trainers/:id — cascades batches, enrollments, attendance, topics, sets
router.delete('/trainers/:id', (req, res) => {
  try {
    const trainer = db.prepare("SELECT id, name FROM users WHERE id=? AND role='trainer'").get(req.params.id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    const batches = db.prepare('SELECT id FROM batches WHERE trainer_id=?').all(req.params.id);
    const batchIds = batches.map(b => b.id);

    const deleteAll = db.transaction(() => {
      if (batchIds.length > 0) {
        const ph = batchIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM attendance          WHERE batch_id IN (${ph})`).run(...batchIds);
        db.prepare(`DELETE FROM batch_students      WHERE batch_id IN (${ph})`).run(...batchIds);
        db.prepare(`DELETE FROM topics              WHERE batch_id IN (${ph})`).run(...batchIds);
        db.prepare(`DELETE FROM syllabus_topics     WHERE batch_id IN (${ph})`).run(...batchIds);
        db.prepare(`DELETE FROM leave_requests      WHERE batch_id IN (${ph})`).run(...batchIds);
        db.prepare(`DELETE FROM appointment_requests WHERE batch_id IN (${ph})`).run(...batchIds);
        db.prepare(`DELETE FROM batches             WHERE trainer_id=?`).run(req.params.id);
      }
      const sets = db.prepare('SELECT id FROM topic_sets WHERE trainer_id=?').all(req.params.id);
      if (sets.length > 0) {
        const sPh = sets.map(() => '?').join(',');
        const sIds = sets.map(s => s.id);
        db.prepare(`DELETE FROM topic_set_items WHERE set_id IN (${sPh})`).run(...sIds);
        db.prepare(`DELETE FROM topic_sets      WHERE trainer_id=?`).run(req.params.id);
      }
      db.prepare('DELETE FROM notifications WHERE user_id=?').run(req.params.id);
      db.prepare('DELETE FROM messages WHERE sender_id=? OR recipient_id=?').run(req.params.id, req.params.id);
      db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    });

    deleteAll();
    return res.json({ message: 'Trainer and all associated data removed', batchCount: batchIds.length });
  } catch (err) {
    console.error('Delete trainer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/batches — all batches across all trainers
router.get('/batches', (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT b.*, u.name AS trainer_name,
             COUNT(bs.student_id) AS student_count
      FROM batches b
      JOIN users u ON b.trainer_id = u.id
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all();
    return res.json({ batches });
  } catch (err) {
    console.error('Owner get batches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/students — all students with their batch(es)
router.get('/students', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.name, u.email, u.created_at,
             b.id AS batch_id, b.name AS batch_name,
             trainer.name AS trainer_name
      FROM users u
      LEFT JOIN batch_students bs ON bs.student_id = u.id
      LEFT JOIN batches b ON b.id = bs.batch_id
      LEFT JOIN users trainer ON trainer.id = b.trainer_id
      WHERE u.role = 'student'
      ORDER BY u.name ASC
    `).all();
    // Collapse multiple batches per student
    const map = {};
    for (const r of rows) {
      if (!map[r.id]) map[r.id] = { id: r.id, name: r.name, email: r.email, created_at: r.created_at, batches: [] };
      if (r.batch_id) map[r.id].batches.push({ id: r.batch_id, name: r.batch_name, trainer_name: r.trainer_name });
    }
    return res.json({ students: Object.values(map) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Holidays ──────────────────────────────────────────────────────────────────

// GET /api/owner/holidays
router.get('/holidays', (req, res) => {
  try {
    const holidays = db.prepare('SELECT * FROM holidays ORDER BY date ASC').all();
    return res.json({ holidays });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/owner/holidays
router.post('/holidays', (req, res) => {
  try {
    const { date, name, applies_to = 'all', batch_ids } = req.body;
    if (!date || !name?.trim()) return res.status(400).json({ error: 'date and name are required' });
    const result = db.prepare(
      'INSERT INTO holidays (date, name, applies_to, batch_ids) VALUES (?, ?, ?, ?)'
    ).run(date, name.trim(), applies_to, batch_ids ? JSON.stringify(batch_ids) : null);
    const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ holiday });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/owner/holidays/:id
router.delete('/holidays/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Holiday deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Student Calendar ──────────────────────────────────────────────────────────

// GET /api/owner/student/:id/calendar?month=YYYY-MM
router.get('/student/:id/calendar', (req, res) => {
  try {
    const { id } = req.params;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const prefix = month + '-%';

    const student = db.prepare("SELECT id, name, email FROM users WHERE id=? AND role='student'").get(id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Student's batches
    const batches = db.prepare(`
      SELECT b.id, b.name AS batch_name, b.start_date, b.end_date,
             u.name AS trainer_name
      FROM batch_students bs
      JOIN batches b ON b.id = bs.batch_id
      JOIN users u ON u.id = b.trainer_id
      WHERE bs.student_id = ?
      ORDER BY b.created_at ASC
    `).all(id);

    // Attendance for the month
    const attRows = db.prepare(`
      SELECT a.date, a.status, a.batch_id
      FROM attendance a
      WHERE a.student_id = ? AND a.date LIKE ?
      ORDER BY a.date ASC
    `).all(id, prefix);

    // Build attendance map {date: {status, batch_id}}
    const attendance = {};
    for (const r of attRows) attendance[r.date] = { status: r.status, batch_id: r.batch_id };

    // Topics for all student batches this month
    const batchIds = batches.map(b => b.id);
    const topicRows = batchIds.length ? db.prepare(`
      SELECT t.date, t.title, t.notes, t.mode, t.completion_status, t.is_revision, t.batch_id
      FROM topics t
      WHERE t.batch_id IN (${batchIds.map(() => '?').join(',')}) AND t.date LIKE ?
    `).all(...batchIds, prefix) : [];

    const topics = {};
    for (const t of topicRows) topics[t.date] = t;

    // Holidays this month (+ parse batch_ids)
    const rawHolidays = db.prepare("SELECT * FROM holidays WHERE date LIKE ? ORDER BY date ASC").all(prefix);
    const holidays = rawHolidays.filter(h => {
      if (h.applies_to === 'all') return true;
      try { const ids = JSON.parse(h.batch_ids || '[]'); return ids.some(bid => batchIds.includes(bid)); }
      catch { return false; }
    });

    // All-time attendance stats
    const allTime = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late
      FROM attendance WHERE student_id = ?
    `).get(id);

    // Topics covered (all time) — dates where student was present or late
    const presentDates = db.prepare(`
      SELECT a.date, a.batch_id FROM attendance a
      WHERE a.student_id = ? AND a.status IN ('present','late')
      ORDER BY a.date DESC
    `).all(id);

    const topicsAttended = [];
    for (const pd of presentDates) {
      const t = db.prepare('SELECT * FROM topics WHERE batch_id=? AND date=?').get(pd.batch_id, pd.date);
      const b = batches.find(b => b.id === pd.batch_id);
      if (t) topicsAttended.push({ date: pd.date, title: t.title, mode: t.mode, status: t.completion_status, trainer_name: b?.trainer_name });
    }

    // Month-by-month summary
    const monthRows = db.prepare(`
      SELECT substr(date,1,7) AS mon,
        COUNT(*) AS total,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late
      FROM attendance WHERE student_id = ?
      GROUP BY mon ORDER BY mon DESC
      LIMIT 12
    `).all(id);

    return res.json({
      student,
      batches,
      stats: { ...allTime, topics_covered: topicsAttended.filter(t => t.status === 'covered').length },
      attendance,
      topics,
      holidays,
      monthly_summary: monthRows,
      topics_attended: topicsAttended.slice(0, 100),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Trainer Calendar ──────────────────────────────────────────────────────────

// GET /api/owner/trainer/:id/calendar?month=YYYY-MM
router.get('/trainer/:id/calendar', (req, res) => {
  try {
    const { id } = req.params;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const prefix = month + '-%';

    const trainer = db.prepare("SELECT id, name, email FROM users WHERE id=? AND role='trainer'").get(id);
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

    // Trainer's batches
    const batches = db.prepare(`
      SELECT b.id, b.name, b.start_date, b.end_date, b.mode,
             COUNT(bs.student_id) AS student_count
      FROM batches b
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      WHERE b.trainer_id = ?
      GROUP BY b.id ORDER BY b.created_at ASC
    `).all(id);
    const batchIds = batches.map(b => b.id);

    // Sessions this month: dates where attendance was recorded for this trainer's batches
    let sessions = {};
    if (batchIds.length) {
      const sessionRows = db.prepare(`
        SELECT a.date, a.batch_id,
          COUNT(*) AS total,
          SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN a.status='late'    THEN 1 ELSE 0 END) AS late
        FROM attendance a
        WHERE a.batch_id IN (${batchIds.map(() => '?').join(',')}) AND a.date LIKE ?
        GROUP BY a.date, a.batch_id ORDER BY a.date ASC
      `).all(...batchIds, prefix);

      for (const r of sessionRows) {
        const topic = db.prepare('SELECT title, mode FROM topics WHERE batch_id=? AND date=?').get(r.batch_id, r.date);
        const batch = batches.find(b => b.id === r.batch_id);
        const pct = r.total ? Math.round((r.present + r.late) / r.total * 100) : 0;
        if (!sessions[r.date]) sessions[r.date] = [];
        sessions[r.date].push({
          batch_id: r.batch_id, batch_name: batch?.name,
          present: r.present, absent: r.absent, late: r.late, total: r.total, pct,
          topic: topic || null,
        });
      }
    }

    // Holidays this month
    const rawHolidays = db.prepare("SELECT * FROM holidays WHERE date LIKE ? ORDER BY date ASC").all(prefix);
    const holidays = rawHolidays.filter(h => {
      if (h.applies_to === 'all') return true;
      try { const ids = JSON.parse(h.batch_ids || '[]'); return ids.some(bid => batchIds.includes(bid)); }
      catch { return false; }
    });

    // All-time stats
    let allTime = { total_sessions: 0, total_topics: 0, avg_pct: 0, last_active: null };
    if (batchIds.length) {
      const atRows = db.prepare(`
        SELECT COUNT(DISTINCT (batch_id || '|' || date)) AS sessions,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS total_present,
               COUNT(*) AS total_records,
               MAX(date) AS last_active
        FROM attendance
        WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
      `).get(...batchIds);
      const topicCount = db.prepare(`SELECT COUNT(*) AS c FROM topics WHERE batch_id IN (${batchIds.map(() => '?').join(',')})`).get(...batchIds);
      allTime = {
        total_sessions: atRows.sessions || 0,
        total_topics: topicCount.c || 0,
        avg_pct: atRows.total_records ? Math.round(atRows.total_present / atRows.total_records * 100) : 0,
        last_active: atRows.last_active,
      };
    }

    // Month-by-month summary
    let monthly = [];
    if (batchIds.length) {
      monthly = db.prepare(`
        SELECT substr(date,1,7) AS mon,
          COUNT(DISTINCT (batch_id || '|' || date)) AS sessions,
          SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
          COUNT(*) AS total
        FROM attendance
        WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
        GROUP BY mon ORDER BY mon DESC LIMIT 12
      `).all(...batchIds);
    }

    // Topic coverage (all time)
    const topicCoverage = batchIds.length ? db.prepare(`
      SELECT t.date, t.title, t.mode, t.completion_status, t.batch_id,
             b.name AS batch_name,
             COUNT(CASE WHEN a.status IN ('present','late') THEN 1 END) AS present_count,
             COUNT(a.id) AS total_count
      FROM topics t
      JOIN batches b ON b.id = t.batch_id
      LEFT JOIN attendance a ON a.batch_id = t.batch_id AND a.date = t.date
      WHERE t.batch_id IN (${batchIds.map(() => '?').join(',')})
      GROUP BY t.id ORDER BY t.date DESC LIMIT 50
    `).all(...batchIds) : [];

    // Batch performance
    const batchPerf = batches.map(b => {
      const perf = db.prepare(`
        SELECT COUNT(DISTINCT date) AS sessions,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
               COUNT(*) AS total
        FROM attendance WHERE batch_id = ?
      `).get(b.id);
      const topics = db.prepare('SELECT COUNT(*) AS c FROM topics WHERE batch_id = ?').get(b.id);
      const pct = perf.total ? Math.round(perf.present / perf.total * 100) : 0;
      return {
        batch_id: b.id, batch_name: b.name, student_count: b.student_count,
        sessions: perf.sessions, topics_covered: topics.c,
        avg_pct: pct,
        health: pct >= 85 ? 'good' : pct >= 70 ? 'ok' : 'low',
      };
    });

    return res.json({
      trainer, batches, stats: allTime,
      sessions, holidays,
      monthly_summary: monthly,
      topic_coverage: topicCoverage,
      batch_performance: batchPerf,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Leave Overview (owner only) ───────────────────────────────────────────────

// GET /api/owner/leave-stats
router.get('/leave-stats', (req, res) => {
  try {
    const mon = new Date().toISOString().slice(0, 7)
    const pending   = db.prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE status='pending'").get().c
    const approved  = db.prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE status IN ('approved','counter_accepted') AND substr(reviewed_at,1,7)=?").get(mon).c
    const rejected  = db.prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE status='rejected' AND substr(reviewed_at,1,7)=?").get(mon).c
    const emergency = db.prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE leave_type='emergency' AND status='pending'").get().c
    // Unresponded emergencies older than 24h
    const urgentRows = db.prepare(`
      SELECT lr.*, u.name AS student_name, b.name AS batch_name
      FROM leave_requests lr JOIN users u ON lr.student_id=u.id JOIN batches b ON lr.batch_id=b.id
      WHERE lr.leave_type='emergency' AND lr.status='pending'
      AND (julianday('now') - julianday(lr.created_at)) * 24 >= 24
    `).all()
    return res.json({ pending, approved_this_month: approved, rejected_this_month: rejected, emergency_pending: emergency, urgent_unresponded: urgentRows })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/owner/leaves
router.get('/leaves', (req, res) => {
  try {
    const { status, leave_type, trainer_id, batch_id } = req.query
    let sql = `
      SELECT lr.*, u.name AS student_name, u.email AS student_email,
             b.name AS batch_name, t.name AS trainer_name, t.id AS tid
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      JOIN batches b ON lr.batch_id = b.id
      JOIN users t ON b.trainer_id = t.id
      WHERE 1=1
    `
    const params = []
    if (status)     { sql += ' AND lr.status = ?';       params.push(status) }
    if (leave_type) { sql += ' AND lr.leave_type = ?';   params.push(leave_type) }
    if (trainer_id) { sql += ' AND b.trainer_id = ?';    params.push(trainer_id) }
    if (batch_id)   { sql += ' AND lr.batch_id = ?';     params.push(batch_id) }
    sql += ` ORDER BY
      CASE WHEN lr.leave_type='emergency' AND lr.status='pending' THEN 0 ELSE 1 END,
      lr.created_at DESC`
    const leaves = db.prepare(sql).all(...params)
    return res.json({ leaves })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Staff Management (root owner only) ───────────────────────────────────────

// GET /api/owner/staff
router.get('/staff', requireRootOwner, (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
             sp.can_manage_trainers, sp.can_manage_students, sp.can_manage_batches,
             sp.can_view_reports, sp.can_approve_leaves, sp.can_message_all
      FROM users u
      LEFT JOIN staff_permissions sp ON sp.user_id = u.id
      WHERE u.role IN ('co_owner','admin')
      ORDER BY u.role ASC, u.created_at DESC
    `).all()
    return res.json({ staff })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/owner/staff  — create co-owner or admin
router.post('/staff', requireRootOwner, (req, res) => {
  try {
    const { name, email, password, role, permissions = {} } = req.body
    if (!name?.trim() || !email?.trim() || !password || !['co_owner','admin'].includes(role)) {
      return res.status(400).json({ error: 'name, email, password, and role (co_owner|admin) are required' })
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.trim())
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const hashed = bcrypt.hashSync(password, 10)
    const result = db.prepare(
      `INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,?,'active')`
    ).run(name.trim(), email.trim(), hashed, role)

    const uid = result.lastInsertRowid
    db.prepare(`
      INSERT INTO staff_permissions (user_id, can_manage_trainers, can_manage_students, can_manage_batches, can_view_reports, can_approve_leaves, can_message_all)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      uid,
      permissions.can_manage_trainers   ? 1 : 0,
      permissions.can_manage_students   ? 1 : 0,
      permissions.can_manage_batches    ? 1 : 0,
      permissions.can_view_reports      !== false ? 1 : 0,
      permissions.can_approve_leaves    ? 1 : 0,
      permissions.can_message_all       !== false ? 1 : 0,
    )

    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id=?').get(uid)
    const perms = db.prepare('SELECT * FROM staff_permissions WHERE user_id=?').get(uid)
    return res.status(201).json({ user, permissions: perms })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/owner/staff/:id/permissions
router.put('/staff/:id/permissions', requireRootOwner, (req, res) => {
  try {
    const { id } = req.params
    const u = db.prepare("SELECT id FROM users WHERE id=? AND role IN ('co_owner','admin')").get(id)
    if (!u) return res.status(404).json({ error: 'Staff member not found' })

    const { can_manage_trainers, can_manage_students, can_manage_batches, can_view_reports, can_approve_leaves, can_message_all } = req.body
    db.prepare(`
      INSERT INTO staff_permissions (user_id, can_manage_trainers, can_manage_students, can_manage_batches, can_view_reports, can_approve_leaves, can_message_all)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
        can_manage_trainers=excluded.can_manage_trainers,
        can_manage_students=excluded.can_manage_students,
        can_manage_batches=excluded.can_manage_batches,
        can_view_reports=excluded.can_view_reports,
        can_approve_leaves=excluded.can_approve_leaves,
        can_message_all=excluded.can_message_all
    `).run(id,
      can_manage_trainers ? 1 : 0, can_manage_students ? 1 : 0,
      can_manage_batches  ? 1 : 0, can_view_reports    ? 1 : 0,
      can_approve_leaves  ? 1 : 0, can_message_all     ? 1 : 0,
    )
    return res.json({ message: 'Permissions updated' })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/owner/staff/:id
router.delete('/staff/:id', requireRootOwner, (req, res) => {
  try {
    const u = db.prepare("SELECT id FROM users WHERE id=? AND role IN ('co_owner','admin')").get(req.params.id)
    if (!u) return res.status(404).json({ error: 'Staff member not found' })
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id)
    return res.json({ message: 'Staff member removed' })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Trainer Stats (per-trainer leave/request overview) ────────────────────────

// GET /api/owner/trainer-stats
router.get('/trainer-stats', (req, res) => {
  try {
    const mon = new Date().toISOString().slice(0, 7)
    const trainers = db.prepare(`
      SELECT u.id, u.name, u.email, u.status,
             COUNT(DISTINCT b.id) AS batch_count,
             COUNT(DISTINCT bs.student_id) AS student_count
      FROM users u
      LEFT JOIN batches b ON b.trainer_id = u.id
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      WHERE u.role = 'trainer' AND u.status IN ('active','inactive')
      GROUP BY u.id ORDER BY u.status ASC, u.name ASC
    `).all()

    const enriched = trainers.map(t => {
      const batchIds = db.prepare('SELECT id FROM batches WHERE trainer_id=?').all(t.id).map(r => r.id)
      if (!batchIds.length) return { ...t, pending_leaves: 0, approved_leaves_month: 0, rejected_leaves_month: 0, pending_appts: 0 }

      const ph = batchIds.map(() => '?').join(',')
      const pending_leaves = db.prepare(`SELECT COUNT(*) AS c FROM leave_requests WHERE batch_id IN (${ph}) AND status='pending'`).get(...batchIds).c
      const approved_leaves_month = db.prepare(`SELECT COUNT(*) AS c FROM leave_requests WHERE batch_id IN (${ph}) AND status IN ('approved','counter_accepted') AND substr(reviewed_at,1,7)=?`).get(...batchIds, mon).c
      const rejected_leaves_month = db.prepare(`SELECT COUNT(*) AS c FROM leave_requests WHERE batch_id IN (${ph}) AND status='rejected' AND substr(reviewed_at,1,7)=?`).get(...batchIds, mon).c
      const pending_appts = db.prepare(`SELECT COUNT(*) AS c FROM appointment_requests WHERE batch_id IN (${ph}) AND status='pending'`).get(...batchIds).c

      return { ...t, pending_leaves, approved_leaves_month, rejected_leaves_month, pending_appts }
    })

    return res.json({ trainers: enriched })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Leave Alerts ──────────────────────────────────────────────────────────────

// GET /api/owner/leave-alerts  — 48h overdue + recently rejected (with reasons)
router.get('/leave-alerts', (req, res) => {
  try {
    // Leaves pending for 48+ hours
    const overdue = db.prepare(`
      SELECT lr.id, lr.leave_type, lr.from_date, lr.to_date, lr.created_at, lr.status,
             ROUND((julianday('now') - julianday(lr.created_at)) * 24, 1) AS hours_pending,
             u.name AS student_name, u.email AS student_email,
             b.name AS batch_name, t.name AS trainer_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      JOIN batches b ON lr.batch_id = b.id
      JOIN users t ON b.trainer_id = t.id
      WHERE lr.status = 'pending'
        AND (julianday('now') - julianday(lr.created_at)) * 24 >= 48
      ORDER BY lr.created_at ASC
    `).all()

    // Leaves rejected by trainer in the last 30 days — owner visibility log
    const rejected = db.prepare(`
      SELECT lr.id, lr.leave_type, lr.from_date, lr.to_date, lr.rejection_reason,
             lr.reviewed_at, lr.created_at, lr.reason AS student_reason,
             u.name AS student_name, u.email AS student_email,
             b.name AS batch_name, t.name AS trainer_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      JOIN batches b ON lr.batch_id = b.id
      JOIN users t ON b.trainer_id = t.id
      WHERE lr.status = 'rejected'
        AND lr.reviewed_at >= datetime('now', '-30 days')
      ORDER BY lr.reviewed_at DESC
      LIMIT 50
    `).all()

    return res.json({ overdue_48h: overdue, recently_rejected: rejected })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Student Management (enriched list) ───────────────────────────────────────

// GET /api/owner/students-management
router.get('/students-management', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        u.id, u.name, u.email, u.created_at,
        b.id   AS batch_id,   b.name AS batch_name,
        t.id   AS trainer_id, t.name AS trainer_name,
        bs.enrolled_at,
        COALESCE(att.total_days, 0) AS total_days,
        COALESCE(att.present,    0) AS present,
        COALESCE(att.absent,     0) AS absent,
        COALESCE(att.late,       0) AS late,
        CASE WHEN COALESCE(att.total_days, 0) > 0
          THEN CAST(ROUND((COALESCE(att.present,0) + COALESCE(att.late,0)) * 100.0 / att.total_days) AS INTEGER)
          ELSE 100 END AS attendance_pct,
        att.last_active,
        COALESCE(lv.informed_this_month, 0) AS informed_leaves_this_month
      FROM users u
      JOIN batch_students bs ON bs.student_id = u.id
      JOIN batches b          ON b.id = bs.batch_id
      JOIN users t            ON t.id = b.trainer_id
      LEFT JOIN (
        SELECT student_id, batch_id,
          COUNT(*) AS total_days,
          SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late,
          MAX(date) AS last_active
        FROM attendance GROUP BY student_id, batch_id
      ) att ON att.student_id = u.id AND att.batch_id = b.id
      LEFT JOIN (
        SELECT student_id, batch_id, COUNT(*) AS informed_this_month
        FROM leave_requests
        WHERE status IN ('approved','counter_accepted')
          AND substr(from_date,1,7) = strftime('%Y-%m','now')
        GROUP BY student_id, batch_id
      ) lv ON lv.student_id = u.id AND lv.batch_id = b.id
      WHERE u.role = 'student'
      ORDER BY u.name ASC
    `).all();
    return res.json({ students: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/student/:id/leaves-history
router.get('/student/:id/leaves-history', (req, res) => {
  try {
    const leaves = db.prepare(`
      SELECT lr.*,
             b.name AS batch_name,
             t.name AS trainer_name
      FROM leave_requests lr
      JOIN batches b ON b.id = lr.batch_id
      JOIN users  t ON t.id = b.trainer_id
      WHERE lr.student_id = ?
      ORDER BY lr.created_at DESC
    `).all(req.params.id);
    return res.json({ leaves });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/owner/student/:id/attendance-summary
router.get('/student/:id/attendance-summary', (req, res) => {
  try {
    const monthly = db.prepare(`
      SELECT substr(date,1,7) AS month,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late,
        COUNT(*) AS total
      FROM attendance WHERE student_id = ?
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all(req.params.id);

    const allTime = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS attended
      FROM attendance WHERE student_id = ?
    `).get(req.params.id);

    const pct = allTime.total > 0 ? Math.round(allTime.attended / allTime.total * 100) : 100;

    return res.json({ monthly, all_time: { ...allTime, pct } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
