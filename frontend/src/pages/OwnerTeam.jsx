import React, { useEffect, useState, useCallback } from 'react'
import { Users, CheckCircle, XCircle, Clock, Trash2, Loader2, UserCheck, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { getOwnerTrainers, approveTrainer, rejectTrainer, deleteTrainer } from '../api/index.js'

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: Clock,        badge: 'bg-amber-100 text-amber-700 border-amber-200',  row: 'border-l-amber-400' },
  active:   { label: 'Approved', icon: CheckCircle,  badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', row: 'border-l-emerald-400' },
  rejected: { label: 'Rejected', icon: XCircle,      badge: 'bg-rose-100 text-rose-700 border-rose-200',     row: 'border-l-rose-400' },
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

const FILTERS = ['all', 'pending', 'active', 'rejected']
const FILTER_LABELS = { all: 'All', pending: 'Pending', active: 'Approved', rejected: 'Rejected' }

export default function OwnerTeam() {
  const [trainers, setTrainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)

  const fetchTrainers = useCallback(() => {
    setLoading(true)
    getOwnerTrainers()
      .then(res => setTrainers(res.data.trainers || []))
      .catch(() => toast.error('Failed to load trainers'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTrainers() }, [fetchTrainers])

  const handle = async (action, id, name) => {
    const confirmMsg = action === 'delete'
      ? `Remove ${name} permanently? Their batches will also be deleted.`
      : null
    if (confirmMsg && !window.confirm(confirmMsg)) return

    setActionLoading(`${action}-${id}`)
    try {
      if (action === 'approve') { await approveTrainer(id); toast.success(`${name} approved!`) }
      if (action === 'reject')  { await rejectTrainer(id);  toast.success(`${name} rejected`) }
      if (action === 'delete')  { await deleteTrainer(id);  toast.success(`${name} removed`) }
      fetchTrainers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const counts = {
    all:      trainers.length,
    pending:  trainers.filter(t => t.status === 'pending').length,
    active:   trainers.filter(t => t.status === 'active').length,
    rejected: trainers.filter(t => t.status === 'rejected').length,
  }

  const visible = filter === 'all' ? trainers : trainers.filter(t => t.status === filter)

  const formatDate = (d) => {
    try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—' } catch { return '—' }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Team Management</h1>
        <p className="text-slate-500 text-sm mt-1">Approve, reject, or remove trainer accounts</p>
      </div>

      {/* Pending alert */}
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

      {/* Table */}
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
            {filter === 'all' && (
              <p className="text-slate-400 text-xs mt-1">Trainers will appear here when they sign up</p>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Trainer</span>
              <span>Email</span>
              <span>Joined</span>
              <span>Actions</span>
            </div>

            <div className="divide-y divide-slate-100">
              {visible.map(trainer => {
                const isLoading = (key) => actionLoading === `${key}-${trainer.id}`
                return (
                  <div key={trainer.id}
                    className={`flex flex-col sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto] gap-3 sm:gap-4 items-start sm:items-center px-6 py-4 hover:bg-slate-50/60 transition border-l-4 ${STATUS_CONFIG[trainer.status]?.row || ''}`}>

                    {/* Name + status */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: trainer.status === 'pending' ? '#FEF3D9' : trainer.status === 'active' ? '#d1fae5' : '#fee2e2',
                                 color:      trainer.status === 'pending' ? '#D4891A' : trainer.status === 'active' ? '#065f46' : '#b91c1c' }}>
                        {trainer.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{trainer.name}</p>
                        <div className="mt-0.5"><StatusBadge status={trainer.status} /></div>
                      </div>
                    </div>

                    {/* Email */}
                    <p className="text-sm text-slate-500 truncate pl-12 sm:pl-0">{trainer.email}</p>

                    {/* Date */}
                    <p className="text-xs text-slate-400 pl-12 sm:pl-0">{formatDate(trainer.created_at)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pl-12 sm:pl-0 flex-wrap">
                      {trainer.status === 'pending' && (
                        <>
                          <button onClick={() => handle('approve', trainer.id, trainer.name)}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                            {isLoading('approve') ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Approve
                          </button>
                          <button onClick={() => handle('reject', trainer.id, trainer.name)}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                            {isLoading('reject') ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            Reject
                          </button>
                        </>
                      )}
                      {trainer.status === 'active' && (
                        <button onClick={() => handle('reject', trainer.id, trainer.name)}
                          disabled={actionLoading !== null}
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                          {isLoading('reject') ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                          Revoke
                        </button>
                      )}
                      {trainer.status === 'rejected' && (
                        <button onClick={() => handle('approve', trainer.id, trainer.name)}
                          disabled={actionLoading !== null}
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition">
                          {isLoading('approve') ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Approve
                        </button>
                      )}
                      <button onClick={() => handle('delete', trainer.id, trainer.name)}
                        disabled={actionLoading !== null}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition">
                        {isLoading('delete') ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
