const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcryptjs')
const db      = require('../database')
const { authenticateToken, requireOwner } = require('../middleware/auth')

router.use(authenticateToken)

function canAdmit(req) {
  if (['owner','co_owner'].includes(req.user.role)) return true
  const sp = db.prepare('SELECT can_admit_students FROM staff_permissions WHERE user_id=?').get(req.user.id)
  return sp?.can_admit_students === 1
}

// GET /api/admissions  — list all admitted students with profile
router.get('/', requireOwner, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.name, u.email, u.status, u.created_at,
             sa.phone, sa.batch_id, sa.preferred_mode, sa.city, sa.state,
             sa.heard_about_us, sa.admitted_by, sa.profile_photo,
             b.name AS batch_name,
             t.name AS trainer_name,
             ab.name AS admitted_by_name
      FROM users u
      JOIN student_admissions sa ON sa.user_id = u.id
      LEFT JOIN batches b ON b.id = sa.batch_id
      LEFT JOIN users t ON t.id = b.trainer_id
      LEFT JOIN users ab ON ab.id = sa.admitted_by
      WHERE u.role = 'student'
      ORDER BY sa.created_at DESC
    `).all()
    return res.json({ admissions: rows })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/admissions/:id  — full admission details
router.get('/:id', requireOwner, (req, res) => {
  try {
    const u = db.prepare(`
      SELECT u.id, u.name, u.email, u.status, u.created_at,
             sa.*,
             b.name AS batch_name,
             t.name AS trainer_name
      FROM users u
      JOIN student_admissions sa ON sa.user_id = u.id
      LEFT JOIN batches b ON b.id = sa.batch_id
      LEFT JOIN users t ON t.id = b.trainer_id
      WHERE u.id = ? AND u.role = 'student'
    `).get(req.params.id)
    if (!u) return res.status(404).json({ error: 'Admission not found' })
    return res.json({ admission: u })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/admissions  — create new student admission
router.post('/', requireOwner, (req, res) => {
  try {
    if (!canAdmit(req)) return res.status(403).json({ error: 'Permission denied: can_admit_students required' })

    const {
      // Section A
      name, email, phone, whatsapp, dob, gender, profile_photo,
      // Section B
      city, state, pin_code,
      // Section C
      highest_qualification, field_of_study, college_name, year_of_passing,
      // Section D
      batch_id, preferred_mode, trainer_id, password,
      // Section E
      emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
      // Section F
      heard_about_us, prior_knowledge, special_requirements,
      // Section G (docs)
      id_proof_name, id_proof_data, edu_cert_name, edu_cert_data, other_doc_name, other_doc_data,
    } = req.body

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' })
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.trim().toLowerCase())
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    if (batch_id) {
      const b = db.prepare("SELECT id FROM batches WHERE id=? AND status='active'").get(batch_id)
      if (!b) return res.status(400).json({ error: 'Selected batch not found or inactive' })
    }

    const hashed = bcrypt.hashSync(password, 10)
    const userResult = db.prepare(
      `INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'student','active')`
    ).run(name.trim(), email.trim().toLowerCase(), hashed)
    const uid = userResult.lastInsertRowid

    if (batch_id) {
      db.prepare('INSERT OR IGNORE INTO batch_students (batch_id, student_id) VALUES (?,?)').run(batch_id, uid)
    }

    db.prepare(`
      INSERT INTO student_admissions (
        user_id, batch_id, admitted_by, phone, whatsapp, dob, gender, profile_photo,
        city, state, pin_code, highest_qualification, field_of_study, college_name, year_of_passing,
        preferred_mode, emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
        heard_about_us, prior_knowledge, special_requirements,
        id_proof_name, id_proof_data, edu_cert_name, edu_cert_data, other_doc_name, other_doc_data
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      uid, batch_id || null, req.user.id,
      phone?.trim() || null, whatsapp?.trim() || null, dob || null, gender || null, profile_photo || null,
      city?.trim() || null, state || null, pin_code?.trim() || null,
      highest_qualification || null, field_of_study?.trim() || null, college_name?.trim() || null, year_of_passing || null,
      preferred_mode || 'no_preference',
      emergency_contact_name?.trim() || null, emergency_contact_relation || null, emergency_contact_phone?.trim() || null,
      heard_about_us || null, prior_knowledge || 'none', special_requirements?.trim() || null,
      id_proof_name || null, id_proof_data || null,
      edu_cert_name || null, edu_cert_data || null,
      other_doc_name || null, other_doc_data || null,
    )

    // Send welcome email (fire-and-forget)
    try {
      const { sendEmail, studentWelcomeEmail } = require('../utils/emailService')
      const batchName   = batch_id ? db.prepare('SELECT name FROM batches WHERE id=?').get(batch_id)?.name : null
      const trainerName = trainer_id ? db.prepare('SELECT name FROM users WHERE id=?').get(trainer_id)?.name : null
      const portalLink  = process.env.FRONTEND_URL || 'http://localhost:3000'
      sendEmail(email.trim(), 'Welcome to Define Digital Institute! Your Account is Ready',
        studentWelcomeEmail(name.trim(), email.trim(), password, batchName, trainerName, null, portalLink)
      ).catch(() => {})
    } catch {}

    // Notify trainer
    if (batch_id) {
      try {
        const batchRow = db.prepare('SELECT trainer_id FROM batches WHERE id=?').get(batch_id)
        if (batchRow?.trainer_id) {
          db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,'info')`)
            .run(batchRow.trainer_id, 'New Student Admitted', `${name.trim()} has been enrolled in your batch.`)
        }
      } catch {}
    }

    return res.status(201).json({
      message: 'Student admitted successfully',
      student_id: uid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
    })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
