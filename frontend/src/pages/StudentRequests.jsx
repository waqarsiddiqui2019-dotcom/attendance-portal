import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  FileText, Calendar, Clock, AlertCircle, CheckCircle, XCircle, RotateCcw,
  Loader2, Plus, X, Info, BookOpen, TrendingUp, TrendingDown,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  getMyBatches, getLeaveBalance, getLeaveImpact, createLeave, getLeaves,
  cancelLeave, acceptCounter, declineCounter,
  getAppointments, createAppointment, cancelAppointment,
} from '../api/index.js'

// ── Constants ─────────────────────────────────────────────────────────────────
const LEAVE_TYPES = [
  { value: 'medical',   label: 'Medical Leave',    icon: '🏥' },
  { value: 'personal',  label: 'Personal Leave',   icon: '👤' },
  { value: 'emergency', label: 'Emergency Leave',  icon: '🚨' },
  { value: 'family',    label: 'Family Emergency', icon: '👨‍👩‍👧' },
  { value: 'other',     label: 'Other',            icon: '📝' },
]

const DURATION_OPTS = [
  { value: 30,  label: '30 minutes' },
  { value: 60,  label: '1 hour'     },
  { value: 90,  label: '1.5 hours'  },
  { value: 120, label: '2 hours'    },
]

