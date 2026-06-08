import React, { useEffect, useState, useCallback } from 'react'
import {
  FileText, Calendar, ChevronLeft, CheckCircle, XCircle, RotateCcw,
  Loader2, Users, AlertCircle, BookOpen, TrendingDown, TrendingUp, Clock, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getLeaves, getLeave, approveLeave, rejectLeave, counterLeave,
  getAppointments, getAppointment, confirmAppointment, declineAppointment, suggestAppointment,
} from '../api/index.js'

// ── Constants ─────────────────────────────────────────────────────────────────
const LEAVE_ICONS = { medical:'🏥', personal:'👤', emergency:'🚨', family:'👨‍👩‍👧', other:'📝' }

const STATUS_COLORS = {
  pending:          'bg-amber-100 text-amber-700',
  approved:         'bg-emerald-100 text-emerald-700',
  rejected:         'bg-rose-100 text-rose-700',
  counter_proposed: 'bg-blue-100 text-blue-700',
  counter_accepted: 'bg-emerald-100 text-emerald-700',
  counter_declined: 'bg-slate-100 text-slate-600',
  cancelled:        'bg-slate-100 text-slate-500',
  confirmed:           'bg-emerald-100 text-emerald-700',
  declined:            'bg-rose-100 text-rose-700',
  suggested:           'bg-blue-100 text-blue-700',
  suggestion_accepted: 'bg-emerald-100 text-emerald-700',
  suggestion_declined: 'bg-slate-100 text-slate-600',
}

