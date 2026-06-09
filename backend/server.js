// Load .env before anything else (no dotenv package needed)
const fs = require('fs'), path = require('path');
try {
  fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8')
    .split('\n').forEach(line => {
      const [k, ...v] = line.trim().split('=');
      if (k && !k.startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
    });
} catch {}

const express = require('express');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const batchRoutes       = require('./routes/batches');
const studentRoutes     = require('./routes/students');
const attendanceRoutes  = require('./routes/attendance');
const ownerRoutes       = require('./routes/owner');
const topicsRoutes      = require('./routes/topics');
const topicSetsRoutes   = require('./routes/topic-sets');
const leavesRoutes        = require('./routes/leaves');
const appointmentsRoutes  = require('./routes/appointments');
const notificationsRoutes = require('./routes/notifications');
const messagesRoutes          = require('./routes/messages');
const confirmAttendanceRoutes = require('./routes/confirm-attendance');
const admissionsRoutes        = require('./routes/admissions');
const dailyLogRoutes          = require('./routes/daily-log');
const settingsRoutes          = require('./routes/settings');

// Start daily report cron scheduler
require('./utils/dailyReport');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL || '*'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/topic-sets', topicSetsRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/confirm-attendance', confirmAttendanceRoutes);
app.use('/api/admissions',        admissionsRoutes);
app.use('/api/daily-log',         dailyLogRoutes);
app.use('/api/settings',          settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Attendance Portal API is running' });
});

// Serve React frontend in production
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler (API routes only)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
