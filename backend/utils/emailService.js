const nodemailer = require('nodemailer')

// Strip spaces from Gmail app password (stored with spaces for readability)
const emailPass = (process.env.EMAIL_PASS || '').replace(/\s/g, '')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: emailPass,
  },
})

async function sendEmail(to, subject, htmlContent) {
  if (!process.env.EMAIL_USER || !emailPass) {
    console.warn('[Email] EMAIL_USER or EMAIL_PASS not configured — skipping send')
    return
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Define Digital Institute <${process.env.EMAIL_USER}>`,
      replyTo: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      to,
      subject,
      html: htmlContent,
    })
    console.log(`[Email] Sent "${subject}" to ${to}`)
  } catch (err) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, err.message)
    // Never throw — email failure must not crash portal
  }
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function baseLayout(bannerBg, bannerHtml, bodyHtml) {
  const banner = bannerBg
    ? `<tr><td style="background-color:${bannerBg};padding:16px 32px;">${bannerHtml}</td></tr>`
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <tr><td style="background-color:#1B3A6B;border-radius:12px 12px 0 0;padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td>
        <span style="font-size:22px;font-weight:bold;color:#F97316;">Define</span>
        <span style="font-size:22px;font-weight:bold;color:#ffffff;"> Digital</span>
        <p style="margin:5px 0 0;font-size:11px;color:#93c5fd;letter-spacing:0.5px;">BECOME A DIGITAL LEADER</p>
      </td>
      <td align="right">
        <span style="font-size:10px;color:#64748b;background:#0f2a52;padding:4px 10px;border-radius:20px;letter-spacing:0.5px;">PORTAL NOTIFICATION</span>
      </td>
    </tr></table>
  </td></tr>

  ${banner}

  <tr><td style="background-color:#ffffff;padding:32px;">
    ${bodyHtml}
  </td></tr>

  <tr><td style="background-color:#f8fafc;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#64748b;font-weight:600;">Define Digital Institute</p>
    <p style="margin:8px 0 0;font-size:10px;color:#94a3b8;">This is an automated message from Define Digital Portal. Please do not reply to this email.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function detailCard(rows) {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px;font-weight:600;white-space:nowrap;width:38%;">${label}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:13px;">${value || '—'}</td>
    </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;">
    <tr style="background-color:#f8fafc;"><td colspan="2" style="padding:10px 12px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">SESSION DETAILS</td></tr>
    ${rowsHtml}
  </table>`
}

function ctaButton(text, link, color = '#F97316') {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:20px 0;">
    <a href="${link}" style="background-color:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 36px;border-radius:8px;display:inline-block;letter-spacing:0.5px;">${text}</a>
  </td></tr>
  </table>`
}

function greeting(name) {
  return `<p style="margin:0 0 16px;font-size:15px;color:#1e293b;">Dear <strong>${name}</strong>,</p>`
}

// ── Template 1 — Attendance Confirmation ──────────────────────────────────────

function attendanceConfirmationEmail(studentName, date, topicName, startTime, endTime, trainerName, batchName, confirmLink) {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">✅ Attendance Recorded — Please Confirm</p>`
  const body = `
    ${greeting(studentName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">Your attendance has been recorded for the following session. Please click the button below to confirm your attendance.</p>
    ${detailCard([
      ['Date', date],
      ['Topic', topicName],
      ['Batch', batchName],
      ['Trainer', trainerName],
      ['Session Time', startTime && endTime ? `${startTime} – ${endTime}` : 'See schedule'],
    ])}
    ${ctaButton('CONFIRM MY ATTENDANCE', confirmLink, '#16a34a')}
    <p style="margin:16px 0 8px;font-size:12px;color:#64748b;text-align:center;">This confirmation link expires in <strong>24 hours</strong>.</p>
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">If you did not attend this session, please ignore this email. Your attendance will be automatically recorded after 24 hours.</p>
  `
  return baseLayout('#16a34a', banner, body)
}

// ── Template 2 — Uninformed Absence Alert ─────────────────────────────────────

function uninformedAbsentEmail(studentName, date, topicName, trainerName, batchName, absentCountThisMonth, maxAllowed, isLastWarning) {
  const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">⚠️ Uninformed Absence Recorded</p>`
  const warningBox = isLastWarning ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:2px solid #dc2626;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:13px;font-weight:bold;color:#dc2626;">⚠️ FINAL WARNING</p>
        <p style="margin:8px 0 0;font-size:12px;color:#7f1d1d;">You have used all your uninformed leaves for this month. Any further uninformed absence will result in loss of revision session access as per Define Digital attendance policy.</p>
      </td></tr>
    </table>` : ''
  const body = `
    ${greeting(studentName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">An uninformed absence has been recorded for the following session.</p>
    ${detailCard([
      ['Date', date],
      ['Topic', topicName],
      ['Batch', batchName],
      ['Trainer', trainerName],
    ])}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:13px;color:#9a3412;">This is your <strong>${ordinal(absentCountThisMonth)} uninformed absence</strong> this month out of <strong>${maxAllowed} allowed</strong>.</p>
      </td></tr>
    </table>
    ${warningBox}
    <p style="margin:16px 0 0;font-size:13px;color:#475569;">If you believe this is an error, please contact your trainer <strong>${trainerName}</strong> immediately.</p>
  `
  return baseLayout('#dc2626', banner, body)
}

// ── Template 3 — Leave Approved ────────────────────────────────────────────────

function leaveApprovedEmail(studentName, fromDate, toDate, trainerName, topicsMissed, makeupScheduled, makeupDate, makeupTime) {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">✓ Your Leave Has Been Approved</p>`
  const topicsSection = topicsMissed && topicsMissed.length > 0
    ? `<p style="margin:16px 0 8px;font-size:13px;font-weight:600;color:#475569;">Topics Missed:</p>
       <ul style="margin:0;padding:0 0 0 20px;color:#475569;font-size:13px;">
         ${topicsMissed.map(t => `<li style="margin:4px 0;">${t}</li>`).join('')}
       </ul>`
    : ''
  const makeupSection = makeupScheduled
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:16px 0;">
         <tr><td style="padding:14px 16px;">
           <p style="margin:0;font-size:13px;font-weight:bold;color:#1d4ed8;">📅 Makeup Session Scheduled</p>
           <p style="margin:6px 0 0;font-size:13px;color:#1e40af;">${makeupDate || ''}${makeupTime ? ` at ${makeupTime}` : ''}</p>
         </td></tr>
       </table>` : ''
  const body = `
    ${greeting(studentName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">Your leave request has been approved. Details are below.</p>
    ${detailCard([
      ['From Date', fromDate],
      ['To Date', toDate],
      ['Approved By', trainerName],
    ])}
    ${topicsSection}
    ${makeupSection}
    <p style="margin:16px 0 0;font-size:13px;color:#475569;">Please ensure you cover the missed topics and stay on track with your batch schedule.</p>
  `
  return baseLayout('#16a34a', banner, body)
}

// ── Template 4 — Leave Rejected ────────────────────────────────────────────────

function leaveRejectedEmail(studentName, fromDate, toDate, trainerName, rejectionReason) {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">Leave Request Not Approved</p>`
  const body = `
    ${greeting(studentName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">Your leave request for the following dates was not approved.</p>
    ${detailCard([
      ['From Date', fromDate],
      ['To Date', toDate],
      ['Reviewed By', trainerName],
    ])}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef9c3;border-left:4px solid #eab308;border-radius:4px;margin:16px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#713f12;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
        <p style="margin:0;font-size:13px;color:#92400e;">${rejectionReason}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#475569;">You may reapply with updated information or contact your trainer <strong>${trainerName}</strong> for clarification.</p>
  `
  return baseLayout('#d97706', banner, body)
}

// ── Template 5 — Leave Request Received ───────────────────────────────────────

function leaveRequestReceivedEmail(studentName, fromDate, toDate, leaveType, portalLink) {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">Your Leave Request Is Under Review</p>`
  const body = `
    ${greeting(studentName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">We have received your leave request. It is currently pending review by your trainer.</p>
    ${detailCard([
      ['From Date', fromDate],
      ['To Date', toDate],
      ['Leave Type', leaveType ? leaveType.charAt(0).toUpperCase() + leaveType.slice(1) : '—'],
      ['Status', 'Pending Review'],
    ])}
    <p style="margin:16px 0;font-size:13px;color:#475569;">Your trainer will review your request shortly and you will be notified of the decision by email.</p>
    ${ctaButton('VIEW MY REQUEST', portalLink, '#2563eb')}
  `
  return baseLayout('#2563eb', banner, body)
}

// ── Template 6 — Appointment Confirmed ────────────────────────────────────────

function appointmentConfirmedEmail(studentName, date, time, duration, trainerName, mode, topic) {
  const modeLabel = mode === 'online' ? '🌐 Online' : '🏢 In-person'
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">✓ Appointment Confirmed</p>`
  const body = `
    ${greeting(studentName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">Your appointment has been confirmed by your trainer. Please see the details below.</p>
    ${detailCard([
      ['Date', date],
      ['Time', time],
      ['Duration', duration ? `${duration} minutes` : '30 minutes'],
      ['Trainer', trainerName],
      ['Mode', modeLabel],
      ['Topic / Question', topic],
    ])}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 16px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#1d4ed8;">⏰ Please be ready <strong>5 minutes before</strong> the scheduled time.</p>
      </td></tr>
    </table>
  `
  return baseLayout('#16a34a', banner, body)
}

// ── Template 7 — Trainer: New Leave Request ────────────────────────────────────

function trainerNewLeaveRequestEmail(trainerName, studentName, fromDate, toDate, leaveType, isEmergency, portalLink) {
  const bannerBg = isEmergency ? '#dc2626' : '#2563eb'
  const bannerText = isEmergency
    ? `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">🚨 EMERGENCY LEAVE REQUEST</p>`
    : `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">New Leave Request</p>`
  const urgencyBox = isEmergency
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:2px solid #dc2626;border-radius:8px;margin:0 0 16px;">
         <tr><td style="padding:14px 16px;text-align:center;">
           <p style="margin:0;font-size:14px;font-weight:bold;color:#dc2626;">🚨 URGENT — This is an emergency leave request</p>
         </td></tr>
       </table>` : ''
  const body = `
    ${greeting(trainerName)}
    ${urgencyBox}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">A student has submitted a new ${leaveType} leave request awaiting your review.</p>
    ${detailCard([
      ['Student', studentName],
      ['Leave Type', leaveType ? leaveType.charAt(0).toUpperCase() + leaveType.slice(1) : '—'],
      ['From Date', fromDate],
      ['To Date', toDate],
    ])}
    ${ctaButton('REVIEW REQUEST IN PORTAL', portalLink, isEmergency ? '#dc2626' : '#F97316')}
    <p style="margin:0;font-size:13px;color:#475569;text-align:center;">Please respond promptly — the student is awaiting your decision.</p>
  `
  return baseLayout(bannerBg, bannerText, body)
}

// ── Template 8 — Password Reset ───────────────────────────────────────────────

function passwordResetEmail(userName, newPassword, portalLink) {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">Your Password Has Been Reset</p>`
  const body = `
    ${greeting(userName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">Your password has been reset by your administrator. Please use the temporary password below to log in and change it immediately.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:2px solid #e2e8f0;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 8px;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Your New Password</p>
        <p style="margin:0;font-family:Courier New,monospace;font-size:24px;font-weight:bold;color:#1B3A6B;letter-spacing:4px;">${newPassword}</p>
      </td></tr>
    </table>
    ${ctaButton('LOG IN NOW', portalLink, '#1B3A6B')}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:12px;color:#dc2626;text-align:center;">If you did not request this reset, contact Define Digital admin immediately.</p>
      </td></tr>
    </table>
  `
  return baseLayout('#1B3A6B', banner, body)
}

// ── Test Email ─────────────────────────────────────────────────────────────────

function testEmailHtml() {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">📧 Email System Test</p>`
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b;font-weight:600;">Email System is Working Correctly</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">All portal notifications will now be delivered via email in addition to in-app notifications.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:16px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#16a34a;font-weight:600;">✅ SMTP connection successful</p>
        <p style="margin:8px 0 0;font-size:12px;color:#15803d;">Define Digital Portal → Gmail SMTP → Inbox</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Sent from: ${process.env.EMAIL_USER || 'portal'}</p>
  `
  return baseLayout('#16a34a', banner, body)
}

async function sendTestEmail(to) {
  await sendEmail(to, 'Define Digital Portal — Email System Test', testEmailHtml())
}

module.exports = {
  sendEmail,
  sendTestEmail,
  attendanceConfirmationEmail,
  uninformedAbsentEmail,
  leaveApprovedEmail,
  leaveRejectedEmail,
  leaveRequestReceivedEmail,
  appointmentConfirmedEmail,
  trainerNewLeaveRequestEmail,
  passwordResetEmail,
}
