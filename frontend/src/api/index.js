import axios from 'axios'
import { analyzeError } from '../utils/errorAnalyzer.js'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attach bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('att_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — pre-analyze ALL errors so components get friendly messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const page = typeof window !== 'undefined' ? window.location.pathname : ''
    // Attach analysis so components can use error.analyzed instead of raw error
    error.analyzed = analyzeError(error, { page })

    if (error.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post('/auth/login', { email, password })

export const getMe = () => api.get('/auth/me')

export const trainerSignup = (data) => api.post('/auth/trainer-signup', data)

export const registerStudent = (data) => api.post('/auth/register-student', data)

// ── Owner ─────────────────────────────────────────────────────────────────────
export const getOwnerStats    = ()       => api.get('/owner/stats')
export const getOwnerTrainers = ()       => api.get('/owner/trainers')
export const approveTrainer   = (id)     => api.put(`/owner/trainers/${id}/approve`)
export const rejectTrainer    = (id)     => api.put(`/owner/trainers/${id}/reject`)
export const deleteTrainer    = (id)     => api.delete(`/owner/trainers/${id}`)
export const getOwnerBatches  = ()       => api.get('/owner/batches')

// ── Batches ───────────────────────────────────────────────────────────────────
export const getBatches = () => api.get('/batches')

export const createBatch = (data) => api.post('/batches', data)

export const getBatch = (id) => api.get(`/batches/${id}`)

export const updateBatch = (id, data) => api.put(`/batches/${id}`, data)

export const deleteBatch = (id) => api.delete(`/batches/${id}`)

// ── Students ──────────────────────────────────────────────────────────────────
export const getMyBatches = () => api.get('/students/my-batches')

export const getStudents = (batchId) => api.get(`/students/batch/${batchId}`)

export const addStudent = (batchId, data) =>
  api.post(`/students/batch/${batchId}`, data)

export const removeStudent = (batchId, studentId) =>
  api.delete(`/students/batch/${batchId}/${studentId}`)

// ── Attendance ────────────────────────────────────────────────────────────────
export const getAttendanceByDate = (batchId, date) =>
  api.get(`/attendance/batch/${batchId}/date/${date}`)

export const markAttendance = (batchId, data) =>
  api.post(`/attendance/batch/${batchId}`, data)

export const getCalendarData = (batchId, month) =>
  api.get(`/attendance/batch/${batchId}/calendar?month=${month}`)

export const getAttendanceSummary = (batchId) =>
  api.get(`/attendance/batch/${batchId}/summary`)

export const getMyAttendance = (batchId) =>
  api.get(`/attendance/student/my-attendance/${batchId}`)

// ── Calendar Topics ───────────────────────────────────────────────────────────
export const getTopics = (batchId, month) =>
  api.get(`/topics/batch/${batchId}${month ? `?month=${month}` : ''}`)

export const saveTopic = (batchId, data) =>
  api.post(`/topics/batch/${batchId}`, data)

export const deleteTopic = (batchId, date) =>
  api.delete(`/topics/batch/${batchId}/date/${date}`)

// ── Syllabus ──────────────────────────────────────────────────────────────────
export const getSyllabus = (batchId) =>
  api.get(`/topics/batch/${batchId}/syllabus`)

export const saveSyllabus = (batchId, topics) =>
  api.post(`/topics/batch/${batchId}/syllabus`, { topics })

export const distributeTopics = (batchId, assignments) =>
  api.post(`/topics/batch/${batchId}/distribute`, { assignments })

export const toggleTopicComplete = (batchId, date) =>
  api.patch(`/topics/batch/${batchId}/date/${date}/toggle-complete`)

// ── Owner Calendars ───────────────────────────────────────────────────────────
export const getOwnerStudents      = ()           => api.get('/owner/students')
export const getStudentCalendar    = (id, month)  => api.get(`/owner/student/${id}/calendar?month=${month}`)
export const getTrainerCalendar    = (id, month)  => api.get(`/owner/trainer/${id}/calendar?month=${month}`)
export const getHolidays           = ()           => api.get('/owner/holidays')
export const createHoliday         = (data)       => api.post('/owner/holidays', data)
export const deleteHoliday         = (id)         => api.delete(`/owner/holidays/${id}`)

// ── Topic Sets (Library) ──────────────────────────────────────────────────────
export const getTopicSets = () => api.get('/topic-sets')
export const createTopicSet = (data) => api.post('/topic-sets', data)
export const updateTopicSet = (id, data) => api.put(`/topic-sets/${id}`, data)
export const deleteTopicSet = (id) => api.delete(`/topic-sets/${id}`)
export const getTopicSetItems = (id) => api.get(`/topic-sets/${id}/items`)
export const saveTopicSetItems = (id, items) => api.post(`/topic-sets/${id}/items`, { items })

// ── Leaves ────────────────────────────────────────────────────────────────────
export const getLeaves            = ()          => api.get('/leaves')
export const getLeave             = (id)        => api.get(`/leaves/${id}`)
export const getLeaveBalance      = ()          => api.get('/leaves/balance')
export const getLeaveImpact       = (params)    => api.get('/leaves/impact', { params })
export const getLeavePendingCount = ()          => api.get('/leaves/pending-count')
export const createLeave          = (data)      => api.post('/leaves', data)
export const approveLeave         = (id, data)  => api.put(`/leaves/${id}/approve`, data)
export const rejectLeave          = (id, data)  => api.put(`/leaves/${id}/reject`, data)
export const counterLeave         = (id, data)  => api.put(`/leaves/${id}/counter`, data)
export const acceptCounter        = (id)        => api.put(`/leaves/${id}/accept-counter`)
export const declineCounter       = (id)        => api.put(`/leaves/${id}/decline-counter`)
export const cancelLeave          = (id)        => api.put(`/leaves/${id}/cancel`)

// ── Appointments ──────────────────────────────────────────────────────────────
export const getAppointments       = ()         => api.get('/appointments')
export const getAppointment        = (id)       => api.get(`/appointments/${id}`)
export const getApptPendingCount   = ()         => api.get('/appointments/pending-count')
export const createAppointment     = (data)     => api.post('/appointments', data)
export const confirmAppointment    = (id, data) => api.put(`/appointments/${id}/confirm`, data)
export const declineAppointment    = (id, data) => api.put(`/appointments/${id}/decline`, data)
export const suggestAppointment    = (id, data) => api.put(`/appointments/${id}/suggest`, data)
export const acceptApptSuggestion  = (id)       => api.put(`/appointments/${id}/accept-suggestion`)
export const declineApptSuggestion = (id)       => api.put(`/appointments/${id}/decline-suggestion`)
export const cancelAppointment     = (id)       => api.put(`/appointments/${id}/cancel`)

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications     = ()   => api.get('/notifications')
export const getUnreadCount       = ()   => api.get('/notifications/unread-count')
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`)
export const markAllRead          = ()   => api.put('/notifications/read-all')

// ── Owner Leaves ──────────────────────────────────────────────────────────────
export const getOwnerLeaveStats  = ()       => api.get('/owner/leave-stats')
export const getOwnerLeaves      = (params) => api.get('/owner/leaves', { params })
export const getOwnerTrainerStats = ()      => api.get('/owner/trainer-stats')
export const getOwnerLeaveAlerts  = ()      => api.get('/owner/leave-alerts')

// ── Owner Staff ───────────────────────────────────────────────────────────────
export const getOwnerStaff            = ()            => api.get('/owner/staff')
export const createStaff              = (data)        => api.post('/owner/staff', data)
export const updateStaffPermissions   = (id, data)    => api.put(`/owner/staff/${id}/permissions`, data)
export const deleteStaff              = (id)          => api.delete(`/owner/staff/${id}`)

// ── Messages ──────────────────────────────────────────────────────────────────
export const getMessageContacts   = ()                   => api.get('/messages/contacts')
export const getMessageThread     = (userId)             => api.get(`/messages/thread/${userId}`)
export const sendMessage          = (data)               => api.post('/messages', data)
export const getMessageUnreadCount = ()                  => api.get('/messages/unread-count')
export const markMessagesRead     = (userId)             => api.put(`/messages/read/${userId}`)
export const getMessageAllLogs    = ()                   => api.get('/messages/all-logs')
export const getAdminConversation = (u1, u2)             => api.get(`/messages/conversation/${u1}/${u2}`)
