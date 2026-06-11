// Brevo HTTP API — no SMTP, no nodemailer (Railway blocks all outbound SMTP ports)
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const brevoKey   = (process.env.BREVO_API_KEY  || '').trim()
const senderEmail = (process.env.EMAIL_USER     || '').trim()

// Startup diagnostics
console.log('[Email] Using Brevo HTTP API')
console.log('[Email] BREVO_API_KEY length:', brevoKey.length)
console.log('[Email] Sender EMAIL_USER:', senderEmail.substring(0, 10) || '(not set)')

async function sendEmail(to, subject, htmlContent) {
  if (!brevoKey) {
    console.warn('[Email] BREVO_API_KEY not set — skipping send')
    return false
  }
  if (!senderEmail) {
    console.warn('[Email] EMAIL_USER (sender address) not set — skipping send')
    return false
  }

  console.log(`[Email] Attempting to send to: ${to} | subject: ${subject}`)
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': brevoKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'Define Digital Institute', email: senderEmail },
        to:          [{ email: to }],
        subject,
        htmlContent,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      console.log(`[Email] SENT successfully to: ${to} | messageId: ${data.messageId || '(no id)'}`)
      return true
    } else {
      const body = await res.text()
      console.error(`[Email] FAILED to send to: ${to} | subject: ${subject}`)
      console.error(`[Email] Brevo status: ${res.status} ${res.statusText}`)
      console.error(`[Email] Brevo response: ${body}`)
      return false
    }
  } catch (err) {
    console.error(`[Email] FAILED to send to: ${to} | subject: ${subject}`)
    console.error(`[Email] Error: ${err.message}`)
    // Never throw — email failure must not crash portal
    return false
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

// ── Template 9 — Forgot Password ─────────────────────────────────────────────

function passwordForgotEmail(userName, resetLink) {
  const banner = `<p style="margin:0;font-size:14px;font-weight:bold;color:#ffffff;">Password Reset Request</p>`
  const body = `
    ${greeting(userName)}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">We received a request to reset your password for your Define Digital Portal account. Click the button below to set a new password.</p>
    ${ctaButton('RESET MY PASSWORD', resetLink, '#F97316')}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:12px;color:#64748b;">⏰ This link expires in <strong>1 hour</strong>.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;">🔒 <strong>Never share this link with anyone.</strong></p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
  `
  return baseLayout('#F97316', banner, body)
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

// ── Template 10: Student Welcome Email ────────────────────────────────────────
function studentWelcomeEmail(studentName, email, password, batchName, trainerName, startDate, portalLink) {
  const batchInfo = batchName ? `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${batchName  ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Batch</td><td style="padding:6px 0;font-weight:600;color:#1e293b;">${batchName}</td></tr>` : ''}
      ${trainerName? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Trainer</td><td style="padding:6px 0;font-weight:600;color:#1e293b;">${trainerName}</td></tr>` : ''}
      ${startDate  ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Start Date</td><td style="padding:6px 0;font-weight:600;color:#1e293b;">${startDate}</td></tr>` : ''}
    </table>` : ''

  const body = `
    <p style="font-size:16px;color:#334155;margin:0 0 16px;">Hi <strong>${studentName}</strong>,</p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;">Welcome to <strong>Define Digital Institute</strong>! We're thrilled to have you on board. Your student account has been created and you're all set to begin your learning journey.</p>

    <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:0 0 12px;">Your Login Credentials</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">Portal URL</td>
            <td style="padding:6px 0;"><a href="${portalLink}" style="color:#2272B9;font-weight:600;">${portalLink}</a></td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Email</td>
            <td style="padding:6px 0;font-weight:600;color:#1e293b;font-family:monospace;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Password</td>
            <td style="padding:6px 0;font-weight:600;color:#1e293b;font-family:monospace;">${password}</td></tr>
      </table>
    </div>

    <div style="background:#FEF3D9;border-left:4px solid #F5A623;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#78350f;">🔐 Please <strong>change your password</strong> after your first login to keep your account secure.</p>
    </div>

    ${batchName ? `<div style="background:#f0f9ff;border-radius:12px;padding:16px;margin:0 0 20px;"><p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:0 0 8px;">Your Batch Details</p>${batchInfo}</div>` : ''}

    <div style="margin:0 0 20px;">
      <p style="font-size:14px;font-weight:600;color:#1e293b;margin:0 0 12px;">What's Next?</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${['Log in to your student portal','Check your schedule in the attendance calendar','Connect with your trainer for onboarding'].map((s,i) =>
          `<div style="display:flex;align-items:flex-start;gap:10px;"><div style="min-width:24px;height:24px;background:#F5A623;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${i+1}</div><p style="margin:0;font-size:13px;color:#475569;padding-top:3px;">${s}</p></div>`
        ).join('')}
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${portalLink}" style="display:inline-block;background:#F5A623;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:700;font-size:15px;">Log In to Your Portal →</a>
    </div>

    <p style="font-size:12px;color:#94a3b8;margin-top:24px;text-align:center;">Questions? Contact us at <a href="mailto:definedigitalinstitute@gmail.com" style="color:#2272B9;">definedigitalinstitute@gmail.com</a></p>
  `
  return baseLayout('#1B3A6B',
    `<h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">Welcome to Define Digital!</h1>
     <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Become a digital leader — your journey starts today</p>`,
    body
  )
}

// ── Template 11: Daily Activity Report ────────────────────────────────────────
function dailyReportEmail(reportDate, snapshot, activities, followups, absences, pendingLeaves, tomorrow) {
  const fmtDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) } catch { return d } }

  const sectionHeader = (title) =>
    `<tr><td colspan="5" style="background:#f8fafc;padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-top:1px solid #e2e8f0;">${title}</td></tr>`

  const outcomeColor = { positive:'#10b981', pending:'#f59e0b', negative:'#ef4444', informational:'#3b82f6' }
  const priorityBadge = { low:'#64748b', medium:'#f59e0b', high:'#f97316', urgent:'#ef4444' }

  const activityRows = activities.length === 0
    ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">No activities logged today</td></tr>`
    : activities.map(a => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 12px;font-size:13px;color:#64748b;white-space:nowrap;">${a.log_time}</td>
        <td style="padding:8px 12px;font-size:13px;color:#1e293b;font-weight:500;">${a.category_label || a.category}</td>
        <td style="padding:8px 12px;font-size:13px;color:#475569;">${a.person_name || a.student_name || '—'}</td>
        <td style="padding:8px 12px;font-size:13px;color:#475569;max-width:200px;">${(a.description || '').slice(0, 80)}${a.description?.length > 80 ? '...' : ''}</td>
        <td style="padding:8px 12px;"><span style="background:${outcomeColor[a.outcome]||'#94a3b8'}20;color:${outcomeColor[a.outcome]||'#64748b'};font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;text-transform:capitalize;">${a.outcome}</span></td>
      </tr>`).join('')

  const followupRows = followups.length === 0
    ? `<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">No pending follow-ups</td></tr>`
    : followups.map(f => {
        const overdue = f.followup_date && f.followup_date < reportDate
        return `<tr style="border-bottom:1px solid #f1f5f9;${overdue?'background:#fff5f5;':''}">
          <td style="padding:8px 12px;font-size:13px;color:${overdue?'#ef4444':'#64748b'};">${f.followup_date || f.log_date}${overdue?' ⚠️ Overdue':''}</td>
          <td style="padding:8px 12px;font-size:13px;color:#475569;">${f.category_label || f.category}</td>
          <td style="padding:8px 12px;font-size:13px;color:#475569;">${f.person_name || f.student_name || '—'}</td>
          <td style="padding:8px 12px;font-size:13px;color:#64748b;">${(f.followup_note || '').slice(0, 60)}</td>
        </tr>`}).join('')

  const body = `
    <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 20px;display:flex;gap:12px;flex-wrap:wrap;">
      ${[
        ['Sessions Today',    snapshot.sessions     || 0, '#2272B9'],
        ['Attendance',        `${snapshot.present||0}/${snapshot.total||0}`, '#10b981'],
        ['New Admissions',    snapshot.admissions   || 0, '#F5A623'],
        ['Active Batches',    snapshot.batches      || 0, '#8b5cf6'],
        ['Activities Logged', activities.length,          '#f59e0b'],
      ].map(([label, val, color]) => `
        <div style="flex:1;min-width:100px;background:#fff;border-radius:10px;padding:12px;text-align:center;border:1px solid #e2e8f0;">
          <p style="font-size:24px;font-weight:700;color:${color};margin:0;">${val}</p>
          <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
        </div>`).join('')}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Time</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Category</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Person</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Description</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Outcome</th>
      </tr></thead>
      <tbody>${activityRows}</tbody>
    </table>

    ${followups.length > 0 ? `
    <p style="font-size:13px;font-weight:700;color:#1e293b;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Pending Follow-Ups</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead><tr style="background:#fff5e6;"><th style="padding:8px 12px;text-align:left;font-size:12px;color:#78350f;">Due Date</th><th style="padding:8px 12px;text-align:left;font-size:12px;color:#78350f;">Category</th><th style="padding:8px 12px;text-align:left;font-size:12px;color:#78350f;">Person</th><th style="padding:8px 12px;text-align:left;font-size:12px;color:#78350f;">Note</th></tr></thead>
      <tbody>${followupRows}</tbody>
    </table>` : ''}

    ${absences.length > 0 ? `<p style="font-size:13px;font-weight:700;color:#1e293b;margin:16px 0 8px;">Absent Today (${absences.length})</p><p style="font-size:13px;color:#475569;">${absences.map(a=>`${a.name} (${a.batch_name})`).join(', ')}</p>` : ''}

    ${pendingLeaves.length > 0 ? `<div style="background:#fff5e6;border-left:4px solid #F5A623;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;"><p style="margin:0;font-size:13px;color:#78350f;font-weight:600;">⏳ ${pendingLeaves.length} leave request${pendingLeaves.length>1?'s':''} pending response for 24+ hours</p></div>` : ''}

    <p style="font-size:11px;color:#94a3b8;margin-top:24px;text-align:center;border-top:1px solid #f1f5f9;padding-top:16px;">
      This is your automated daily report from Define Digital Portal.<br>
      To change report time, go to Settings → Email Reports.
    </p>
  `
  return baseLayout('#1B3A6B',
    `<h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">Daily Activity Report</h1>
     <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${fmtDate(reportDate)}</p>`,
    body
  )
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
  passwordForgotEmail,
  studentWelcomeEmail,
  dailyReportEmail,
}