const STATUS_LABELS = {
  pending:          { label: 'Pending',         color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400'  },
  approved:         { label: 'Approved',        color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  rejected:         { label: 'Rejected',        color: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500'   },
  counter_proposed: { label: 'Counter Proposed',color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'   },
  counter_accepted: { label: 'Accepted',        color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  counter_declined: { label: 'Declined',        color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400'  },
  cancelled:        { label: 'Cancelled',       color: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400'  },
  confirmed:           { label: 'Confirmed',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  declined:            { label: 'Declined',     color: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500'   },
  suggested:           { label: 'Time Suggested',color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  suggestion_accepted: { label: 'Confirmed',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  suggestion_declined: { label: 'Declined',     color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400'  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_LABELS[status] || { label: status, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Leave Balance Card ────────────────────────────────────────────────────────
function BalanceCard({ balance }) {
  if (!balance) return null
  const { informed_this_month, max_informed, uninformed_this_month, max_uninformed, remaining_informed, current_attendance_pct } = balance
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="text-center">
        <p className="text-lg font-bold text-slate-800">{informed_this_month}<span className="text-slate-400 font-normal text-sm">/{max_informed}</span></p>
        <p className="text-xs text-slate-500 mt-0.5">Informed Leaves</p>
      </div>
      <div className="text-center">
        <p className={`text-lg font-bold ${uninformed_this_month >= max_uninformed ? 'text-rose-600' : 'text-slate-800'}`}>
          {uninformed_this_month}<span className="text-slate-400 font-normal text-sm">/{max_uninformed}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5">Uninformed Absences</p>
      </div>
      <div className="text-center">
        <p className={`text-lg font-bold ${remaining_informed > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{remaining_informed}</p>
        <p className="text-xs text-slate-500 mt-0.5">Remaining</p>
      </div>
      <div className="text-center">
        <p className={`text-lg font-bold ${current_attendance_pct >= 80 ? 'text-emerald-600' : current_attendance_pct >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
          {current_attendance_pct}%
        </p>
        <p className="text-xs text-slate-500 mt-0.5">Attendance</p>
      </div>
    </div>
  )
}

// ── Leave Impact Card ─────────────────────────────────────────────────────────
function ImpactCard({ impact }) {
  if (!impact) return null
  const { class_days_affected, topics_missed, hours_missed, current_attendance_pct, worst_case_attendance_pct, at_risk } = impact
  return (
    <div className={`rounded-xl border p-4 mt-3 ${at_risk ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Leave Impact Preview</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-slate-500">Class days affected</p>
          <p className="font-bold text-slate-800">{class_days_affected} day{class_days_affected !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Content hours missed</p>
          <p className="font-bold text-slate-800">{hours_missed}h</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Current attendance</p>
          <p className="font-bold text-emerald-700">{current_attendance_pct}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">After this leave (worst case)</p>
          <p className={`font-bold ${at_risk ? 'text-rose-700' : 'text-emerald-700'}`}>
            {worst_case_attendance_pct}%
            {at_risk ? ' ⚠' : ' ✓'}
          </p>
        </div>
      </div>
      {at_risk && (
        <div className="flex items-start gap-2 bg-rose-100 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="text-rose-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-rose-700 font-medium">
            Your attendance may fall below 80%, which could affect certificate eligibility.
          </p>
        </div>
      )}
      {topics_missed.filter(t => t.title).length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Topics you'll miss:</p>
          <div className="space-y-1">
            {topics_missed.filter(t => t.title).slice(0, 4).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <BookOpen size={10} className="text-slate-400 flex-shrink-0" />
                <span>{t.title}</span>
                <span className="text-slate-400">({t.duration_hours}h)</span>
              </div>
            ))}
            {topics_missed.filter(t => t.title).length > 4 && (
              <p className="text-xs text-slate-400 pl-4">+{topics_missed.filter(t => t.title).length - 4} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Leave Form ────────────────────────────────────────────────────────────────
function LeaveForm({ batches, onSuccess }) {
  const [batchId, setBatchId]         = useState(batches[0]?.id || '')
  const [leaveType, setLeaveType]     = useState('personal')
  const [leaveNote, setLeaveNote]     = useState('')
  const [fromDate, setFromDate]       = useState('')
  const [toDate, setToDate]           = useState('')
  const [reason, setReason]           = useState('')
  const [balance, setBalance]         = useState(null)
  const [impact, setImpact]           = useState(null)
  const [impactLoading, setImpLoading] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const impactTimer                   = useRef(null)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    getLeaveBalance()
      .then(r => setBalance(r.data))
      .catch(() => {})
  }, [])

  // Auto-fetch impact when dates + batch change
  useEffect(() => {
    clearTimeout(impactTimer.current)
    setImpact(null)
    if (!batchId || !fromDate || !toDate || fromDate > toDate || fromDate < today) return
    setImpLoading(true)
    impactTimer.current = setTimeout(() => {
      getLeaveImpact({ from_date: fromDate, to_date: toDate, batch_id: batchId })
        .then(r => setImpact(r.data))
        .catch(() => {})
        .finally(() => setImpLoading(false))
    }, 600)
    return () => clearTimeout(impactTimer.current)
  }, [batchId, fromDate, toDate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fromDate || !toDate || !reason.trim()) { toast.error('Please fill all required fields'); return }
    if (reason.trim().length < 20) { toast.error('Reason must be at least 20 characters'); return }
    if (fromDate < today) { toast.error('Cannot apply leave for past dates'); return }
    setSubmitting(true)
    try {
      await createLeave({ batch_id: batchId, leave_type: leaveType, leave_type_note: leaveNote || null, from_date: fromDate, to_date: toDate, reason: reason.trim() })
      toast.success('Leave request submitted ✅')
      setFromDate(''); setToDate(''); setReason(''); setLeaveNote(''); setImpact(null)
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit leave request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <BalanceCard balance={balance} />

      {batches.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Batch *</label>
          <select value={batchId} onChange={e => setBatchId(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Leave Type *</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LEAVE_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => setLeaveType(t.value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                leaveType === t.value ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-[#1B3A6B]/40'
              } ${t.value === 'emergency' && leaveType === 'emergency' ? 'ring-2 ring-rose-400' : ''}`}>
              <span>{t.icon}</span> <span>{t.label}</span>
            </button>
          ))}
        </div>
        {leaveType === 'other' && (
          <input value={leaveNote} onChange={e => setLeaveNote(e.target.value)} placeholder="Brief description..."
            className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">From Date *</label>
          <input type="date" value={fromDate} min={today} onChange={e => setFromDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">To Date *</label>
          <input type="date" value={toDate} min={fromDate || today} onChange={e => setToDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
      </div>

      {impactLoading && (
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Loader2 size={12} className="animate-spin" /> Calculating impact…
        </div>
      )}
      <ImpactCard impact={impact} />

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Reason * <span className="text-slate-400 font-normal">(min 20 characters — {reason.length} typed)</span>
        </label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain your reason for leave..."
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        {reason.length > 0 && reason.length < 20 && (
          <p className="text-xs text-rose-500 mt-1">{20 - reason.length} more characters needed</p>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 flex items-start gap-2">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-slate-400" />
        <span>Note: Document uploads are not available. Mention any relevant documents in your reason.</span>
      </div>

      <button type="submit" disabled={submitting || !fromDate || !toDate || reason.trim().length < 20}
        className="w-full bg-[#1B3A6B] hover:bg-[#163058] text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition flex items-center justify-center gap-2">
        {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Plus size={16} /> Submit Leave Request</>}
      </button>
    </form>
  )
}

// ── Appointment Form ──────────────────────────────────────────────────────────
function AppointmentForm({ batches, onSuccess }) {
  const [batchId, setBatchId]       = useState(batches[0]?.id || '')
  const [prefDate, setPrefDate]     = useState('')
  const [prefTime, setPrefTime]     = useState('10:00')
  const [duration, setDuration]     = useState(60)
  const [topic, setTopic]           = useState('')
  const [mode, setMode]             = useState('online')
  const [submitting, setSubmitting] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prefDate || !topic.trim()) { toast.error('Please fill all required fields'); return }
    setSubmitting(true)
    try {
      await createAppointment({ batch_id: batchId, preferred_date: prefDate, preferred_time: prefTime, duration_minutes: duration, topic_question: topic.trim(), mode })
      toast.success('Appointment request submitted ✅')
      setPrefDate(''); setTopic('')
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {batches.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Batch *</label>
          <select value={batchId} onChange={e => setBatchId(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preferred Date *</label>
          <input type="date" value={prefDate} min={today} onChange={e => setPrefDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preferred Time *</label>
          <input type="time" value={prefTime} onChange={e => setPrefTime(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTS.map(d => (
            <button key={d.value} type="button" onClick={() => setDuration(d.value)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${
                duration === d.value ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]' : 'bg-white border-slate-200 text-slate-700 hover:border-[#1B3A6B]/40'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Topic / Question *</label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3}
          placeholder="What would you like to discuss or get help with?"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mode</label>
        <div className="flex gap-3">
          {[{v:'online',l:'💻 Online'},{v:'in_person',l:'🏫 In Person'}].map(m => (
            <label key={m.v} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input type="radio" checked={mode === m.v} onChange={() => setMode(m.v)} className="accent-primary" />
              {m.l}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={submitting || !prefDate || !topic.trim()}
        className="w-full bg-[#2272B9] hover:bg-[#1B3A6B] text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition flex items-center justify-center gap-2">
        {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Calendar size={16} /> Request Appointment</>}
      </button>
    </form>
  )
}

// ── History Table ─────────────────────────────────────────────────────────────
function HistoryTab({ leaves, appointments, onAction }) {
  const [actionLoading, setActionLoading] = useState({})

  const doAction = async (fn, id, successMsg) => {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    try {
      await fn(id)
      toast.success(successMsg)
      onAction()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const all = [
    ...leaves.map(l => ({ ...l, _type: 'leave' })),
    ...appointments.map(a => ({ ...a, _type: 'appointment' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <FileText size={32} className="mb-3 text-slate-300" />
        <p className="text-sm font-medium">No requests yet</p>
        <p className="text-xs mt-1">Use the tabs above to submit leave or appointment requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {all.map(item => {
        const isLeave = item._type === 'leave'
        const loading = actionLoading[item.id + item._type]
        return (
          <div key={`${item._type}-${item.id}`}
            className={`bg-white border rounded-2xl p-4 ${
              isLeave && item.leave_type === 'emergency' && item.status === 'pending'
                ? 'border-rose-300 bg-rose-50/30'
                : 'border-slate-200'
            }`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isLeave ? (LEAVE_TYPES.find(t => t.value === item.leave_type)?.icon + ' ' + item.leave_type?.replace('_', ' ')) : '📅 Appointment'}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="font-semibold text-slate-800 text-sm mt-1">
                  {isLeave
                    ? `${item.from_date} → ${item.to_date}`
                    : `${item.preferred_date} at ${item.preferred_time} (${item.duration_minutes}min)`
                  }
                </p>
                {isLeave && item.batch_name && <p className="text-xs text-slate-500 mt-0.5">Batch: {item.batch_name}</p>}
                {!isLeave && item.topic_question && <p className="text-xs text-slate-500 mt-0.5 truncate">{item.topic_question}</p>}
                {item.rejection_reason && <p className="text-xs text-rose-600 mt-1 font-medium">Reason: {item.rejection_reason}</p>}
                {item.trainer_note && <p className="text-xs text-slate-600 mt-1">Trainer: {item.trainer_note}</p>}
                {/* Counter proposal info */}
                {item.status === 'counter_proposed' && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-blue-800">Counter Proposal:</p>
                    <p className="text-blue-700">{item.counter_from_date} → {item.counter_to_date}</p>
                    {item.counter_message && <p className="text-blue-600 mt-0.5">{item.counter_message}</p>}
                  </div>
                )}
                {/* Appointment suggestion */}
                {item.status === 'suggested' && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-blue-800">Suggested Time:</p>
                    <p className="text-blue-700">{item.suggested_date} at {item.suggested_time}</p>
                    {item.trainer_note && <p className="text-blue-600 mt-0.5">{item.trainer_note}</p>}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {/* Cancel */}
                {item.status === 'pending' && (
                  <button
                    onClick={() => doAction(isLeave ? cancelLeave : cancelAppointment, item.id, 'Cancelled')}
                    disabled={loading}
                    className="text-xs text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-300 px-3 py-1.5 rounded-lg transition">
                    Cancel
                  </button>
                )}
                {/* Counter proposal actions */}
                {isLeave && item.status === 'counter_proposed' && (
                  <div className="flex gap-2">
                    <button onClick={() => doAction(acceptCounter, item.id, 'Counter proposal accepted ✅')} disabled={loading}
                      className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition">
                      Accept
                    </button>
                    <button onClick={() => doAction(declineCounter, item.id, 'Counter proposal declined')} disabled={loading}
                      className="text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition">
                      Decline
                    </button>
                  </div>
                )}
                {/* Appointment suggestion actions */}
                {!isLeave && item.status === 'suggested' && (
                  <div className="flex gap-2">
                    <button onClick={() => doAction(acceptApptSuggestion, item.id, 'Time accepted ✅')} disabled={loading}
                      className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition">
                      Accept
                    </button>
                    <button onClick={() => doAction(declineApptSuggestion, item.id, 'Suggestion declined')} disabled={loading}
                      className="text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition">
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentRequests() {
  const [tab, setTab]                   = useState('leave')
  const [batches, setBatches]           = useState([])
  const [leaves, setLeaves]             = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)

  const loadData = useCallback(() => {
    Promise.all([getLeaves(), getAppointments()])
      .then(([l, a]) => { setLeaves(l.data.leaves || []); setAppointments(a.data.appointments || []) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    getMyBatches()
      .then(r => setBatches(r.data.batches || []))
      .catch(console.error)
      .finally(() => setLoading(false))
    loadData()
  }, [loadData])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 text-[#1B3A6B] animate-spin" />
    </div>
  )

  if (batches.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
      <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
      <h3 className="text-lg font-semibold text-slate-700 mb-2">Not enrolled in any batch</h3>
      <p className="text-slate-400 text-sm">Please contact your trainer to be added to a batch before submitting requests.</p>
    </div>
  )

  const TABS = [
    { id: 'leave',       label: '🏖 Apply Leave',         count: null },
    { id: 'appointment', label: '📅 Request Appointment',  count: null },
    { id: 'history',     label: '📋 My History',           count: leaves.length + appointments.length },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Requests</h1>
        <p className="text-slate-500 text-sm mt-1">Submit leave and appointment requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
            {t.count > 0 && <span className="text-xs bg-[#1B3A6B] text-white rounded-full px-1.5 py-0.5">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {tab === 'leave' && <LeaveForm batches={batches} onSuccess={() => { loadData(); setTab('history') }} />}
        {tab === 'appointment' && <AppointmentForm batches={batches} onSuccess={() => { loadData(); setTab('history') }} />}
        {tab === 'history' && <HistoryTab leaves={leaves} appointments={appointments} onAction={loadData} />}
      </div>
    </div>
  )
}
