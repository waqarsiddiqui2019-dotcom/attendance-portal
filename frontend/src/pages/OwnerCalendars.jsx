import React, { useEffect, useState } from 'react'
import { CalendarDays, Users, GraduationCap, ChevronDown, Loader2, Plus, Trash2, X, CalendarRange } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getOwnerStudents, getOwnerTrainers, getHolidays, createHoliday, deleteHoliday, getOwnerBatches } from '../api/index.js'

// ── Holiday Management Panel ──────────────────────────────────────────────────
function HolidayPanel({ onClose }) {
  const [holidays, setHolidays]   = useState([])
  const [batches, setBatches]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [date, setDate]           = useState('')
  const [name, setName]           = useState('')
  const [scope, setScope]         = useState('all')
  const [selectedBatches, setSelectedBatches] = useState([])
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    Promise.all([getHolidays(), getOwnerBatches()])
      .then(([h, b]) => { setHolidays(h.data.holidays || []); setBatches(b.data.batches || []) })
      .catch(() => toast.error('Failed to load holidays'))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!date || !name.trim()) { toast.error('Date and name are required'); return }
    setSaving(true)
    try {
      const payload = { date, name: name.trim(), applies_to: scope, batch_ids: scope === 'specific' ? selectedBatches : null }
      const res = await createHoliday(payload)
      setHolidays(prev => [...prev, res.data.holiday].sort((a, b) => a.date.localeCompare(b.date)))
      setDate(''); setName(''); setScope('all'); setSelectedBatches([])
      toast.success('Holiday added ✅')
    } catch { toast.error('Failed to add holiday') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, hname) => {
    if (!window.confirm(`Remove "${hname}"?`)) return
    try {
      await deleteHoliday(id)
      setHolidays(prev => prev.filter(h => h.id !== id))
      toast.success('Removed ✅')
    } catch { toast.error('Failed to remove holiday') }
  }

  const toggleBatch = (bid) =>
    setSelectedBatches(prev => prev.includes(bid) ? prev.filter(b => b !== bid) : [...prev, bid])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-[#1B3A6B]" />
            <h2 className="font-bold text-slate-800">Manage Holidays</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Add form */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Holiday</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Holiday Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eid Holiday"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Applies To</label>
              <div className="flex gap-3">
                {['all','specific'].map(s => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                    <input type="radio" name="scope" checked={scope===s} onChange={() => setScope(s)} className="accent-primary" />
                    {s === 'all' ? 'All Batches' : 'Specific Batches'}
                  </label>
                ))}
              </div>
            </div>
            {scope === 'specific' && batches.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {batches.map(b => (
                  <button key={b.id} onClick={() => toggleBatch(b.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                      selectedBatches.includes(b.id)
                        ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#1B3A6B]/40'
                    }`}>
                    {b.name}
                  </button>
                ))}
              </div>
            )}
            <button onClick={handleAdd} disabled={saving}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {saving ? 'Adding...' : 'Add Holiday'}
            </button>
          </div>

          {/* Holiday list */}
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
          ) : holidays.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">No holidays marked yet</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{holidays.length} Holiday{holidays.length !== 1 ? 's' : ''}</p>
              {holidays.map(h => (
                <div key={h.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{h.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                      {' · '}{h.applies_to === 'all' ? 'All batches' : 'Specific batches'}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(h.id, h.name)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Calendars page ───────────────────────────────────────────────────────
export default function OwnerCalendars() {
  const navigate = useNavigate()
  const [type, setType]           = useState('student')
  const [students, setStudents]   = useState([])
  const [trainers, setTrainers]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [holidayPanel, setHolidayPanel] = useState(false)

  useEffect(() => {
    Promise.all([getOwnerStudents(), getOwnerTrainers()])
      .then(([s, t]) => { setStudents(s.data.students || []); setTrainers(t.data.trainers || []) })
      .catch(() => toast.error('Failed to load people'))
      .finally(() => setLoading(false))
  }, [])

  const list = type === 'student' ? students : trainers.filter(t => t.status === 'active')

  const handleOpen = () => {
    if (!selectedId) { toast.error('Please select a person first'); return }
    navigate(`/owner/calendars/${type}/${selectedId}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B3A6B] flex items-center justify-center">
            <CalendarDays size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Calendars</h1>
            <p className="text-slate-500 text-sm mt-0.5">View individual attendance calendars for students and trainers</p>
          </div>
        </div>
        <button onClick={() => setHolidayPanel(true)}
          className="flex items-center gap-2 bg-[#1B3A6B] hover:bg-[#163058] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          <CalendarRange size={15} /> Manage Holidays
        </button>
      </div>

      {/* Selector card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg">
        <p className="text-sm font-semibold text-slate-700 mb-4">Open a Calendar</p>

        {/* Type toggle */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl mb-4">
          {[
            { id: 'student', label: 'Student Calendar', icon: GraduationCap },
            { id: 'trainer', label: 'Trainer Calendar', icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setType(id); setSelectedId('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
                type === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Person select */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-3"><Loader2 size={14} className="animate-spin" /> Loading...</div>
        ) : (
          <div className="relative mb-4">
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none">
              <option value="">— Select {type === 'student' ? 'a student' : 'a trainer'} —</option>
              {list.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {type === 'student' && p.batches?.length
                    ? ` (${p.batches.map(b => b.batch_name).join(', ')})`
                    : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        <button onClick={handleOpen} disabled={!selectedId}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl disabled:opacity-40 transition">
          <CalendarDays size={16} /> Open Calendar
        </button>
      </div>

      {holidayPanel && <HolidayPanel onClose={() => setHolidayPanel(false)} />}
    </div>
  )
}
