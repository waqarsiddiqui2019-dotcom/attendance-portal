import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Eye, Pencil, Trash2, BookOpen, CalendarDays, Users, X, Loader2,
  Wifi, Building2, Layers,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { getBatches, createBatch, updateBatch, deleteBatch } from '../api/index.js'
import { showError } from '../utils/showError.jsx'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MODES = [
  { value: 'offline', label: 'Offline', icon: Building2 },
  { value: 'online',  label: 'Online',  icon: Wifi },
  { value: 'hybrid',  label: 'Hybrid',  icon: Layers },
]
const MODE_COLORS = {
  offline: 'bg-slate-100 text-slate-600',
  online:  'bg-brand-blue-light text-brand-blue',
  hybrid:  'bg-primary-light text-primary',
}

const emptyForm = {
  name: '', description: '', startDate: '', endDate: '',
  mode: 'offline', sessionsPerWeek: '', classDays: [],
}

function BatchModal({ open, onClose, onSubmit, initial, loading }) {
  const [form, setForm] = useState(initial || emptyForm)

  useEffect(() => { setForm(initial || emptyForm) }, [initial, open])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleDay = (day) => {
    set('classDays', form.classDays.includes(day)
      ? form.classDays.filter(d => d !== day)
      : [...form.classDays, day]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.startDate || !form.endDate) {
      toast.error('Please fill in all required fields')
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error('End date must be after start date')
      return
    }
    onSubmit(form)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-800">
            {initial?.id ? 'Edit Batch' : 'Create New Batch'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Batch Name <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g., Digital Marketing Batch Jan 2025"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Brief description of this batch..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition" />
            </div>
          </div>

          {/* Mode + Sessions per week */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch Mode</label>
              <select value={form.mode} onChange={e => set('mode', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition bg-white">
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sessions / Week</label>
              <input type="number" min={1} max={7} value={form.sessionsPerWeek}
                onChange={e => set('sessionsPerWeek', e.target.value)}
                placeholder="e.g. 3"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition" />
            </div>
          </div>

          {/* Class days */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Class Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => {
                const selected = form.classDays.includes(day)
                return (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      selected
                        ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-[#1B3A6B] hover:text-[#1B3A6B]'
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>
            {form.classDays.length > 0 && (
              <p className="text-xs text-slate-400 mt-1.5">
                {form.classDays.join(' · ')}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : initial?.id ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Batches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchBatches = () => {
    setLoading(true)
    getBatches()
      .then(res => setBatches(res.data.batches || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBatches() }, [])

  const toApi = (form) => ({
    name: form.name,
    description: form.description,
    start_date: form.startDate,
    end_date: form.endDate,
    mode: form.mode,
    sessions_per_week: form.sessionsPerWeek ? parseInt(form.sessionsPerWeek) : null,
    class_days: form.classDays,
  })

  const handleCreate = async (form) => {
    setSubmitting(true)
    try {
      await createBatch(toApi(form))
      toast.success('Batch created!')
      setModalOpen(false)
      fetchBatches()
    } catch (err) {
      showError(err, { action: 'create-batch' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (form) => {
    setSubmitting(true)
    try {
      await updateBatch(editTarget.id, toApi(form))
      toast.success('Batch updated ✅')
      setEditTarget(null)
      fetchBatches()
    } catch (err) {
      showError(err, { action: 'update-batch' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (batch) => {
    if (!window.confirm(`Delete "${batch.name}"? This cannot be undone.`)) return
    try {
      await deleteBatch(batch.id)
      toast.success('Batch deleted ✅')
      fetchBatches()
    } catch (err) {
      showError(err, { action: 'delete-batch' })
    }
  }

  const formatDate = (d) => {
    try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—' } catch { return '—' }
  }

  const toEditForm = (batch) => ({
    ...batch,
    startDate: batch.start_date?.split('T')[0] || '',
    endDate: batch.end_date?.split('T')[0] || '',
    mode: batch.mode || 'offline',
    sessionsPerWeek: batch.sessions_per_week || '',
    classDays: Array.isArray(batch.class_days) ? batch.class_days : [],
  })

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Batches</h1>
          <p className="text-slate-500 text-sm mt-1">Manage all your training batches</p>
        </div>
        <button onClick={() => { setEditTarget(null); setModalOpen(true) }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm shadow-primary/30">
          <Plus size={16} /> Create Batch
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-52 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No batches yet</h3>
          <p className="text-slate-400 text-sm mb-6 text-center max-w-xs">
            Create your first batch to start managing students and attendance.
          </p>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
            <Plus size={16} /> Create your first batch
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map(batch => {
            const modeLabel = MODES.find(m => m.value === batch.mode)?.label || 'Offline'
            const modeColor = MODE_COLORS[batch.mode] || MODE_COLORS.offline
            return (
              <div key={batch.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-primary/30 hover:shadow-md transition-all group">
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-slate-800 text-base leading-snug truncate">{batch.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${modeColor}`}>
                      {modeLabel}
                    </span>
                  </div>
                  {batch.description && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">{batch.description}</p>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays size={13} className="text-slate-400" />
                    {formatDate(batch.start_date)} — {formatDate(batch.end_date)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users size={13} className="text-slate-400" />
                    {batch.student_count || 0} students enrolled
                  </div>
                  {Array.isArray(batch.class_days) && batch.class_days.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {batch.class_days.map(d => (
                        <span key={d} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                          {d.slice(0,3)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                  <Link to={`/trainer/batches/${batch.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary-light hover:bg-primary text-primary hover:text-white text-xs font-medium py-2 rounded-lg transition">
                    <Eye size={13} /> View
                  </Link>
                  <button onClick={() => setEditTarget(toEditForm(batch))}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 text-xs font-medium py-2 px-3 rounded-lg transition">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(batch)}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-medium py-2 px-3 rounded-lg transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BatchModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} initial={null} loading={submitting} />
      <BatchModal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleUpdate} initial={editTarget} loading={submitting} />
    </>
  )
}
