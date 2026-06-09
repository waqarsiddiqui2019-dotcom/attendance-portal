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
import TopicsLibrary          from './pages/TopicsLibrary.jsx'
import OwnerCalendars         from './pages/OwnerCalendars.jsx'
import OwnerStudentCalendar   from './pages/OwnerStudentCalendar.jsx'
import OwnerTrainerCalendar   from './pages/OwnerTrainerCalendar.jsx'
import StudentRequests        from './pages/StudentRequests.jsx'
import TrainerRequests        from './pages/TrainerRequests.jsx'
import OwnerLeaveLog          from './pages/OwnerLeaveLog.jsx'
import Messages               from './pages/Messages.jsx'
import OwnerStaff             from './pages/OwnerStaff.jsx'
import OwnerStudents          from './pages/OwnerStudents.jsx'
import OwnerAdmissions        from './pages/OwnerAdmissions.jsx'
import OwnerDailyLog          from './pages/OwnerDailyLog.jsx'
import ResetPassword          from './pages/ResetPassword.jsx'

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login"                element={<Login />} />
        <Route path="/trainer-signup"       element={<TrainerSignup />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Owner routes */}
        <Route path="/owner" element={<ProtectedRoute role="owner"><OwnerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/owner/dashboard" replace />} />
          <Route path="dashboard"       element={<OwnerDashboard />} />
          <Route path="team"            element={<OwnerTeam />} />
          <Route path="batches"         element={<OwnerBatches />} />
          <Route path="topics-library"               element={<TopicsLibrary />} />
          <Route path="calendars"                    element={<OwnerCalendars />} />
          <Route path="calendars/student/:studentId" element={<OwnerStudentCalendar />} />
          <Route path="calendars/trainer/:trainerId" element={<OwnerTrainerCalendar />} />
          <Route path="leave-log"                    element={<OwnerLeaveLog />} />
          <Route path="messages"                     element={<Messages />} />
          <Route path="staff"                        element={<OwnerStaff />} />
          <Route path="students"                     element={<OwnerStudents />} />
          <Route path="admissions"                   element={<OwnerAdmissions />} />
          <Route path="daily-log"                    element={<OwnerDailyLog />} />
        </Route>

        {/* Trainer routes */}
        <Route path="/trainer" element={<ProtectedRoute role="trainer"><TrainerLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/trainer/dashboard" replace />} />
          <Route path="dashboard"           element={<TrainerDashboard />} />
          <Route path="batches"             element={<Batches />} />
          <Route path="batches/:id"         element={<BatchDetail />} />
          <Route path="calendar/:batchId"   element={<AttendanceCalendar />} />
          <Route path="topics-library"      element={<TopicsLibrary />} />
          <Route path="requests"            element={<TrainerRequests />} />
          <Route path="messages"            element={<Messages />} />
        </Route>

        {/* Student routes */}
        <Route path="/student" element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="requests"  element={<StudentRequests />} />
          <Route path="messages"  element={<Messages />} />
        </Route>

        {/* Default */}
        <Route path="/"  element={<Navigate to="/login" replace />} />
        <Route path="*"  element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
    </ErrorBoundary>
  )
}
