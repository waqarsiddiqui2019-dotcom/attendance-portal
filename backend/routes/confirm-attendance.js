const express = require('express')
const db = require('../database')

const router = express.Router()

function page(title, color, icon, heading, subtext) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} — Define Digital</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #1B3A6B; border-radius: 12px; padding: 18px 24px; margin-bottom: 32px; display: flex; align-items: center; gap: 10px; }
    .logo-dd span.orange { color: #F97316; font-weight: bold; font-size: 20px; }
    .logo-dd span.white { color: #fff; font-weight: bold; font-size: 20px; }
    .logo-tag { color: #93c5fd; font-size: 11px; margin-top: 2px; }
    .icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; background: ${color}15; color: ${color}; }
    h1 { font-size: 22px; color: #1e293b; margin-bottom: 10px; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="logo-dd"><span class="orange">Define</span><span class="white"> Digital</span></div>
        <div class="logo-tag">BECOME A DIGITAL LEADER</div>
      </div>
    </div>
    <div class="icon">${icon}</div>
    <h1>${heading}</h1>
    <p>${subtext}</p>
    <div class="footer">Define Digital Institute · Attendance Portal</div>
  </div>
</body>
</html>`
}

// GET /api/confirm-attendance/:token — public, no auth
router.get('/:token', (req, res) => {
  try {
    const { token } = req.params
    if (!token || token.length < 10) {
      return res.status(400).send(page(
        'Invalid Link', '#dc2626', '❌',
        'Invalid Link',
        'This confirmation link is invalid. Please contact your trainer if you have any questions.'
      ))
    }

    const record = db.prepare(`
      SELECT a.*, u.name AS student_name, b.name AS batch_name,
             t.title AS topic_title
      FROM attendance a
      JOIN users u ON u.id = a.student_id
      JOIN batches b ON b.id = a.batch_id
      LEFT JOIN topics t ON t.batch_id = a.batch_id AND t.date = a.date
      WHERE a.confirm_token = ?
    `).get(token)

    if (!record) {
      return res.status(404).send(page(
        'Link Not Found', '#dc2626', '🔍',
        'Link Not Found or Expired',
        'This confirmation link was not found. It may have expired or attendance may have been re-recorded. Please contact your trainer if you have any questions.'
      ))
    }

    if (record.confirmed_at) {
      return res.send(page(
        'Already Confirmed', '#16a34a', '✅',
        'Already Confirmed',
        `You have already confirmed your attendance for <strong>${record.topic_title || 'this session'}</strong> on <strong>${record.date}</strong>. No further action needed.`
      ))
    }

    // Check 24-hour expiry
    const createdAt = new Date(record.created_at)
    const now = new Date()
    const hoursElapsed = (now - createdAt) / (1000 * 60 * 60)
    if (hoursElapsed > 24) {
      return res.send(page(
        'Link Expired', '#d97706', '⏰',
        'Confirmation Link Expired',
        `This confirmation link has expired. Your attendance for <strong>${record.topic_title || 'this session'}</strong> on <strong>${record.date}</strong> has been automatically recorded. Please contact your trainer if you have any questions.`
      ))
    }

    // Mark as confirmed
    db.prepare('UPDATE attendance SET confirmed_at = CURRENT_TIMESTAMP WHERE confirm_token = ?').run(token)

    return res.send(page(
      'Attendance Confirmed', '#16a34a', '✅',
      'Attendance Confirmed!',
      `Thank you, <strong>${record.student_name}</strong>! Your attendance for <strong>${record.topic_title || 'this session'}</strong> on <strong>${record.date}</strong> has been confirmed successfully.`
    ))
  } catch (err) {
    console.error('Confirm attendance error:', err)
    return res.status(500).send(page(
      'Error', '#dc2626', '⚠️',
      'Something Went Wrong',
      'An unexpected error occurred. Please try again or contact your trainer.'
    ))
  }
})

module.exports = router
