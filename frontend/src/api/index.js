import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('att_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
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

export const registerStudent = (data) => api.post('/auth/register-student', data)

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
