import React, { useEffect, useState, useCallback } from 'react'
import { FileText, AlertCircle, CheckCircle, XCircle, Clock, Filter, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOwnerLeaveStats, getOwnerLeaves, approveLeave, rejectLeave, getOwnerTrainers, getOwnerBatches } from '../api/index.js'

const LEAVE_ICONS = { medical:'🏥', personal:'👤', emergency:'🚨', family:'👨‍👩‍👧', other:'📝' }

const STATUS_COLORS = {
  pending:          'bg-amber-100 text-amber-700',
  approved:         'bg-emerald-100 text-emerald-700',
  rejected:         'bg-rose-100 text-rose-700',
  counter_proposed: 'bg-blue-100 text-blue-700',
  counter_accepted: 'bg-emerald-100 text-emerald-700',
  counter_declined: 'bg-slate-100 text-slate-600',
  cancelled:        'bg-slate-100 text-slate-500',
}

const STATUS_LABELS = {
  pending:'Pending', approved:'Approved', rejected:'Rejected',
  counter_proposed:'Counter Proposed', counter_accepted:'Counter Accepted',
  counter_declined:'Counter Declined', cancelled:'Cancelled',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

// ── Reject modal — requires a reason (min 30 chars) ───────────────────────────
function RejectModal({ leave, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('')
  if (!leave) return null
  const MIN_CHARS = 30
  const canSubmit = reason.trim().length >= MIN_CHARS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <XCircle size={17} className="text-rose-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Reject Leave Request</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 space-y-1">
            <p><span className="font-semibold">Student:</span> {leave.student_name}</p>
            <p><span className="font-semibold">Dates:</span> {leave.from_date} → {leave.to_date}</p>
            <p><span className="font-semibold">Type:</span> {LEAVE_ICONS[leave.leave_type]} {leave.leave_type}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Rejection Reason <span className="text-rose-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(min {MIN_CHARS} characters)</span>
            </label>
            <textarea
              autoFocus
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this leave request is being rejected…"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition resize-none"
            />
            <p className={`text-xs mt-1 text-right ${canSubmit ? 'text-emerald-600' : 'text-slate-400'}`}>
              {reason.trim().length}/{MIN_CHARS} characters minimum
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!canSubmit || loading}
            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Rejecting…</> : 'Reject Leave'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OwnerLeaveLog() {
  const [stats, setStats]       = useState(null)
  const [leaves, setLeaves]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [approving, setApproving] = useState(null)

  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectLoading, setRejectLoading] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterType, setFilterType]         = useState('')
  const [filterTrainer, setFilterTrainer]   = useState('')
  const [filterBatch, setFilterBatch]       = useState('')
  const [trainers, setTrainers]             = useState([])
  const [batches, setBatches]               = useState([])

  const loadStats = useCallback(() => {
    getOwnerLeaveStats().then(r => setStats(r.data)).catch(console.error)
  }, [])

  const loadLeaves = useCallback(() => {
    const params = {}
    if (filterStatus)  params.status     = filterStatus
    if (filterType)    params.leave_type = filterType
    if (filterTrainer) params.trainer_id = filterTrainer
    if (filterBatch)   params.batch_id   = filterBatch
    setLoading(true)
    getOwnerLeaves(params)
      .then(r => setLeaves(r.data.leaves || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filterStatus, filterType, filterTrainer, filterBatch])

  useEffect(() => {
    loadStats()
    Promise.all([getOwnerTrainers(), getOwnerBatches()])
      .then(([t, b]) => { setTrainers(t.data.trainers || []); setBatches(b.data.batches || []) })
      .catch(console.error)
  }, [loadStats])

  useEffect(() => { loadLeaves() }, [loadLeaves])

  const handleEmergencyApprove = async (leaveId) => {
    if (approving) return
    setApproving(leaveId)
    try {
      await approveLeave(leaveId, { trainer_note: 'Approved by owner after 24h no response.' })
      toast.success('Emergency leave approved ✅')
      loadStats()
      loadLeaves()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to approve') }
    finally { setApproving(null) }
  }

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget) return
    setRejectLoading(true)
    try {
      await rejectLeave(rejectTarget.id, { trainer_note: reason })
      toast.success('Leave rejected ✅')
      setRejectTarget(null)
      loadStats()
      loadLeaves()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to reject') }
    finally { setRejectLoading(false) }
  }

  const urgentList = (stats?.urgent_unresponded || 0) > 0
    ? leaves.filter(l => l.leave_type === 'emergency' && l.status === 'pending')
    : []

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Leave Log</h1>
        <p className="text-sm text-slate-500 mt-1">Global leave overview across all batches and trainers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock}        label="Pending"            value={stats?.pending}           color="bg-amber-100 text-amber-600" />
        <StatCard icon={CheckCircle}  label="Approved This Month" value={stats?.approved_month}   color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={XCircle}      label="Rejected This Month" value={stats?.rejected_month}   color="bg-rose-100 text-rose-600" />
        <StatCard icon={AlertCircle}  label="Emergency Pending"   value={stats?.emergency_pending} color="bg-rose-200 text-rose-700" />
      </div>

      {/* Urgent emergency alert */}
      {urgentList.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-rose-600" />
            <span className="text-sm font-bold text-rose-800">
              {urgentList.length} emergency {urgentList.length === 1 ? 'leave has' : 'leaves have'} been unresponded for 24+ hours
            </span>
          </div>
          <div className="space-y-2">
            {urgentList.map(l => (
              <div key={l.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-rose-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{l.student_name}</p>
                  <p className="text-xs text-slate-500">{l.batch_name} · {l.from_date} → {l.to_date}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEmergencyApprove(l.id)} disabled={approving === l.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                    {approving === l.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Approve
                  </button>
                  <button onClick={() => setRejectTarget(l)} disabled={!!approving}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-600">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30">
            <option value="">All Types</option>
            {Object.keys(LEAVE_ICONS).map(t => <option key={t} value={t}>{LEAVE_ICONS[t]} {t}</option>)}
          </select>

          <select value={filterTrainer} onChange={e => setFilterTrainer(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30">
            <option value="">All Trainers</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30">
            <option value="">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
          <span className="text-sm font-semibold text-slate-600">Leave Requests</span>
          <span className="text-xs text-slate-400">{leaves.length} records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-[#1B3A6B] animate-spin" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText size={32} className="mb-3 text-slate-300" />
            <p className="text-sm">No leave requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Student', 'Batch', 'Type', 'Dates', 'Status', 'Submitted', 'Action'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-5 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaves.map(l => (
                  <tr key={l.id} className={`hover:bg-slate-50 transition ${l.leave_type === 'emergency' && l.status === 'pending' ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{l.student_name}</p>
                      <p className="text-xs text-slate-400">{l.student_email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{l.batch_name}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        {LEAVE_ICONS[l.leave_type]}
                        <span className="capitalize">{l.leave_type?.replace('_', ' ')}</span>
                        {l.leave_type === 'emergency' && l.status === 'pending' &&
                          <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full">URGENT</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{l.from_date} → {l.to_date}</td>
                    <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      {l.status === 'pending' && (
                        <button
                          onClick={() => setRejectTarget(l)}
                          className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RejectModal
        leave={rejectTarget}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectTarget(null)}
        loading={rejectLoading}
      />
    </div>
  )
}
