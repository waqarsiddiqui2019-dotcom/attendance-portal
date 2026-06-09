import React, { useEffect, useState, useCallback } from 'react'
import {
  Users, CheckCircle, XCircle, Clock, Trash2, Loader2, UserCheck,
  AlertTriangle, X, PowerOff, KeyRound, Eye, EyeOff,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import {
  getOwnerTrainers, approveTrainer, rejectTrainer,
  toggleTrainerStatus, resetUserPassword, deleteTrainer,
} from '../api/index.js'

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: Clock,       badge: 'bg-amber-100 text-amber-700 border-amber-200',   row: 'border-l-amber-400' },
  active:   { label: 'Active',   icon: CheckCircle, badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', row: 'border-l-emerald-400' },
  inactive: { label: 'Inactive', icon: PowerOff,    badge: 'bg-slate-100 text-slate-500 border-slate-300',   row: 'border-l-slate-300' },
  rejected: { label: 'Rejected', icon: XCircle,     badge: 'bg-rose-100 text-rose-700 border-rose-200',      row: 'border-l-rose-400' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
      <Icon size={12} /> {cfg.label}
    </span>
  )
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      title={checked ? 'Click to deactivate' : 'Click to activate'}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function DeactivateModal({ trainer, onConfirm, onClose, loading }) {
  if (!trainer) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <PowerOff size={16} className="text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Deactivate Trainer</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-700">
            Deactivate <strong>{trainer.name}</strong>? They will not be able to log in until reactivated.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">What happens:</p>
            <p>• Their login is blocked immediately</p>
            <p>• All batches and data are preserved</p>
            <p>• You can reactivate at any time</p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />}
            Deactivate
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ trainer, onClose }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!trainer) return null
  const canSubmit = pw.length >= 8 && pw === confirm

  const handleReset = async () => {
    setLoading(true)
    try {
      await resetUserPassword(trainer.id, pw)
      toast.success(`Password reset. Share the new password with ${trainer.name} securely.`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
              <KeyRound size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Reset Password</h2>
              <p className="text-xs text-slate-500">{trainer.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3.5 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm Password <span className="text-rose-500">*</span></label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition ${confirm && pw !== confirm ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
            />
            {confirm && pw !== confirm && <p className="text-xs text-rose-600 mt-1">Passwords do not match</p>}
          </div>
          {pw.length > 0 && pw.length < 8 && (
            <p className="text-xs text-amber-600">Password must be at least 8 characters</p>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleReset} disabled={!canSubmit || loading}
            className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Reset Password
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ trainer, onConfirm, onClose, loading }) {
  const [typed, setTyped] = useState('')
  if (!trainer) return null
  const canDelete = typed === 'DELETE'
  const hasBatches = trainer.batch_count > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Trash2 size={17} className="text-rose-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Delete Trainer</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-700">You are about to permanently delete <strong>{trainer.name}</strong>.</p>
          {hasBatches ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle size={15} /> This will permanently delete:
              </p>
              <ul className="text-sm text-rose-700 list-disc list-inside space-y-0.5 ml-1">
                <li>All {trainer.batch_count} batch{trainer.batch_count !== 1 ? 'es' : ''}</li>
                <li>All student enrollments in those batches</li>
                <li>All attendance, topics and syllabus data</li>
                <li>All leave and appointment requests</li>
                <li>All topic sets created by this trainer</li>
              </ul>
              <p className="text-xs font-bold text-rose-800 mt-2">This cannot be undone.</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-800">This trainer has no batches. Only their account and personal data will be deleted.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Type <span className="font-bold text-rose-600">DELETE</span> to confirm
            </label>
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type DELETE here"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={!canDelete || loading}
            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FILTERS = ['all', 'active', 'inactive', 'pending', 'rejected']
const FILTER_LABELS = { all: 'All', active: 'Active', inactive: 'Inactive', pending: 'Pending', rejected: 'Rejected' }

export default function OwnerTeam() {
  const [trainers, setTrainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)

  const [deleteTarget,      setDeleteTarget]      = useState(null)
  const [deleteLoading,     setDeleteLoading]      = useState(false)
  const [deactivateTarget,  setDeactivateTarget]   = useState(null)
  const [deactivateLoading, setDeactivateLoading]  = useState(false)
  const [resetTarget,       setResetTarget]        = useState(null)

  const fetchTrainers = useCallback(() => {
    setLoading(true)
    getOwnerTrainers()
      .then(res => setTrainers(res.data.trainers || []))
      .catch(() => toast.error('Failed to load trainers'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTrainers() }, [fetchTrainers])

  const handle = async (action, id, name) => {
    setActionLoading(`${action}-${id}`)
    try {
      if (action === 'approve') { await approveTrainer(id); toast.success(`${name} approved!`) }
      if (action === 'reject')  { await rejectTrainer(id);  toast.success(`${name} rejected`) }
      fetchTrainers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggle = async (trainer) => {
    if (trainer.status === 'active') {
      setDeactivateTarget(trainer)
      return
    }
    // Reactivate immediately — no confirmation needed
    setActionLoading(`toggle-${trainer.id}`)
    try {
      await toggleTrainerStatus(trainer.id)
      toast.success(`${trainer.name} reactivated!`)
      fetchTrainers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reactivate')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    setDeactivateLoading(true)
    try {
      await toggleTrainerStatus(deactivateTarget.id)
      toast.success(`${deactivateTarget.name} deactivated`)
      setDeactivateTarget(null)
      fetchTrainers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deactivation failed')
    } finally {
      setDeactivateLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteTrainer(deleteTarget.id)
      toast.success(`${deleteTarget.name} and all associated data deleted`)
      setDeleteTarget(null)
      fetchTrainers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  const counts = {
    all:      trainers.length,
    active:   trainers.filter(t => t.status === 'active').length,
    inactive: trainers.filter(t => t.status === 'inactive').length,
    pending:  trainers.filter(t => t.status === 'pending').length,
    rejected: trainers.filter(t => t.status === 'rejected').length,
  }

  const visible = filter === 'all' ? trainers : trainers.filter(t => t.status === filter)

  const formatDate = (d) => {
    try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—' } catch { return '—' }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Team Management</h1>
        <p className="text-slate-500 text-sm mt-1">Manage trainer accounts — approve, deactivate, or remove</p>
      </div>

      {counts.pending > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {counts.pending} trainer{counts.pending > 1 ? 's are' : ' is'} waiting for your approval
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {FILTER_LABELS[f]}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              filter === f ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <UserCheck className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              {filter === 'all' ? 'No trainers yet' : `No ${FILTER_LABELS[filter].toLowerCase()} trainers`}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_1.5fr_auto_auto_auto] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Trainer</span><span>Email</span><span>Batches</span><span>Joined</span><span>Actions</span>
            </div>
            <div className="divide-y divide-slate-100">
              {visible.map(trainer => {
                const isLoading = (key) => actionLoading === `${key}-${trainer.id}`
                const isInactive = trainer.status === 'inactive'
                const isActive   = trainer.status === 'active'
                const isPending  = trainer.status === 'pending'
                const isRejected = trainer.status === 'rejected'
                const canToggle  = isActive || isInactive

                return (
                  <div key={trainer.id}
                    className={`flex flex-col sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto_auto] gap-3 sm:gap-4 items-start sm:items-center px-6 py-4 transition border-l-4 ${STATUS_CONFIG[trainer.status]?.row || ''} ${isInactive ? 'opacity-60 hover:opacity-80' : 'hover:bg-slate-50/60'}`}>

                    {/* Name + status */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{
                          background: isInactive ? '#f1f5f9' : isPending ? '#FEF3D9' : isActive ? '#d1fae5' : '#fee2e2',
                          color:      isInactive ? '#94a3b8' : isPending ? '#D4891A' : isActive ? '#065f46' : '#b91c1c',
                        }}>
                        {trainer.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{trainer.name}</p>
                        <div className="mt-0.5"><StatusBadge status={trainer.status} /></div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-500 truncate pl-12 sm:pl-0">{trainer.email}</p>
                    <p className="text-sm text-slate-600 pl-12 sm:pl-0 font-medium">
                      {trainer.batch_count ?? 0} batch{(trainer.batch_count ?? 0) !== 1 ? 'es' : ''}
                    </p>
                    <p className="text-xs text-slate-400 pl-12 sm:pl-0">{formatDate(trainer.created_at)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pl-12 sm:pl-0 flex-wrap">
                      {isPending && (
                        <>
                          <button onClick={() => handle('approve', trainer.id, trainer.name)} disabled={actionLoading !== null}
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                            {isLoading('approve') ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve
                          </button>
                          <button onClick={() => handle('reject', trainer.id, trainer.name)} disabled={actionLoading !== null}
                            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                            {isLoading('reject') ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Reject
                          </button>
                        </>
                      )}
                      {isRejected && (
                        <button onClick={() => handle('approve', trainer.id, trainer.name)} disabled={actionLoading !== null}
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                          {isLoading('approve') ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve
                        </button>
                      )}

                      {/* Active/Inactive toggle switch */}
                      {canToggle && (
                        <div className="flex items-center gap-1.5">
                          <ToggleSwitch
                            checked={isActive}
                            onChange={() => handleToggle(trainer)}
                            disabled={actionLoading !== null}
                          />
                        </div>
                      )}

                      {/* Reset password (active + inactive trainers) */}
                      {(isActive || isInactive) && (
                        <button onClick={() => setResetTarget(trainer)} disabled={actionLoading !== null}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light disabled:opacity-50 transition"
                          title="Reset password">
                          <KeyRound size={14} />
                        </button>
                      )}

                      {/* Delete */}
                      <button onClick={() => setDeleteTarget(trainer)} disabled={actionLoading !== null}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition"
                        title="Delete trainer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <DeactivateModal
        trainer={deactivateTarget}
        onConfirm={handleDeactivateConfirm}
        onClose={() => setDeactivateTarget(null)}
        loading={deactivateLoading}
      />
      <ResetPasswordModal
        trainer={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <DeleteConfirmModal
        trainer={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  )
}
