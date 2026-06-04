import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TrainerLayout from './components/TrainerLayout.jsx'
import StudentLayout from './components/StudentLayout.jsx'
import OwnerLayout   from './components/OwnerLayout.jsx'

import Login              from './pages/Login.jsx'
import TrainerSignup      from './pages/TrainerSignup.jsx'
import TrainerDashboard   from './pages/TrainerDashboard.jsx'
import Batches            from './pages/Batches.jsx'
import BatchDetail        from './pages/BatchDetail.jsx'
import AttendanceCalendar from './pages/AttendanceCalendar.jsx'
import StudentDashboard   from './pages/StudentDashboard.jsx'
import OwnerDashboard     from './pages/OwnerDashboard.jsx'
import OwnerTeam          from './pages/OwnerTeam.jsx'
import OwnerBatches       from './pages/OwnerBatches.jsx'
import TopicsLibrary      from './pages/TopicsLibrary.jsx'

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<Login />} />
        <Route path="/trainer-signup"  element={<TrainerSignup />} />

        {/* Owner routes */}
        <Route path="/owner" element={<ProtectedRoute role="owner"><OwnerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/owner/dashboard" replace />} />
          <Route path="dashboard"       element={<OwnerDashboard />} />
          <Route path="team"            element={<OwnerTeam />} />
          <Route path="batches"         element={<OwnerBatches />} />
          <Route path="topics-library"  element={<TopicsLibrary />} />
        </Route>

        {/* Trainer routes */}
        <Route path="/trainer" element={<ProtectedRoute role="trainer"><TrainerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/trainer/dashboard" replace />} />
          <Route path="dashboard"           element={<TrainerDashboard />} />
          <Route path="batches"             element={<Batches />} />
          <Route path="batches/:id"         element={<BatchDetail />} />
          <Route path="calendar/:batchId"   element={<AttendanceCalendar />} />
          <Route path="topics-library"      element={<TopicsLibrary />} />
        </Route>

        {/* Student routes */}
        <Route path="/student" element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
        </Route>

        {/* Default */}
        <Route path="/"  element={<Navigate to="/login" replace />} />
        <Route path="*"  element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
    </ErrorBoundary>
  )
}
