import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  BookOpen,
  CalendarDays,
  Users,
  X,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import {
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
} from '../api/index.js'

const emptyForm = { name: '', description: '', startDate: '', endDate: '' }

function BatchModal({ open, onClose, onSubmit, initial, loading }) {
  const [form, setForm] = useState(initial || emptyForm)

  useEffect(() => {
    setForm(initial || emptyForm)
  }, [initial, open])

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">
            {initial?.id ? 'Edit Batch' : 'Create New Batch'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Batch Name <span className="text-rose-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., Full Stack Batch 2024"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description of this batch..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : initial?.id ? (
                'Save Changes'
              ) : (
                'Create Batch'
              )}
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
      .then((res) => setBatches(res.data.batches || res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const handleCreate = async (form) => {
    setSubmitting(true)
    try {
      await createBatch({ name: form.name, description: form.description, start_date: form.startDate, end_date: form.endDate })
      toast.success('Batch created successfully!')
      setModalOpen(false)
      fetchBatches()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create batch')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (form) => {
    setSubmitting(true)
    try {
      await updateBatch(editTarget.id, { name: form.name, description: form.description, start_date: form.startDate, end_date: form.endDate })
      toast.success('Batch updated!')
      setEditTarget(null)
      fetchBatches()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update batch')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (batch) => {
    if (!window.confirm(`Delete "${batch.name}"? This action cannot be undone.`))
      return
    try {
      await deleteBatch(batch.id)
      toast.success('Batch deleted')
      fetchBatches()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete batch')
    }
  }

  const formatDate = (d) => {
    try {
      return d ? format(parseISO(d), 'MMM d, yyyy') : '—'
    } catch {
      return '—'
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Batches</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage all your training batches
          </p>
        </div>
        <button
          onClick={() => {
            setEditTarget(null)
            setModalOpen(true)
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm shadow-primary/30"
        >
          <Plus size={16} /> Create Batch
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 bg-white rounded-2xl border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            No batches yet
          </h3>
          <p className="text-slate-400 text-sm mb-6 text-center max-w-xs">
            Create your first batch to start managing students and attendance.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <Plus size={16} /> Create your first batch
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-primary/30 hover:shadow-md transition-all group"
            >
              {/* Header */}
              <div className="mb-3">
                <h3 className="font-bold text-slate-800 text-base leading-snug truncate">
                  {batch.name}
                </h3>
                {batch.description && (
                  <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                    {batch.description}
                  </p>
                )}
              </div>

              {/* Meta */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays size={13} className="text-slate-400" />
                  <span>
                    {formatDate(batch.start_date)} — {formatDate(batch.end_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Users size={13} className="text-slate-400" />
                  <span>
                    {batch.student_count || batch.students?.length || 0} students enrolled
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                <Link
                  to={`/trainer/batches/${batch.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary-light hover:bg-primary text-primary hover:text-white text-xs font-medium py-2 rounded-lg transition"
                >
                  <Eye size={13} /> View
                </Link>
                <button
                  onClick={() => {
                    setEditTarget({
                      ...batch,
                      startDate: batch.start_date?.split('T')[0] || '',
                      endDate: batch.end_date?.split('T')[0] || '',
                    })
                  }}
                  className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 text-xs font-medium py-2 px-3 rounded-lg transition"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(batch)}
                  className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-medium py-2 px-3 rounded-lg transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <BatchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        initial={null}
        loading={submitting}
      />

      {/* Edit modal */}
      <BatchModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleUpdate}
        initial={editTarget}
        loading={submitting}
      />
    </>
  )
}
