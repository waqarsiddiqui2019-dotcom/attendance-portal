import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Search, Eye, EyeOff, KeyRound, ScrollText, BarChart2,
  ChevronLeft, ChevronRight, X, AlertTriangle, TrendingUp,
  Calendar, Filter, CheckCircle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getOwnerStudentsManagement, getStudentLeavesHistory,
  getStudentAttendanceSummary, resetUserPassword,
  reassignStudent, getActiveBatchesWithTrainers,
} from '../api/index.js'

const PAGE_SIZE = 15
const NOW = new Date()
const THIRTY_AGO = new Date(NOW - 30 * 24 * 60 * 60 * 1000)
const THIS_MONTH = NOW.toISOString().slice(0, 7)

// ── Helpers ────────────────────────────────────────────────────────────────────

function pctColor(pct, days) {
  if (days === 0) return 'text-slate-400'
  if (pct >= 85)  return 'text-emerald-600'
  if (pct >= 75)  return 'text-amber-600'
  return 'text-rose-600'
}
function pctBg(pct, days) {
  if (days === 0) return 'bg-slate-100 text-slate-500'
  if (pct >= 85)  return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (pct >= 75)  return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-rose-50 text-rose-700 border border-rose-200'
}
function statusBadge(s) {
  if (!s.last_active || new Date(s.last_active) < THIRTY_AGO) return { label: 'Inactive', cls: 'bg-slate-100 text-slate-500' }
  if (s.total_days > 0 && s.attendance_pct < 75) return { label: 'At Risk', cls: 'bg-rose-50 text-rose-600 border border-rose-200' }
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }
}
function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function leaveStatusBadge(status) {
  const map = {
    pending:          'bg-amber-50 text-amber-700',
    approved:         'bg-emerald-50 text-emerald-700',
    counter_accepted: 'bg-emerald-50 text-emerald-700',
    rejected:         'bg-rose-50 text-rose-700',
    cancelled:        'bg-slate-100 text-slate-500',
    counter_proposed: 'bg-blue-50 text-blue-700',
    counter_declined: 'bg-slate-100 text-slate-500',
  }
  return map[status] || 'bg-slate-100 text-slate-500'
}

// ── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ student, onClose }) {
  const [pw, setPw]             = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const match = confirm && pw === confirm
  const valid = pw.length >= 8 && match

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    try {
      await resetUserPassword(student.id, pw)
      toast.success(`Password reset for ${student.name}`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Reset Password</h3>
            <p className="text-xs text-slate-500">{student.name}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">New Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full pr-10 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className={`w-full pl-3 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${confirm && !match ? 'border-rose-300' : 'border-slate-200'}`} />
            {confirm && !match && <p className="text-xs text-rose-500 mt-1">Passwords do not match</p>}
          </div>
          <button type="submit" disabled={!valid || loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition mt-1">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Leave History Modal ───────────────────────────────────────────────────────

function LeaveHistoryModal({ student, onClose }) {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudentLeavesHistory(student.id)
      .then(r => setLeaves(r.data.leaves || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false))
  }, [student.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Leave History</h3>
              <p className="text-xs text-slate-500">{student.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-10">
              <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No leave records found</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {['Type','From','To','Status','Trainer','Submitted'].map(h => (
                      <th key={h} className="pb-2 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leaves.map(lr => (
                    <tr key={lr.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${lr.leave_type === 'emergency' ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                          {lr.leave_type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 text-xs">{fmtDate(lr.from_date)}</td>
                      <td className="py-2.5 pr-3 text-slate-600 text-xs">{fmtDate(lr.to_date)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${leaveStatusBadge(lr.status)}`}>
                          {lr.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 text-xs">{lr.trainer_name || '—'}</td>
                      <td className="py-2.5 text-slate-400 text-xs">{lr.created_at ? new Date(lr.created_at).toLocaleDateString('en-GB') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">Total: {leaves.length} leave record{leaves.length !== 1 ? 's' : ''}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Attendance Report Modal ────────────────────────────────────────────────────

function AttendanceReportModal({ student, onClose }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudentAttendanceSummary(student.id)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [student.id])

  const allTime = data?.all_time
  const monthly = data?.monthly || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue-light flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Attendance Report</h3>
              <p className="text-xs text-slate-500">{student.name} · {student.batch_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : !data ? (
            <p className="text-slate-500 text-sm text-center py-8">Failed to load attendance data.</p>
          ) : (
            <>
              {/* Overall % */}
              <div className="text-center mb-6">
                <p className={`text-5xl font-bold mb-1 ${pctColor(allTime?.pct || 0, allTime?.total || 0)}`}>
                  {allTime?.pct || 0}%
                </p>
                <p className="text-sm text-slate-500">Overall Attendance ({allTime?.total || 0} sessions recorded)</p>
                <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden max-w-xs mx-auto">
                  <div
                    className={`h-full rounded-full transition-all ${(allTime?.pct||0) >= 85 ? 'bg-emerald-500' : (allTime?.pct||0) >= 75 ? 'bg-amber-400' : 'bg-rose-500'}`}
                    style={{ width: `${allTime?.pct || 0}%` }}
                  />
                </div>
              </div>

              {/* Monthly table */}
              {monthly.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Monthly Breakdown</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Month','Present','Absent','Late','Total','%'].map(h => (
                          <th key={h} className="pb-2 pr-2 text-xs font-semibold text-slate-500 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monthly.map(m => {
                        const mpct = m.total > 0 ? Math.round((m.present + m.late) / m.total * 100) : 0
                        return (
                          <tr key={m.month} className="hover:bg-slate-50">
                            <td className="py-2 pr-2 text-slate-700 font-medium">{m.month}</td>
                            <td className="py-2 pr-2 text-emerald-600">{m.present}</td>
                            <td className="py-2 pr-2 text-rose-500">{m.absent}</td>
                            <td className="py-2 pr-2 text-amber-600">{m.late}</td>
                            <td className="py-2 pr-2 text-slate-500">{m.total}</td>
                            <td className="py-2">
                              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${pctBg(mpct, m.total)}`}>{mpct}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
              {monthly.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">No attendance records found.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Reassign Batch Modal ───────────────────────────────────────────────────────

function ReassignBatchModal({ student, onClose, onSuccess }) {
  const [batches,  setBatches]  = useState([])
  const [form, setForm] = useState({
    new_batch_id: '', new_trainer_id: '', reason: '',
    effective_date: new Date().toISOString().slice(0,10),
    keep_attendance: true,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getActiveBatchesWithTrainers()
      .then(r => setBatches(r.data.batches || []))
      .catch(() => {})
  }, [])

  const selectedBatch = batches.find(b => String(b.id) === String(form.new_batch_id))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (selectedBatch) set('new_trainer_id', String(selectedBatch.trainer_id))
  }, [form.new_batch_id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.new_batch_id) { toast.error('Please select a new batch'); return }
    if (!form.reason.trim()) { toast.error('Please enter a reason'); return }
    setLoading(true)
    try {
      await reassignStudent(student.id, {
        new_batch_id:    Number(form.new_batch_id),
        new_trainer_id:  form.new_trainer_id ? Number(form.new_trainer_id) : null,
        reason:          form.reason.trim(),
        effective_date:  form.effective_date,
        keep_attendance: form.keep_attendance,
      })
      toast.success(`${student.name} reassigned successfully`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reassignment failed')
    } finally { setLoading(false) }
  }

  const uniqueTrainers = [...new Map(batches.filter(b => b.trainer_id).map(b => [b.trainer_id, b.trainer_name])).entries()]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-blue-light flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-brand-blue" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Change Batch</h3>
            <p className="text-xs text-slate-500">{student.name} · Currently in <strong>{student.batch_name || 'No batch'}</strong></p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">New Batch *</label>
            <select value={form.new_batch_id} onChange={e => set('new_batch_id', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
              <option value="">Select batch…</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">New Trainer</label>
            <select value={form.new_trainer_id} onChange={e => set('new_trainer_id', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
              <option value="">Auto (from batch)</option>
              {uniqueTrainers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Reason for Reassignment *</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
              placeholder="Why is the student being moved?"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Effective Date</label>
            <input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={form.keep_attendance} onChange={e => set('keep_attendance', e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-700">Keep existing attendance records</span>
          </label>
          <button type="submit" disabled={loading}
            className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition mt-1">
            {loading ? 'Reassigning…' : 'Confirm Reassignment'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function OwnerStudents() {
  const [students, setStudents]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [batchFilter, setBatchFilter]   = useState('')
  const [trainerFilter, setTrainerFilter] = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [page, setPage]             = useState(1)

  const [resetStudent, setResetStudent]           = useState(null)
  const [leaveStudent, setLeaveStudent]           = useState(null)
  const [attendanceStudent, setAttendanceStudent] = useState(null)
  const [reassignStudent, setReassignStudent]     = useState(null)

  useEffect(() => {
    getOwnerStudentsManagement()
      .then(r => setStudents(r.data.students || []))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false))
  }, [])

  // Derived filter options
  const batches  = useMemo(() => [...new Map(students.filter(s => s.batch_id).map(s => [s.batch_id,  { id: s.batch_id,  name: s.batch_name  }])).values()].sort((a,b) => a.name.localeCompare(b.name)), [students])
  const trainers = useMemo(() => [...new Map(students.filter(s => s.trainer_id).map(s => [s.trainer_id, { id: s.trainer_id, name: s.trainer_name }])).values()].sort((a,b) => a.name.localeCompare(b.name)), [students])

  // Stats (unique student perspective)
  const stats = useMemo(() => {
    const seen = new Map()
    for (const s of students) {
      if (!seen.has(s.id) || seen.get(s.id).attendance_pct > s.attendance_pct) seen.set(s.id, s)
    }
    const unique = [...seen.values()]
    return {
      total:    unique.length,
      active:   unique.filter(s => s.last_active && new Date(s.last_active) >= THIRTY_AGO).length,
      atRisk:   unique.filter(s => s.total_days > 0 && s.attendance_pct < 75).length,
      newMonth: students.filter(s => s.enrolled_at && s.enrolled_at.slice(0,7) === THIS_MONTH).length,
    }
  }, [students])

  // Filtered rows (per student-batch pair)
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false
      if (batchFilter   && String(s.batch_id)   !== batchFilter)   return false
      if (trainerFilter && String(s.trainer_id) !== trainerFilter) return false
      if (statusFilter === 'at_risk') return s.total_days > 0 && s.attendance_pct < 75
      if (statusFilter === 'active')  return s.last_active && new Date(s.last_active) >= THIRTY_AGO
      if (statusFilter === 'inactive') return !s.last_active || new Date(s.last_active) < THIRTY_AGO
      return true
    })
  }, [students, search, batchFilter, trainerFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const clearFilters = useCallback(() => {
    setSearch(''); setBatchFilter(''); setTrainerFilter(''); setStatusFilter('all'); setPage(1)
  }, [])

  const anyFilter = search || batchFilter || trainerFilter || statusFilter !== 'all'

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, batchFilter, trainerFilter, statusFilter])

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Students</h1>
        <p className="text-slate-500 text-sm mt-1">Manage all enrolled students across every batch</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Students',    value: stats.total,    icon: Users,        bg: 'bg-primary-light',    ic: 'text-primary' },
          { label: 'Active (30 days)',  value: stats.active,   icon: CheckCircle,  bg: 'bg-emerald-50',       ic: 'text-emerald-600' },
          { label: 'At Risk (<75%)',    value: stats.atRisk,   icon: AlertTriangle,bg: 'bg-rose-50',          ic: 'text-rose-500' },
          { label: 'New This Month',    value: stats.newMonth, icon: TrendingUp,   bg: 'bg-brand-blue-light', ic: 'text-brand-blue' },
        ].map(({ label, value, icon: Icon, bg, ic }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${ic}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800 mb-0.5">{loading ? '—' : value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          {/* Batch */}
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
            <option value="">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {/* Trainer */}
          <select value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
            <option value="">All Trainers</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {/* Status */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
            {[['all','All'],['active','Active'],['at_risk','At Risk'],['inactive','Inactive']].map(([val, lbl]) => (
              <button key={val} onClick={() => setStatusFilter(val)}
                className={`px-3 py-2 transition ${statusFilter === val ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {lbl}
              </button>
            ))}
          </div>
          {anyFilter && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition">
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 animate-pulse bg-slate-50 m-3 rounded-xl" />)}
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No students found matching your filters.</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting the search or filters.</p>
            {anyFilter && (
              <button onClick={clearFilters} className="mt-3 text-sm text-primary font-medium hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trainer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Enrolled</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Attendance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Active</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((s, idx) => {
                  const sb = statusBadge(s)
                  return (
                    <tr key={`${s.id}-${s.batch_id}-${idx}`} className="hover:bg-slate-50 transition">
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: '#1B3A6B', color: '#F5A623' }}>
                            {initials(s.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate max-w-[140px]">{s.name}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[140px]">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Batch */}
                      <td className="px-4 py-3 text-slate-600">{s.batch_name || '—'}</td>
                      {/* Trainer */}
                      <td className="px-4 py-3 text-slate-600">{s.trainer_name || '—'}</td>
                      {/* Enrolled */}
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' }) : '—'}</td>
                      {/* Attendance */}
                      <td className="px-4 py-3">
                        {s.total_days > 0 ? (
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${pctBg(s.attendance_pct, s.total_days)}`}>
                            {s.attendance_pct}%
                          </span>
                        ) : <span className="text-xs text-slate-400">No records</span>}
                      </td>
                      {/* Last Active */}
                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(s.last_active)}</td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${sb.cls}`}>{sb.label}</span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/owner/calendars/student/${s.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition" title="View Calendar">
                            <Calendar size={14} />
                          </Link>
                          <button onClick={() => setResetStudent(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light transition" title="Reset Password">
                            <KeyRound size={14} />
                          </button>
                          <button onClick={() => setLeaveStudent(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition" title="View Leave History">
                            <ScrollText size={14} />
                          </button>
                          <button onClick={() => setAttendanceStudent(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="View Attendance Report">
                            <BarChart2 size={14} />
                          </button>
                          <button onClick={() => setReassignStudent(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition" title="Change Batch">
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-600 px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {resetStudent     && <ResetPasswordModal     student={resetStudent}     onClose={() => setResetStudent(null)} />}
      {leaveStudent     && <LeaveHistoryModal       student={leaveStudent}     onClose={() => setLeaveStudent(null)} />}
      {attendanceStudent && <AttendanceReportModal  student={attendanceStudent} onClose={() => setAttendanceStudent(null)} />}
      {reassignStudent   && <ReassignBatchModal student={reassignStudent} onClose={() => setReassignStudent(null)} onSuccess={() => { setStudents([]); setLoading(true); getOwnerStudentsManagement().then(r => setStudents(r.data.students || [])).finally(() => setLoading(false)) }} />}
    </div>
  )
}
