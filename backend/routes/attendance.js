const express = require('express');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail, attendanceConfirmationEmail, uninformedAbsentEmail } = require('../utils/emailService');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Helper: derive confirmation state from DB fields
// Old records (created_at IS NULL) → treat as confirmed for backward compatibility
function confirmationStatus(status, confirmedAt, createdAt) {
  if (!['present', 'late'].includes(status)) return null;
  if (confirmedAt) return 'confirmed';
  if (!createdAt) return 'confirmed';
  const hoursElapsed = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return hoursElapsed >= 24 ? 'expired' : 'pending';
}

// Helper: verify batch belongs to trainer
function getBatchForTrainer(batchId, trainerId) {
  return db.prepare('SELECT * FROM batches WHERE id = ? AND trainer_id = ?').get(batchId, trainerId);
}

// Helper: get enrolled students for a batch
function getEnrolledStudents(batchId) {
  return db.prepare(`
    SELECT u.id, u.name, u.email
    FROM batch_students bs
    JOIN users u ON bs.student_id = u.id
    WHERE bs.batch_id = ?
    ORDER BY u.name ASC
  `).all(batchId);
}

// GET /api/attendance/batch/:batchId/date/:date
// Trainer: get attendance for a specific date
router.get('/batch/:batchId/date/:date', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can view batch attendance' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { date } = req.params;
    const students = getEnrolledStudents(batch.id);

    const attendanceRecords = db.prepare(`
      SELECT student_id, status, confirmed_at, created_at
      FROM attendance
      WHERE batch_id = ? AND date = ?
    `).all(batch.id, date);

    const recordMap = {};
    attendanceRecords.forEach(r => { recordMap[r.student_id] = r; });

    const result = students.map(s => {
      const rec = recordMap[s.id] || null;
      const status = rec?.status || null;
      const confirmedAt = rec?.confirmed_at || null;
      const createdAt = rec?.created_at || null;
      return {
        student_id: s.id,
        name: s.name,
        email: s.email,
        status,
        confirmed_at: confirmedAt,
        confirmation_status: status ? confirmationStatus(status, confirmedAt, createdAt) : null,
      };
    });

    return res.json({ date, batch_id: batch.id, records: result });
  } catch (err) {
    console.error('Get attendance by date error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/batch/:batchId
// Trainer: mark/update attendance
router.post('/batch/:batchId', async (req, res) => {
  console.log('[Attendance POST] Handler entered — batchId:', req.params.batchId, '| userId:', req.user?.id, '| role:', req.user?.role);
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can mark attendance' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'date and records array are required' });
    }

    const validStatuses = ['present', 'absent', 'late'];
    for (const record of records) {
      if (!record.student_id || !validStatuses.includes(record.status)) {
        return res.status(400).json({
          error: `Invalid record: student_id and status (present/absent/late) are required`
        });
      }
    }

    const insertOrReplace = db.prepare(`
      INSERT OR REPLACE INTO attendance (batch_id, student_id, date, status, marked_by, confirm_token)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const markMany = db.transaction((recs) => {
      for (const rec of recs) {
        const token = ['present', 'late'].includes(rec.status) ? crypto.randomUUID() : null;
        insertOrReplace.run(batch.id, rec.student_id, date, rec.status, req.user.id, token);
      }
    });

    markMany(records);

    // Email + in-app notification block — failures never crash the response
    const emailCounts = { confirmations: 0, absenceAlerts: 0, failed: 0 };
    try {
      console.log('[Attendance] Email+notif block reached — records:', records.length, '| date:', date, '| batch:', batch.id);

      const batchInfo = db.prepare(`
        SELECT b.*, u.name AS trainer_name FROM batches b
        JOIN users u ON b.trainer_id = u.id WHERE b.id = ?
      `).get(batch.id);
      console.log('[Attendance] batchInfo:', batchInfo ? batchInfo.name : 'NULL');

      const topic = db.prepare('SELECT title, notes FROM topics WHERE batch_id = ? AND date = ?').get(batch.id, date);
      const topicName = topic?.title || 'Class Session';
      const topicNotes = topic?.notes || null;
      const batchName = batchInfo?.name || 'your batch';
      const trainerName = batchInfo?.trainer_name || 'your trainer';
      const portalUrl = process.env.PORTAL_URL
        || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:5000');

      const insertNotif = db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
        VALUES (?, ?, ?, ?, 'attendance', ?)
      `);

      for (const rec of records) {
        const student = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(rec.student_id);
        if (!student) { console.warn('[Attendance] Student not found:', rec.student_id); continue; }

        // In-app notification (always — even if email skipped)
        try {
          const statusLabel = rec.status.charAt(0).toUpperCase() + rec.status.slice(1);
          if (['present', 'late'].includes(rec.status)) {
            insertNotif.run(
              student.id,
              `Attendance Recorded — ${date}`,
              `Your attendance for ${date} has been recorded as ${statusLabel} for ${batchName}. A confirmation email has been sent to your registered address.`,
              'success', batch.id
            );
          } else {
            insertNotif.run(
              student.id,
              `Absence Alert — ${date}`,
              `You were marked absent on ${date} for ${batchName}. Please check your email for details.`,
              'warning', batch.id
            );
          }
        } catch (notifErr) {
          console.warn('[Attendance] Notification insert failed for student', rec.student_id, notifErr.message);
        }

        if (!student.email) { console.warn('[Attendance] No email address for student', rec.student_id); continue; }

        if (['present', 'late'].includes(rec.status)) {
          const att = db.prepare('SELECT confirm_token FROM attendance WHERE batch_id = ? AND student_id = ? AND date = ?').get(batch.id, rec.student_id, date);
          console.log(`[Attendance] confirm_token for student ${rec.student_id}:`, att?.confirm_token || 'NULL');
          if (att?.confirm_token) {
            const confirmLink = `${portalUrl}/api/confirm-attendance/${att.confirm_token}`;
            const emailHtml = attendanceConfirmationEmail(student.name, date, topicName, null, null, trainerName, batchName, confirmLink, topicNotes, rec.status);
            const ok = await sendEmail(student.email, `Attendance Confirmation — ${topicName} — ${date}`, emailHtml);
            ok ? emailCounts.confirmations++ : emailCounts.failed++;
          } else {
            console.warn('[Attendance] No confirm_token in DB for student', rec.student_id);
          }
        } else if (rec.status === 'absent') {
          const mon = date.slice(0, 7);
          const { c: uninformedCount } = db.prepare(
            `SELECT COUNT(*) AS c FROM attendance WHERE student_id = ? AND status = 'absent' AND substr(date,1,7) = ?`
          ).get(rec.student_id, mon);
          const MAX_UNINFORMED = 3;
          const concernLink = `${portalUrl}/leaves`
          const emailHtml = uninformedAbsentEmail(student.name, date, topicName, trainerName, batchName, uninformedCount, MAX_UNINFORMED, uninformedCount >= MAX_UNINFORMED, concernLink, topicNotes);
          const ok = await sendEmail(student.email, `Attendance Alert — Uninformed Absence — ${date}`, emailHtml);
          ok ? emailCounts.absenceAlerts++ : emailCounts.failed++;
        }
      }

      console.log('[Attendance] Email counts:', JSON.stringify(emailCounts));
    } catch (emailErr) {
      console.error('[Email] Attendance email/notif block error (non-fatal):', emailErr.message, emailErr.stack);
    }

    return res.json({ message: 'Attendance marked successfully', date, count: records.length, emailsSent: emailCounts });
  } catch (err) {
    console.error('Mark attendance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/batch/:batchId/calendar?month=YYYY-MM
// Trainer: calendar summary for a month
router.get('/batch/:batchId/calendar', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can view batch calendar' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { month } = req.query; // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month query param required in YYYY-MM format' });
    }

    const rows = db.prepare(`
      SELECT
        date,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('present','late') AND (confirmed_at IS NOT NULL OR created_at IS NULL) THEN 1 ELSE 0 END) AS confirmed_count,
        SUM(CASE WHEN status IN ('present','late') AND confirmed_at IS NULL AND created_at IS NOT NULL AND (julianday('now') - julianday(created_at)) * 24 < 24 THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status IN ('present','late') AND confirmed_at IS NULL AND created_at IS NOT NULL AND (julianday('now') - julianday(created_at)) * 24 >= 24 THEN 1 ELSE 0 END) AS expired_count
      FROM attendance
      WHERE batch_id = ? AND date LIKE ?
      GROUP BY date
      ORDER BY date ASC
    `).all(batch.id, `${month}%`);

    return res.json({ month, batch_id: batch.id, calendar: rows });
  } catch (err) {
    console.error('Get calendar error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/batch/:batchId/summary
// Trainer: full attendance summary for all students
router.get('/batch/:batchId/summary', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can view batch summary' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const students = getEnrolledStudents(batch.id);

    const summaryRows = db.prepare(`
      SELECT
        student_id,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
        COUNT(*) AS total_days
      FROM attendance
      WHERE batch_id = ?
      GROUP BY student_id
    `).all(batch.id);

    const summaryMap = {};
    summaryRows.forEach(r => { summaryMap[r.student_id] = r; });

    const summary = students.map(s => {
      const stats = summaryMap[s.id] || { present: 0, absent: 0, late: 0, total_days: 0 };
      const percentage = stats.total_days > 0
        ? Math.round(((stats.present + stats.late) / stats.total_days) * 100)
        : 0;
      return {
        student_id: s.id,
        name: s.name,
        total_days: stats.total_days,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        percentage
      };
    });

    return res.json({ batch_id: batch.id, batch_name: batch.name, summary });
  } catch (err) {
    console.error('Get summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/student/my-attendance
// Student: attendance across all batches
router.get('/student/my-attendance', (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access their own attendance' });
    }

    const records = db.prepare(`
      SELECT
        a.batch_id,
        b.name AS batch_name,
        a.date,
        a.status
      FROM attendance a
      JOIN batches b ON a.batch_id = b.id
      WHERE a.student_id = ?
      ORDER BY a.date DESC
    `).all(req.user.id);

    return res.json({ student_id: req.user.id, attendance: records });
  } catch (err) {
    console.error('Get student attendance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/student/my-attendance/:batchId
// Student: attendance for a specific batch
router.get('/student/my-attendance/:batchId', (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access their own attendance' });
    }

    // Verify student is enrolled in this batch
    const enrollment = db.prepare(
      'SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?'
    ).get(req.params.batchId, req.user.id);

    if (!enrollment) {
      return res.status(404).json({ error: 'Batch not found or you are not enrolled' });
    }

    const batch = db.prepare(`
      SELECT b.id, b.name, b.start_date, b.end_date, u.name AS trainer_name
      FROM batches b JOIN users u ON u.id = b.trainer_id
      WHERE b.id = ?
    `).get(req.params.batchId);

    const rawRecords = db.prepare(`
      SELECT a.date, a.status, a.confirmed_at, a.created_at, t.title AS topic_title
      FROM attendance a
      LEFT JOIN topics t ON t.batch_id = a.batch_id AND t.date = a.date
      WHERE a.batch_id = ? AND a.student_id = ?
      ORDER BY a.date ASC
    `).all(batch.id, req.user.id);

    const records = rawRecords.map(r => ({
      ...r,
      confirmation_status: confirmationStatus(r.status, r.confirmed_at, r.created_at),
    }));

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const total = records.length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return res.json({
      batch,
      records,
      stats: { present, absent, late, total, percentage }
    });
  } catch (err) {
    console.error('Get student batch attendance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/batch/:batchId/export/excel
// Trainer: export attendance as Excel
router.get('/batch/:batchId/export/excel', async (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can export attendance' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const students = getEnrolledStudents(batch.id);

    // Get all distinct dates for this batch
    const dates = db.prepare(`
      SELECT DISTINCT date FROM attendance
      WHERE batch_id = ?
      ORDER BY date ASC
    `).all(batch.id).map(r => r.date);

    // Get all attendance records
    const allRecords = db.prepare(`
      SELECT student_id, date, status FROM attendance
      WHERE batch_id = ?
    `).all(batch.id);

    // Build lookup map: { student_id: { date: status } }
    const lookup = {};
    allRecords.forEach(r => {
      if (!lookup[r.student_id]) lookup[r.student_id] = {};
      lookup[r.student_id][r.date] = r.status;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Attendance Portal';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Attendance');

    // Summary info rows at the top
    sheet.addRow(['Batch Name:', batch.name]);
    sheet.addRow(['Date Range:', `${batch.start_date} to ${batch.end_date}`]);
    sheet.addRow(['Total Students:', students.length]);
    sheet.addRow(['Total Days Recorded:', dates.length]);
    sheet.addRow(['Generated On:', new Date().toLocaleDateString()]);
    sheet.addRow([]); // blank row

    // Header row: Student Name, Email, then each date
    const headerRow = sheet.addRow(['Student Name', 'Email', ...dates]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    // Status color map
    const statusColors = {
      present: 'FF70AD47',  // green
      absent:  'FFFF0000',  // red
      late:    'FFFFC000'   // orange
    };

    // Data rows
    students.forEach(student => {
      const rowData = [student.name, student.email];
      dates.forEach(date => {
        const status = (lookup[student.id] && lookup[student.id][date]) || '';
        rowData.push(status ? status[0].toUpperCase() : ''); // P / A / L
      });
      const dataRow = sheet.addRow(rowData);

      // Color-code status cells (starting at column 3)
      dates.forEach((date, idx) => {
        const cell = dataRow.getCell(idx + 3);
        const status = (lookup[student.id] && lookup[student.id][date]) || null;
        if (status && statusColors[status]) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statusColors[status] }
          };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
        cell.alignment = { horizontal: 'center' };
      });
    });

    // Auto-fit columns
    sheet.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 30);
    });

    const fileName = `attendance_${batch.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/attendance/batch/:batchId/export/pdf
// Trainer: export attendance as PDF
router.get('/batch/:batchId/export/pdf', (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can export attendance' });
    }

    const batch = getBatchForTrainer(req.params.batchId, req.user.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const students = getEnrolledStudents(batch.id);

    const dates = db.prepare(`
      SELECT DISTINCT date FROM attendance
      WHERE batch_id = ?
      ORDER BY date ASC
    `).all(batch.id).map(r => r.date);

    const allRecords = db.prepare(`
      SELECT student_id, date, status FROM attendance
      WHERE batch_id = ?
    `).all(batch.id);

    const lookup = {};
    allRecords.forEach(r => {
      if (!lookup[r.student_id]) lookup[r.student_id] = {};
      lookup[r.student_id][r.date] = r.status;
    });

    const fileName = `attendance_${batch.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    // ── Title & Batch Info ──
    doc.fontSize(18).font('Helvetica-Bold').text('Attendance Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text(`Batch: ${batch.name}`, { align: 'center' });
    doc.fontSize(10).text(`Date Range: ${batch.start_date}  to  ${batch.end_date}`, { align: 'center' });
    doc.fontSize(9).fillColor('#555555').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    if (students.length === 0 || dates.length === 0) {
      doc.fontSize(12).text('No attendance data available for this batch.', { align: 'center' });
      doc.end();
      return;
    }

    // ── Table layout ──
    const pageWidth = doc.page.width - 80; // subtract margins
    const nameColWidth = 160;
    const dateColWidth = Math.min(
      Math.max(Math.floor((pageWidth - nameColWidth) / Math.max(dates.length, 1)), 30),
      55
    );
    const rowHeight = 20;
    const headerHeight = 24;
    const fontSize = 8;

    // Limit displayed dates per page if too many
    const maxDateCols = Math.floor((pageWidth - nameColWidth) / dateColWidth);
    const displayedDates = dates.slice(0, maxDateCols);
    const hiddenCount = dates.length - displayedDates.length;

    const startX = 40;
    let currentY = doc.y;

    // ── Draw header row ──
    const drawHeader = (y) => {
      // Background for header
      doc.rect(startX, y, nameColWidth + displayedDates.length * dateColWidth, headerHeight)
         .fill('#2C3E50');

      doc.fillColor('#FFFFFF').fontSize(fontSize + 1).font('Helvetica-Bold');
      doc.text('Student Name', startX + 4, y + 7, { width: nameColWidth - 8, lineBreak: false });

      displayedDates.forEach((date, i) => {
        const x = startX + nameColWidth + i * dateColWidth;
        // short date: MM/DD
        const shortDate = date.slice(5).replace('-', '/');
        doc.text(shortDate, x + 2, y + 7, { width: dateColWidth - 4, align: 'center', lineBreak: false });
      });
      doc.fillColor('#000000').font('Helvetica');
    };

    drawHeader(currentY);
    currentY += headerHeight;

    // ── Draw student rows ──
    const statusLabel = { present: 'P', absent: 'A', late: 'L' };
    const statusColors = { present: '#27AE60', absent: '#E74C3C', late: '#F39C12' };

    students.forEach((student, rowIdx) => {
      // New page if needed
      if (currentY + rowHeight > doc.page.height - 60) {
        doc.addPage();
        currentY = 40;
        drawHeader(currentY);
        currentY += headerHeight;
      }

      const rowBg = rowIdx % 2 === 0 ? '#F8F9FA' : '#FFFFFF';
      doc.rect(startX, currentY, nameColWidth + displayedDates.length * dateColWidth, rowHeight)
         .fill(rowBg);

      // Student name
      doc.fillColor('#000000').fontSize(fontSize).font('Helvetica');
      doc.text(student.name, startX + 4, currentY + 6, { width: nameColWidth - 8, lineBreak: false });

      // Status cells
      displayedDates.forEach((date, i) => {
        const x = startX + nameColWidth + i * dateColWidth;
        const status = lookup[student.id] && lookup[student.id][date];
        if (status) {
          const color = statusColors[status] || '#888888';
          doc.rect(x + 2, currentY + 3, dateColWidth - 4, rowHeight - 6).fill(color);
          doc.fillColor('#FFFFFF').font('Helvetica-Bold')
             .text(statusLabel[status] || status[0].toUpperCase(), x + 2, currentY + 6, {
               width: dateColWidth - 4, align: 'center', lineBreak: false
             });
        }
      });

      // Row border line
      doc.fillColor('#000000').font('Helvetica');
      doc.moveTo(startX, currentY + rowHeight)
         .lineTo(startX + nameColWidth + displayedDates.length * dateColWidth, currentY + rowHeight)
         .strokeColor('#CCCCCC').stroke();

      currentY += rowHeight;
    });

    // ── Legend ──
    doc.moveDown(1.5);
    doc.fontSize(8).font('Helvetica-Bold').text('Legend:', startX, doc.y);
    doc.moveDown(0.3);
    const legendY = doc.y;
    [['P', '#27AE60', 'Present'], ['A', '#E74C3C', 'Absent'], ['L', '#F39C12', 'Late']].forEach(([lbl, color, text], i) => {
      const lx = startX + i * 90;
      doc.rect(lx, legendY, 16, 14).fill(color);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
         .text(lbl, lx, legendY + 3, { width: 16, align: 'center', lineBreak: false });
      doc.fillColor('#000000').font('Helvetica')
         .text(` ${text}`, lx + 18, legendY + 3, { lineBreak: false });
    });

    // ── Summary stats ──
    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica-Bold').text('Summary Statistics:', startX);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8);

    students.forEach(student => {
      const recs = Object.values(lookup[student.id] || {});
      const p = recs.filter(s => s === 'present').length;
      const a = recs.filter(s => s === 'absent').length;
      const l = recs.filter(s => s === 'late').length;
      const total = recs.length;
      const pct = total > 0 ? Math.round(((p + l) / total) * 100) : 0;
      doc.text(`${student.name}: Present ${p}, Absent ${a}, Late ${l} — Attendance ${pct}%`);
    });

    if (hiddenCount > 0) {
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#E74C3C')
         .text(`Note: ${hiddenCount} additional date column(s) were omitted due to page width constraints.`);
    }

    doc.end();
  } catch (err) {
    console.error('Export PDF error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// POST /api/attendance/resend-confirmation
// Trainer/admin: issue fresh token and resend confirmation email
router.post('/resend-confirmation', async (req, res) => {
  try {
    const allowed = ['trainer', 'owner', 'co_owner', 'admin'];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { batchId, studentId, date } = req.body;
    if (!batchId || !studentId || !date) {
      return res.status(400).json({ error: 'batchId, studentId, date required' });
    }

    if (req.user.role === 'trainer') {
      const batch = getBatchForTrainer(batchId, req.user.id);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
    }

    const record = db.prepare(`
      SELECT a.*, u.name AS student_name, u.email AS student_email,
             b.name AS batch_name, t.title AS topic_title, t.notes AS topic_notes,
             trainer.name AS trainer_name
      FROM attendance a
      JOIN users u ON u.id = a.student_id
      JOIN batches b ON b.id = a.batch_id
      JOIN users trainer ON trainer.id = b.trainer_id
      LEFT JOIN topics t ON t.batch_id = a.batch_id AND t.date = a.date
      WHERE a.batch_id = ? AND a.student_id = ? AND a.date = ?
    `).get(batchId, studentId, date);

    if (!record) return res.status(404).json({ error: 'Attendance record not found' });
    if (!['present', 'late'].includes(record.status)) {
      return res.status(400).json({ error: 'Can only resend confirmation for present/late records' });
    }

    const newToken = crypto.randomUUID();
    db.prepare(`
      UPDATE attendance SET confirm_token = ?, confirmed_at = NULL, created_at = datetime('now')
      WHERE batch_id = ? AND student_id = ? AND date = ?
    `).run(newToken, batchId, studentId, date);

    const portalUrl = process.env.PORTAL_URL
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:5000');
    const confirmLink = `${portalUrl}/api/confirm-attendance/${newToken}`;
    const emailHtml = attendanceConfirmationEmail(
      record.student_name, date, record.topic_title || 'Class Session',
      null, null, record.trainer_name, record.batch_name, confirmLink,
      record.topic_notes, record.status
    );
    const emailSent = await sendEmail(
      record.student_email,
      `Re-sent: Attendance Confirmation — ${record.topic_title || 'Class Session'} — ${date}`,
      emailHtml
    );

    return res.json({ success: true, message: `Confirmation resent to ${record.student_email}`, emailSent });
  } catch (err) {
    console.error('Resend confirmation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/request-reconfirmation
// Student: notify trainer that confirmation link expired and needs resending
router.post('/request-reconfirmation', (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can request re-confirmation' });
    }
    const { batchId, date } = req.body;
    if (!batchId || !date) {
      return res.status(400).json({ error: 'batchId and date required' });
    }

    const enrollment = db.prepare('SELECT id FROM batch_students WHERE batch_id = ? AND student_id = ?').get(batchId, req.user.id);
    if (!enrollment) return res.status(404).json({ error: 'Not enrolled in this batch' });

    const record = db.prepare(`
      SELECT a.*, b.trainer_id FROM attendance a
      JOIN batches b ON b.id = a.batch_id
      WHERE a.batch_id = ? AND a.student_id = ? AND a.date = ?
    `).get(batchId, req.user.id, date);

    if (!record) return res.status(404).json({ error: 'Attendance record not found' });
    if (!['present', 'late'].includes(record.status)) {
      return res.status(400).json({ error: 'Can only request re-confirmation for present/late records' });
    }
    if (record.confirmed_at) {
      return res.status(400).json({ error: 'Attendance already confirmed' });
    }

    const hoursElapsed = (Date.now() - new Date(record.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < 24) {
      return res.status(400).json({ error: 'Confirmation link has not expired yet' });
    }

    const existingRequest = db.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND related_type = 'reconfirmation_request' AND related_id = ?`
    ).get(record.trainer_id, record.id);

    if (existingRequest) {
      return res.status(409).json({ error: 'Re-confirmation already requested' });
    }

    const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
      VALUES (?, ?, ?, 'info', 'reconfirmation_request', ?)
    `).run(
      record.trainer_id,
      `Re-confirmation Request — ${date}`,
      `${student?.name || 'A student'} has requested re-confirmation for their attendance on ${date}. Please resend their confirmation link.`,
      record.id
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Request reconfirmation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
