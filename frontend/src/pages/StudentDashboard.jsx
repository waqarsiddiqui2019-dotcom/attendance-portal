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
import { getMyBatches, getMyAttendance, requestReconfirmation, getTopics } from '../api/index.js'
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
  const [batchInfo, setBatchInfo] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [requestedDates, setRequestedDates] = useState(new Set())
  const [requestingDate, setRequestingDate] = useState(null)

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
      const [attRes, topicsRes] = await Promise.allSettled([
        getMyAttendance(batchId),
        getTopics(batchId),
      ])
      if (attRes.status === 'fulfilled') {
        setAttendance(attRes.value.data.records || [])
        setBatchInfo(attRes.value.data.batch || null)
      } else {
        toast.error('Failed to load attendance records')
      }
      if (topicsRes.status === 'fulfilled') {
        setTopics(topicsRes.value.data.topics || [])
      }
    } finally {
      setAttendanceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedBatchId) {
      fetchAttendance(selectedBatchId)
      setRequestedDates(new Set())
    }
  }, [selectedBatchId, fetchAttendance])

  function getTimeRemaining(createdAt) {
    if (!createdAt) return null
    const expiresAt = new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000)
    const remaining = expiresAt.getTime() - Date.now()
    if (remaining <= 0) return null
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    const pct = Math.round((remaining / (24 * 60 * 60 * 1000)) * 100)
    return { hours, minutes, pct }
  }

  const handleRequestReconfirmation = async (record) => {
    setRequestingDate(record.date)
    try {
      await requestReconfirmation({ batchId: selectedBatchId, date: record.date })
      setRequestedDates(prev => new Set([...prev, record.date]))
      toast.success('Re-confirmation requested. Your trainer will be notified.')
    } catch (err) {
      if (err.response?.status === 409) {
        setRequestedDates(prev => new Set([...prev, record.date]))
        toast('Re-confirmation already requested', { icon: 'ℹ️' })
      } else {
        toast.error(err.response?.data?.error || 'Failed to request re-confirmation')
      }
    } finally {
      setRequestingDate(null)
    }
  }

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

  const pendingConfirmations = attendance.filter(r => r.confirmation_status === 'pending')
  const expiredConfirmations = attendance.filter(r => r.confirmation_status === 'expired')

  // Calendar events: attendance + topics overlaid
  const topicsMap = {}
  topics.forEach(t => { topicsMap[t.date] = t })

  const calendarEvents = [
    ...attendance
      .filter((r) => r.date && r.status)
      .map((r) => {
        const cfg = STATUS_CONFIG[r.status?.toLowerCase()] || {}
        const cs = r.confirmation_status
        const badge = cs === 'confirmed' ? ' ✓' : cs === 'pending' ? ' ⏳' : cs === 'expired' ? ' ⚠️' : ''
        return {
          id: `att-${r.date}`,
          title: `${cfg.label || r.status}${badge}`,
          start: r.date?.split('T')[0] || r.date,
          backgroundColor: cfg.calColor || '#CBD5E1',
          borderColor: cfg.calBorder || '#94A3B8',
          textColor: '#fff',
        }
      }),
    ...topics.map(t => ({
      id: `topic-${t.date}`,
      title: `📚 ${t.title}`,
      start: t.date,
      backgroundColor: t.completion_status === 'covered' ? '#059669' : '#1B3A6B',
      borderColor: t.completion_status === 'covered' ? '#047857' : '#163058',
      textColor: '#fff',
    })),
  ]

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
          {/* Pending confirmation cards */}
          {pendingConfirmations.length > 0 && (
            <div className="mb-5 space-y-3">
              {pendingConfirmations.map(r => {
                const timeLeft = getTimeRemaining(r.created_at)
                return (
                  <div key={r.date} className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base leading-none">📧</span>
                      <p className="text-sm font-semibold text-amber-800">Attendance Confirmation Pending</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-700 mb-3">
                      <span><strong>Date:</strong> {format(parseISO(r.date), 'MMMM d, yyyy')}</span>
                      <span><strong>Status:</strong> {r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                      {r.topic_title && <span className="col-span-2"><strong>Topic:</strong> {r.topic_title}</span>}
                      {batchInfo?.trainer_name && <span className="col-span-2"><strong>Trainer:</strong> {batchInfo.trainer_name}</span>}
                    </div>
                    <p className="text-xs text-amber-700 mb-3">✉️ A confirmation email was sent to your registered address. Please check your inbox and click the link.</p>
                    {timeLeft ? (
                      <div>
                        <div className="flex items-center justify-between text-xs text-amber-700 mb-1.5">
                          <span>⏰ Expires in: <strong>{timeLeft.hours}h {timeLeft.minutes}m</strong></span>
                          <span>{timeLeft.pct}% remaining</span>
                        </div>
                        <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${timeLeft.pct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 font-medium">⏰ Expires soon</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Expired confirmation cards */}
          {expiredConfirmations.length > 0 && (
            <div className="mb-5 space-y-3">
              {expiredConfirmations.map(r => (
                <div key={r.date} className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base leading-none">⚠️</span>
                    <p className="text-sm font-semibold text-red-800">Confirmation Expired</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-red-700 mb-3">
                    <span><strong>Date:</strong> {format(parseISO(r.date), 'MMMM d, yyyy')}</span>
                    <span><strong>Status:</strong> {r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                    {r.topic_title && <span className="col-span-2"><strong>Topic:</strong> {r.topic_title}</span>}
                  </div>
                  <p className="text-xs text-red-700 mb-4">The 24-hour confirmation window has closed. Request re-confirmation from your trainer.</p>
                  {requestedDates.has(r.date) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Re-confirmation Requested
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRequestReconfirmation(r)}
                      disabled={requestingDate === r.date}
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition"
                    >
                      {requestingDate === r.date ? <Loader2 size={14} className="animate-spin" /> : null}
                      Request Re-confirmation from Trainer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

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
                        Topic
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
                            <td className="px-6 py-3.5 text-xs text-slate-500 max-w-[160px] truncate">
                              {record.topic_title || <span className="text-slate-300">—</span>}
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
                                record.confirmation_status === 'confirmed' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle size={11} /> Confirmed
                                  </span>
                                ) : record.confirmation_status === 'expired' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                    ⚠️ Expired
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
