const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const ownerRoutes = require('./routes/owner');
const topicsRoutes = require('./routes/topics');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/topics', topicsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Attendance Portal API is running' });
});

// 404 handler
app.use((req, res) => {
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
