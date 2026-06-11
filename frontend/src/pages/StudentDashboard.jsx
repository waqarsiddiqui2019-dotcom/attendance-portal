import React, { useEffect, useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  CalendarDays,
  Loader2,
  BookOpen,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { getMyBatches, getMyAttendance } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

const STATUS_CONFIG = {
  present: {
    label: 'Present',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    calColor: '#10B981',
    calBorder: '#059669',
    icon: CheckCircle,
  },
  absent: {
    label: 'Absent',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    calColor: '#F43F5E',
    calBorder: '#E11D48',
    icon: XCircle,
  },
  late: {
    label: 'Late',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    calColor: '#F59E0B',
    calBorder: '#D97706',
    icon: Clock,
  },
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  // Fetch enrolled batches
  useEffect(() => {
    getMyBatches()
      .then((res) => {
        const list = res.data.batches || res.data || []
        setBatches(list)
        if (list.length >= 1) {
          setSelectedBatchId(list[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Fetch attendance when batch changes
  const fetchAttendance = useCallback(async (batchId) => {
    if (!batchId) return
    setAttendanceLoading(true)
    try {
      const res = await getMyAttendance(batchId)
      setAttendance(res.data.records || res.data || [])
    } catch (err) {
      toast.error('Failed to load attendance records')
    } finally {
      setAttendanceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedBatchId) fetchAttendance(selectedBatchId)
  }, [selectedBatchId, fetchAttendance])

  // Compute stats
  const stats = attendance.reduce(
    (acc, r) => {
      const s = r.status?.toLowerCase()
      if (s === 'present') acc.present++
      else if (s === 'absent') acc.absent++
      else if (s === 'late') acc.late++
      return acc
    },
    { present: 0, absent: 0, late: 0 }
  )

  const total = stats.present + stats.absent + stats.late
  const percentage =
    total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : 0

  // Calendar events
  const calendarEvents = attendance
    .filter((r) => r.date && r.status)
    .map((r) => {
      const cfg = STATUS_CONFIG[r.status?.toLowerCase()] || {}
      const confirmable = ['present', 'late'].includes(r.status?.toLowerCase())
      const confirmed   = confirmable && r.confirmed_at
      return {
        id: r.date,
        title: confirmed ? `${cfg.label || r.status} ✓` : (cfg.label || r.status),
        start: r.date?.split('T')[0] || r.date,
        backgroundColor: cfg.calColor || '#CBD5E1',
        borderColor: cfg.calBorder || '#94A3B8',
        textColor: '#fff',
      }
    })

  const formatDate = (d) => {
    try {
      return d ? format(parseISO(d.split('T')[0]), 'MMM d, yyyy') : '—'
    } catch {
      return '—'
    }
  }

  const statCards = [
    {
      key: 'present',
      label: 'Present Days',
      value: stats.present,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      key: 'absent',
      label: 'Absent Days',
      value: stats.absent,
      icon: XCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-50',
    },
    {
      key: 'late',
      label: 'Late Arrivals',
      value: stats.late,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
    {
      key: 'pct',
      label: 'Attendance %',
      value: `${percentage}%`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary-light',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome, {user?.name?.split(' ')[0] || 'Student'}!
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")} — Here's your attendance overview
        </p>
      </div>

      {/* Batch selector */}
      {batches.length > 1 && (
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Batch
          </label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="w-full sm:w-80 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white transition"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-brand-blue" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Not enrolled in any batch
          </h3>
          <p className="text-slate-400 text-sm text-center max-w-xs">
            Please contact your trainer to be added to a batch.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.key}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className={`w-11 h-11 ${s.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-slate-800 mb-0.5">{s.value}</p>
                  <p className="text-sm text-slate-500">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">
                  Overall Attendance
                </span>
                <span
                  className={`text-sm font-bold ${
                    percentage >= 75
                      ? 'text-emerald-600'
                      : percentage >= 50
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {percentage}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    percentage >= 75
                      ? 'bg-emerald-500'
                      : percentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {stats.present + stats.late} attended out of {total} total days
              </p>
            </div>
          )}

          {/* Calendar */}
          {attendanceLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 flex items-center justify-center mb-6">
              <Loader2 className="w-7 h-7 text-brand-blue animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CalendarDays size={17} className="text-brand-blue" />
                Attendance Calendar
              </h2>
              <FullCalendar
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: '',
                }}
                height="auto"
                eventDisplay="block"
                dayMaxEvents={2}
              />
            </div>
          )}

          {/* Attendance table */}
          <div className="bg-white rounded-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Attendance Records</h2>
            </div>

            {attendanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-brand-blue animate-spin" />
              </div>
            ) : attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CalendarDays className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Date
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Status
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                        Confirmation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...attendance]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((record, i) => {
                        const cfg = STATUS_CONFIG[record.status?.toLowerCase()] || {}
                        const confirmable = ['present', 'late'].includes(record.status?.toLowerCase())
                        return (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3.5 text-sm font-medium text-slate-700">
                              {formatDate(record.date)}
                            </td>
                            <td className="px-6 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge || 'bg-slate-100 text-slate-600'}`}
                              >
                                {cfg.icon && <cfg.icon size={12} />}
                                {cfg.label || record.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              {confirmable ? (
                                record.confirmed_at ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle size={11} /> Confirmed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                    <Clock size={11} /> Pending
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
