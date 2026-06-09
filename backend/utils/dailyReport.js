const cron = require('node-cron')
const db   = require('../database')

const CATEGORY_LABELS = {
  phone_call:      'Phone Call',
  in_person:       'In-Person Meeting',
  online_meeting:  'Online Meeting',
  new_admission:   'New Admission',
  followup:        'Follow-up',
  email_whatsapp:  'Email/WhatsApp',
  fee_collection:  'Fee Collection',
  complaint:       'Complaint/Issue',
  report_review:   'Report/Review',
  technical:       'Technical Task',
  announcement:    'Announcement',
  counselling:     'Student Counselling',
  other:           'Other',
}

async function sendDailyReport(date, manual = false) {
  try {
    const { sendEmail, dailyReportEmail } = require('./emailService')

    // Gather recipients: owner + co-owners + extra recipients from settings
    const ownerRow    = db.prepare("SELECT email FROM users WHERE role='owner' LIMIT 1").get()
    const coOwnerRows = db.prepare("SELECT email FROM users WHERE role='co_owner' AND status='active'").all()
    const settingRow  = db.prepare("SELECT value FROM settings WHERE key='report_recipients'").get()
    const extraEmails = settingRow?.value ? JSON.parse(settingRow.value) : []

    const recipients = [
      ...(ownerRow ? [ownerRow.email] : []),
      ...coOwnerRows.map(r => r.email),
      ...extraEmails,
    ].filter(Boolean)

    if (recipients.length === 0) return

    // 1. Snapshot
    const sessionsToday = db.prepare("SELECT COUNT(DISTINCT batch_id) as n FROM attendance WHERE date=?").get(date)?.n || 0
    const attToday      = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='present' THEN 1 WHEN status='late' THEN 1 ELSE 0 END) as present FROM attendance WHERE date=?").get(date)
    const admissionsToday = db.prepare("SELECT COUNT(*) as n FROM student_admissions WHERE substr(created_at,1,10)=?").get(date)?.n || 0
    const activeBatches   = db.prepare("SELECT COUNT(*) as n FROM batches WHERE status='active'").get()?.n || 0

    // 2. Activities
    const rawActivities = db.prepare(`
      SELECT dl.*, u.name AS logged_by_name, s.name AS student_name
      FROM daily_log dl
      JOIN users u ON u.id=dl.logged_by
      LEFT JOIN users s ON s.id=dl.student_id
      WHERE dl.log_date=?
      ORDER BY dl.log_time ASC
    `).all(date)
    const activities = rawActivities.map(a => ({ ...a, category_label: CATEGORY_LABELS[a.category] || a.category }))

    // 3. Pending follow-ups (due today or overdue)
    const followups = db.prepare(`
      SELECT dl.*, u.name AS logged_by_name, s.name AS student_name
      FROM daily_log dl
      JOIN users u ON u.id=dl.logged_by
      LEFT JOIN users s ON s.id=dl.student_id
      WHERE dl.followup_required=1 AND dl.followup_done=0 AND (dl.followup_date<=? OR dl.followup_date IS NULL)
      ORDER BY dl.followup_date ASC
    `).all(date).map(a => ({ ...a, category_label: CATEGORY_LABELS[a.category] || a.category }))

    // 4. Absent students today
    const absences = db.prepare(`
      SELECT u.name, b.name AS batch_name
      FROM attendance a
      JOIN users u ON u.id=a.student_id
      JOIN batches b ON b.id=a.batch_id
      WHERE a.date=? AND a.status='absent'
    `).all(date)

    // 5. Pending leave requests older than 24 hours
    const pendingLeaves = db.prepare(`
      SELECT lr.id, u.name AS student_name
      FROM leave_requests lr
      JOIN users u ON u.id=lr.student_id
      WHERE lr.status='pending' AND lr.created_at < datetime('now','-24 hours')
    `).all()

    const snapshot = {
      sessions:   sessionsToday,
      present:    attToday?.present || 0,
      total:      attToday?.total   || 0,
      admissions: admissionsToday,
      batches:    activeBatches,
    }

    const subject = `Define Digital — Daily Activity Report — ${date}`
    const html    = dailyReportEmail(date, snapshot, activities, followups, absences, pendingLeaves, [])

    for (const email of recipients) {
      await sendEmail(email, subject, html).catch(() => {})
    }
    console.log(`[DailyReport] Sent to ${recipients.join(', ')} for ${date}${manual ? ' (manual)' : ''}`)
  } catch (err) {
    console.error('[DailyReport] Error:', err.message)
  }
}

// Cron: run every minute, check if current time matches configured report_time
let lastSentDate = ''
cron.schedule('* * * * *', async () => {
  try {
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key='report_enabled'").get()
    if (enabledRow?.value === '0') return

    const timeRow    = db.prepare("SELECT value FROM settings WHERE key='report_time'").get()
    const reportTime = timeRow?.value || '19:00'
    const now        = new Date()
    const hh         = String(now.getHours()).padStart(2, '0')
    const mm         = String(now.getMinutes()).padStart(2, '0')
    const today      = now.toISOString().slice(0, 10)

    if (`${hh}:${mm}` === reportTime && lastSentDate !== today) {
      lastSentDate = today
      await sendDailyReport(today)
    }
  } catch {}
})

console.log('[DailyReport] Cron scheduler started')

module.exports = { sendDailyReport }