const STATUS_LABELS = {
  pending:'Pending', approved:'Approved', rejected:'Rejected',
  counter_proposed:'Counter Proposed', counter_accepted:'Counter Accepted',
  counter_declined:'Counter Declined', cancelled:'Cancelled',
  confirmed:'Confirmed', declined:'Declined', suggested:'Time Suggested',
  suggestion_accepted:'Suggestion Accepted', suggestion_declined:'Suggestion Declined',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Leave Detail View ─────────────────────────────────────────────────────────
function LeaveDetail({ leaveId, onBack, onActionDone }) {
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [action, setAction]           = useState(null) // 'approve'|'reject'|'counter'
  const [trainerNote, setTrainerNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [counterFrom, setCounterFrom] = useState('')
  const [counterTo, setCounterTo]     = useState('')
  const [counterMsg, setCounterMsg]   = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    setLoading(true)
    getLeave(leaveId)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load leave details'))
      .finally(() => setLoading(false))
  }, [leaveId])

  const handleApprove = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await approveLeave(leaveId, { trainer_note: trainerNote })
      toast.success('Leave approved ✅')
      onActionDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to approve') }
    finally { setSubmitting(false) }
  }

  const handleReject = async () => {
    if (rejectReason.trim().length < 30) { toast.error('Rejection reason must be at least 30 characters'); return }
    setSubmitting(true)
    try {
      await rejectLeave(leaveId, { rejection_reason: rejectReason })
      toast.success('Leave rejected')
      onActionDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to reject') }
    finally { setSubmitting(false) }
  }

  const handleCounter = async () => {
    if (!counterFrom || !counterTo || !counterMsg.trim()) { toast.error('All counter proposal fields are required'); return }
    setSubmitting(true)
    try {
      await counterLeave(leaveId, { counter_from_date: counterFrom, counter_to_date: counterTo, counter_message: counterMsg })
      toast.success('Counter proposal sent ✅')
      onActionDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send counter') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-[#1B3A6B] animate-spin" /></div>
  if (!data) return null

  const { leave, attendance, impact, balance } = data
  const lr = leave
  const isActionable = ['pending', 'counter_proposed'].includes(lr.status)

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 font-medium transition">
        <ChevronLeft size={16} /> Back to Requests
      </button>

      <div className={`grid lg:grid-cols-2 gap-5 ${lr.leave_type === 'emergency' ? 'ring-2 ring-rose-400 rounded-2xl p-4 bg-rose-50' : ''}`}>
        {lr.leave_type === 'emergency' && (
          <div className="lg:col-span-2 flex items-center gap-2 bg-rose-100 border border-rose-300 rounded-xl px-4 py-2">
            <AlertCircle size={15} className="text-rose-600" />
            <span className="text-sm font-semibold text-rose-800">🚨 Emergency Leave — requires urgent attention</span>
          </div>
        )}

        {/* Left: Student Profile */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-4 uppercase tracking-wider">Student Profile</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#2272B9] flex items-center justify-center text-white font-bold">
              {lr.student?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{lr.student?.name}</p>
              <p className="text-xs text-slate-500">{lr.student?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center mb-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xl font-bold text-slate-800">{attendance?.pct || 0}%</p>
              <p className="text-xs text-slate-500">Attendance</p>
            </div>
            <div className={`rounded-xl p-3 ${(attendance?.pct || 0) >= 80 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <p className={`text-xs font-bold ${(attendance?.pct || 0) >= 80 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {(attendance?.pct || 0) >= 80 ? '✓ Eligible' : '⚠ At Risk'}
              </p>
              <p className="text-xs text-slate-500">Certificate</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
            {[['Present', attendance?.present ?? 0, 'text-emerald-600'], ['Absent', attendance?.absent ?? 0, 'text-rose-600'], ['Late', attendance?.late ?? 0, 'text-amber-600']].map(([l, v, c]) => (
              <div key={l}>
                <p className={`font-bold text-base ${c}`}>{v}</p>
                <p className="text-slate-400">{l}</p>
              </div>
            ))}
          </div>

          {balance && (
            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-600 mb-2">This Month</p>
              <div className="flex justify-between"><span className="text-slate-500">Informed leaves</span><span className="font-medium">{balance.informed_this_month}/{balance.max_informed}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Uninformed absences</span><span className={`font-medium ${balance.uninformed_this_month >= balance.max_uninformed ? 'text-rose-600' : ''}`}>{balance.uninformed_this_month}/{balance.max_uninformed}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Remaining leaves</span><span className="font-medium text-emerald-600">{balance.remaining_informed}</span></div>
            </div>
          )}
        </div>

        {/* Right: Request Details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Request Details</h3>
            <StatusBadge status={lr.status} />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Leave Type</span>
              <span className="font-medium">{LEAVE_ICONS[lr.leave_type]} {lr.leave_type?.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dates</span>
              <span className="font-medium">{lr.from_date} → {lr.to_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Batch</span>
              <span className="font-medium">{lr.batch?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted</span>
              <span className="font-medium">{fmtDate(lr.created_at?.slice(0, 10))}</span>
            </div>
          </div>

          <div className="mt-3 bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Student Reason</p>
            <p className="text-sm text-slate-700">{lr.reason}</p>
          </div>

          {impact && impact.class_days > 0 && (
            <div className={`mt-3 rounded-xl p-3 text-xs ${impact.worst_pct < 80 ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className="font-semibold text-slate-700 mb-2">Leave Impact</p>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-slate-500">Class days</p><p className="font-bold">{impact.class_days}</p></div>
                <div><p className="text-slate-500">Hours missed</p><p className="font-bold">{impact.hours_missed}h</p></div>
                <div><p className="text-slate-500">Attendance after</p>
                  <p className={`font-bold ${impact.worst_pct < 80 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {impact.worst_pct}% {impact.worst_pct < 80 ? '⚠' : '✓'}
                  </p>
                </div>
                <div><p className="text-slate-500">Topics missed</p><p className="font-bold">{impact.topics_missed?.filter(t => t.title).length}</p></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {isActionable && (
        <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-4 uppercase tracking-wider">Take Action</h3>

          <div className="flex gap-3 mb-4">
            {[
              { id: 'approve', label: '✅ Approve', cls: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
              { id: 'reject',  label: '❌ Reject',  cls: 'bg-rose-500 hover:bg-rose-600 text-white' },
              { id: 'counter', label: '🔄 Counter Propose', cls: 'bg-[#2272B9] hover:bg-[#1B3A6B] text-white' },
            ].map(btn => (
              <button key={btn.id} onClick={() => setAction(action === btn.id ? null : btn.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${action === btn.id ? btn.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                {btn.label}
              </button>
            ))}
          </div>

          {action === 'approve' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-800">Approve Leave</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note to student (optional)</label>
                <textarea value={trainerNote} onChange={e => setTrainerNote(e.target.value)} rows={2}
                  placeholder="Any message for the student..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <button onClick={handleApprove} disabled={submitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition flex items-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Confirm Approve
              </button>
            </div>
          )}

          {action === 'reject' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-rose-800">Reject Leave</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Rejection Reason * <span className="text-slate-400 font-normal">(min 30 chars — {rejectReason.length} typed)</span>
                </label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                  placeholder="Explain why you are rejecting this leave request (required)..."
                  className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 ${rejectReason.length > 0 && rejectReason.length < 30 ? 'border-rose-300 focus:ring-rose-300' : 'border-slate-200 focus:ring-rose-300'}`} />
                {rejectReason.length > 0 && rejectReason.length < 30 && (
                  <p className="text-xs text-rose-600 mt-1">⚠ {30 - rejectReason.length} more characters needed</p>
                )}
              </div>
              <button onClick={handleReject} disabled={submitting || rejectReason.trim().length < 30}
                className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition flex items-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Confirm Reject
              </button>
            </div>
          )}

          {action === 'counter' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Propose Alternative Dates</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Alternative From *</label>
                  <input type="date" value={counterFrom} onChange={e => setCounterFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Alternative To *</label>
                  <input type="date" value={counterTo} min={counterFrom} onChange={e => setCounterTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Message to Student *</label>
                <textarea value={counterMsg} onChange={e => setCounterMsg(e.target.value)} rows={2}
                  placeholder="Explain why you're proposing different dates..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <button onClick={handleCounter} disabled={submitting || !counterFrom || !counterTo || !counterMsg.trim()}
                className="bg-[#2272B9] hover:bg-[#1B3A6B] text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition flex items-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Send Counter Proposal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Appointment Detail View ───────────────────────────────────────────────────
function AppointmentDetail({ apptId, onBack, onActionDone }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction]   = useState(null)
  const [note, setNote]       = useState('')
  const [sugDate, setSugDate] = useState('')
  const [sugTime, setSugTime] = useState('10:00')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAppointment(apptId)
      .then(r => setData(r.data.appointment))
      .catch(() => toast.error('Failed to load appointment'))
      .finally(() => setLoading(false))
  }, [apptId])

  const doConfirm = async () => {
    setSubmitting(true)
    try { await confirmAppointment(apptId, { trainer_note: note }); toast.success('Confirmed ✅'); onActionDone() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSubmitting(false) }
  }

  const doDecline = async () => {
    if (note.trim().length < 10) { toast.error('Reason required (min 10 characters)'); return }
    setSubmitting(true)
    try { await declineAppointment(apptId, { trainer_note: note }); toast.success('Declined'); onActionDone() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSubmitting(false) }
  }

  const doSuggest = async () => {
    if (!sugDate || !sugTime) { toast.error('Date and time required'); return }
    setSubmitting(true)
    try { await suggestAppointment(apptId, { suggested_date: sugDate, suggested_time: sugTime, trainer_note: note }); toast.success('Suggestion sent ✅'); onActionDone() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-[#1B3A6B] animate-spin" /></div>
  if (!data) return null

  const isActionable = ['pending', 'suggestion_declined'].includes(data.status)

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 font-medium transition">
        <ChevronLeft size={16} /> Back to Requests
      </button>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#2272B9] flex items-center justify-center text-white font-bold">
              {data.student?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{data.student?.name}</p>
              <p className="text-xs text-slate-500">{data.student?.email}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-sm">
            <p className="text-xs font-semibold text-slate-600 mb-2">Topic / Question</p>
            <p className="text-slate-700">{data.topic_question}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Request Details</h3>
            <StatusBadge status={data.status} />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Preferred Date</span><span className="font-medium">{data.preferred_date}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Preferred Time</span><span className="font-medium">{data.preferred_time}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-medium">{data.duration_minutes} min</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-medium">{data.mode === 'online' ? '💻 Online' : '🏫 In Person'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Batch</span><span className="font-medium">{data.batch?.name}</span></div>
          </div>
          {data.suggested_date && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs">
              <p className="font-semibold text-blue-800 mb-1">Your suggested time:</p>
              <p className="text-blue-700">{data.suggested_date} at {data.suggested_time}</p>
            </div>
          )}
        </div>
      </div>

      {isActionable && (
        <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-4 uppercase tracking-wider">Take Action</h3>
          <div className="flex gap-3 mb-4">
            {[
              { id: 'confirm', label: '✅ Confirm Time', cls: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
              { id: 'suggest', label: '🔄 Suggest Different Time', cls: 'bg-[#2272B9] hover:bg-[#1B3A6B] text-white' },
              { id: 'decline', label: '❌ Decline', cls: 'bg-rose-500 hover:bg-rose-600 text-white' },
            ].map(btn => (
              <button key={btn.id} onClick={() => setAction(action === btn.id ? null : btn.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${action === btn.id ? btn.cls : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                {btn.label}
              </button>
            ))}
          </div>

          {action === 'confirm' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Optional note..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              <button onClick={doConfirm} disabled={submitting}
                className="bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition">
                {submitting ? 'Confirming...' : 'Confirm Appointment'}
              </button>
            </div>
          )}

          {action === 'suggest' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Suggested Date *</label>
                  <input type="date" value={sugDate} onChange={e => setSugDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Suggested Time *</label>
                  <input type="time" value={sugTime} onChange={e => setSugTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Reason for suggesting different time..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              <button onClick={doSuggest} disabled={submitting}
                className="bg-[#2272B9] text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition">
                {submitting ? 'Sending...' : 'Send Suggestion'}
              </button>
            </div>
          )}

          {action === 'decline' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Reason for declining (min 10 characters)..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
              <button onClick={doDecline} disabled={submitting || note.trim().length < 10}
                className="bg-rose-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition">
                {submitting ? 'Declining...' : 'Decline Request'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Request Card ──────────────────────────────────────────────────────────────
function RequestCard({ item, isLeave, onClick }) {
  const isEmergency = isLeave && item.leave_type === 'emergency'
  const isPending   = item.status === 'pending'
  return (
    <button onClick={onClick} className={`w-full text-left bg-white border rounded-2xl p-4 hover:shadow-md transition-all ${
      isEmergency && isPending ? 'border-rose-300 bg-rose-50/30 hover:border-rose-400' : 'border-slate-200 hover:border-primary/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isLeave ? (LEAVE_ICONS[item.leave_type] + ' ' + item.leave_type?.replace('_', ' ')) : '📅 Appointment'}
            </span>
            {isEmergency && isPending && <span className="text-xs bg-rose-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">URGENT</span>}
            <StatusBadge status={item.status} />
          </div>
          <p className="font-semibold text-slate-800 text-sm">{item.student_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isLeave
              ? `${item.from_date} → ${item.to_date} · ${item.batch_name}`
              : `${item.preferred_date} at ${item.preferred_time} · ${item.batch_name}`
            }
          </p>
        </div>
        <span className="text-xs text-slate-400 flex-shrink-0">
          {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TrainerRequests() {
  const [tab, setTab]           = useState('leaves')
  const [leaves, setLeaves]     = useState([])
  const [appointments, setAppts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [detailId, setDetailId] = useState(null)
  const [detailType, setDetailType] = useState(null) // 'leave'|'appointment'

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([getLeaves(), getAppointments()])
      .then(([l, a]) => { setLeaves(l.data.leaves || []); setAppts(a.data.appointments || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleActionDone = () => {
    setDetailId(null)
    setDetailType(null)
    loadData()
  }

  if (detailId && detailType === 'leave') {
    return <div className="max-w-4xl"><LeaveDetail leaveId={detailId} onBack={() => setDetailId(null)} onActionDone={handleActionDone} /></div>
  }
  if (detailId && detailType === 'appointment') {
    return <div className="max-w-4xl"><AppointmentDetail apptId={detailId} onBack={() => setDetailId(null)} onActionDone={handleActionDone} /></div>
  }

  const pendingLeaves = leaves.filter(l => l.status === 'pending').length
  const pendingAppts  = appointments.filter(a => a.status === 'pending').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Requests</h1>
        <p className="text-slate-500 text-sm mt-1">Review and respond to student leave and appointment requests</p>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl mb-5">
        {[
          { id: 'leaves',       label: 'Leave Requests',       count: pendingLeaves },
          { id: 'appointments', label: 'Appointment Requests', count: pendingAppts  },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
            {t.count > 0 && <span className="text-xs bg-rose-500 text-white rounded-full px-1.5 py-0.5 font-bold">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : tab === 'leaves' ? (
        leaves.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No leave requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map(l => (
              <RequestCard key={l.id} item={l} isLeave onClick={() => { setDetailId(l.id); setDetailType('leave') }} />
            ))}
          </div>
        )
      ) : (
        appointments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No appointment requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map(a => (
              <RequestCard key={a.id} item={a} isLeave={false} onClick={() => { setDetailId(a.id); setDetailType('appointment') }} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
