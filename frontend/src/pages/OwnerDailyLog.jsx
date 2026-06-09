import React, { useState, useEffect, useCallback } from 'react'
import { NotebookPen, Plus, X, ChevronLeft, ChevronRight, Check, Trash2, Edit3, AlertTriangle, Clock, Send, Calendar as CalIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { getDailyLog, getDailyLogDots, getPendingFollowups, createLogEntry, updateLogEntry, deleteLogEntry, markFollowupDone, sendDailyReport } from '../api/index.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key:'phone_call',     label:'Phone Call',          emoji:'📞' },
  { key:'in_person',      label:'In-Person Meeting',   emoji:'🤝' },
  { key:'online_meeting', label:'Online Meeting',       emoji:'💻' },
  { key:'new_admission',  label:'New Admission',        emoji:'📝' },
  { key:'followup',       label:'Follow-up',            emoji:'🔄' },
  { key:'email_whatsapp', label:'Email/WhatsApp',       emoji:'📧' },
  { key:'fee_collection', label:'Fee Collection',       emoji:'💰' },
  { key:'complaint',      label:'Complaint/Issue',      emoji:'⚠️' },
  { key:'report_review',  label:'Report/Review',        emoji:'📊' },
  { key:'technical',      label:'Technical Task',       emoji:'🔧' },
  { key:'announcement',   label:'Announcement',         emoji:'📢' },
  { key:'counselling',    label:'Student Counselling',  emoji:'🎓' },
  { key:'other',          label:'Other',                emoji:'📌' },
]

const OUTCOMES = [
  { key:'positive',      label:'Positive / Done',           color:'bg-emerald-100 text-emerald-700' },
  { key:'pending',       label:'Pending / Follow-up needed', color:'bg-amber-100 text-amber-700' },
  { key:'negative',      label:'Negative / Cancelled',       color:'bg-rose-100 text-rose-700' },
  { key:'informational', label:'Informational',              color:'bg-blue-100 text-blue-700' },
]

const PRIORITIES = [
  { key:'low',    label:'Low',    color:'text-slate-500' },
  { key:'medium', label:'Medium', color:'text-amber-600' },
  { key:'high',   label:'High',   color:'text-orange-600' },
  { key:'urgent', label:'Urgent', color:'text-rose-600' },
]

const OUTCOME_COLORS = { positive:'#10b981', pending:'#f59e0b', negative:'#ef4444', informational:'#3b82f6' }

function getCategoryInfo(key) { return CATEGORIES.find(c => c.key === key) || { emoji:'📌', label: key } }
function getOutcomeInfo(key)   { return OUTCOMES.find(o => o.key === key) || { label: key, color:'bg-slate-100 text-slate-500' } }

const TODAY = new Date().toISOString().slice(0, 10)
function fmtDisplayDate(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) } catch { return d }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Input({ className='', ...p }) {
  return <input className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${className}`} {...p} />
}
function Select({ children, className='', ...p }) {
  return <select className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white ${className}`} {...p}>{children}</select>
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────

function LogEntryModal({ entry, date, onClose, onSaved }) {
  const now = new Date()
  const defaultTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  const [form, setForm] = useState(entry ? {
    log_time:         entry.log_time,
    category:         entry.category,
    person_name:      entry.person_name || '',
    description:      entry.description,
    outcome:          entry.outcome,
    followup_required:!!entry.followup_required,
    followup_date:    entry.followup_date || '',
    followup_note:    entry.followup_note || '',
    priority:         entry.priority,
  } : {
    log_time: defaultTime, category: 'phone_call', person_name: '',
    description: '', outcome: 'informational', followup_required: false,
    followup_date: '', followup_note: '', priority: 'medium',
  })

  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error('Description is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, log_date: date }
      if (entry) { await updateLogEntry(entry.id, payload) } else { await createLogEntry(payload) }
      toast.success(entry ? 'Entry updated' : 'Activity logged')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save entry')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-bold text-slate-800">{entry ? 'Edit Activity' : 'Log Activity'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Time *</label>
              <Input type="time" value={form.log_time} onChange={e => set('log_time', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
              <Select value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Activity Category *</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {CATEGORIES.map(c => (
                <label key={c.key} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border cursor-pointer text-xs transition ${form.category === c.key ? 'bg-primary/10 border-primary text-primary font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" className="sr-only" value={c.key} checked={form.category === c.key} onChange={() => set('category', c.key)} />
                  <span>{c.emoji}</span> {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Person / Student Name</label>
            <Input value={form.person_name} onChange={e => set('person_name', e.target.value)} placeholder="Who was this with? (optional)" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="What happened, what was discussed, what was the outcome…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Outcome</label>
            <div className="grid grid-cols-2 gap-1.5">
              {OUTCOMES.map(o => (
                <label key={o.key} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border cursor-pointer text-xs transition ${form.outcome === o.key ? `${o.color} border-current font-semibold` : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" className="sr-only" value={o.key} checked={form.outcome === o.key} onChange={() => set('outcome', o.key)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`w-9 h-5 rounded-full flex items-center transition-colors ${form.followup_required ? 'bg-primary' : 'bg-slate-300'}`} onClick={() => set('followup_required', !form.followup_required)}>
                <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform ${form.followup_required ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">Follow-up Required</span>
            </label>
            {form.followup_required && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Follow-up Date</label>
                  <Input type="date" value={form.followup_date} onChange={e => set('followup_date', e.target.value)} min={date} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Follow-up Note</label>
                  <Input value={form.followup_note} onChange={e => set('followup_note', e.target.value)} placeholder="What needs to be done?" />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition">
            {saving ? 'Saving…' : entry ? 'Save Changes' : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ selectedDate, onSelect, dots }) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate + 'T00:00:00'))

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthKey = `${year}-${String(month + 1).padStart(2,'0')}`

  const dotDates = new Set((dots || []).map(d => d.log_date))

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const monthLabel = viewDate.toLocaleDateString('en-GB',{month:'long',year:'numeric'})

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold text-slate-700">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const isSelected = dateStr === selectedDate
          const isToday    = dateStr === TODAY
          const hasDot     = dotDates.has(dateStr)
          return (
            <button key={d} onClick={() => onSelect(dateStr)}
              className={`relative aspect-square flex items-center justify-center text-xs rounded-lg transition font-medium ${
                isSelected ? 'bg-primary text-white' : isToday ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'
              }`}>
              {d}
              {hasDot && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
              {hasDot && isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/80" />}
            </button>
          )
        })}
      </div>
      <button onClick={() => { onSelect(TODAY); setViewDate(new Date()) }}
        className="mt-3 w-full text-xs text-center text-primary hover:underline font-medium">
        Today
      </button>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ date, onAddClick }) {
  const [entries,  setEntries]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editEntry, setEditEntry] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getDailyLog(date)
      .then(r => setEntries(r.data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [date])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try { await deleteLogEntry(id); toast.success('Entry deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  // Stats
  const stats = {
    total:     entries.length,
    admissions: entries.filter(e => e.category === 'new_admission').length,
    calls:     entries.filter(e => e.category === 'phone_call').length,
    followups: entries.filter(e => e.followup_required && !e.followup_done).length,
    issues:    entries.filter(e => e.category === 'complaint').length,
  }

  return (
    <div>
      {/* Date header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{fmtDisplayDate(date)}</h2>
          <p className="text-xs text-slate-500">{entries.length} activit{entries.length === 1 ? 'y' : 'ies'} logged</p>
        </div>
        <button onClick={onAddClick}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
          <Plus size={15} /> Add Activity
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {[['Total',stats.total,'#F5A623'],['Admissions',stats.admissions,'#10b981'],['Calls',stats.calls,'#2272B9'],['Follow-ups',stats.followups,'#f59e0b'],['Issues',stats.issues,'#ef4444']].map(([label,val,color]) => (
          <div key={label} className="bg-white rounded-xl p-3 border border-slate-200 text-center shadow-sm">
            <p className="text-xl font-bold" style={{color}}>{val}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <NotebookPen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No activities logged for this day</p>
          <button onClick={onAddClick} className="mt-3 text-sm text-primary font-medium hover:underline">Log the first activity</button>
        </div>
      ) : (
        <div className="relative pl-16">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {entries.map(e => {
              const cat = getCategoryInfo(e.category)
              const out = getOutcomeInfo(e.outcome)
              const dotColor = OUTCOME_COLORS[e.outcome] || '#94a3b8'
              return (
                <div key={e.id} className="relative">
                  {/* Time */}
                  <div className="absolute -left-16 top-3 text-xs text-slate-400 font-mono w-12 text-right">{e.log_time}</div>
                  {/* Dot */}
                  <div className="absolute -left-2.5 top-3.5 w-4 h-4 rounded-full border-2 border-white shadow" style={{background: dotColor}} />
                  {/* Card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0 mt-0.5">{cat.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{cat.label}</span>
                            {e.person_name && <span className="text-xs text-slate-500">· {e.person_name}</span>}
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${out.color}`}>{out.label}</span>
                            {e.priority !== 'low' && e.priority !== 'medium' && (
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${e.priority === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>{e.priority}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{e.description}</p>
                          {e.followup_required && !e.followup_done && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 w-fit">
                              <Clock size={11} /> Follow-up {e.followup_date ? `due ${e.followup_date}` : 'pending'}
                              {e.followup_note && ` · ${e.followup_note}`}
                            </div>
                          )}
                          {e.followup_done && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 w-fit">
                              <Check size={11} /> Follow-up done
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setEditEntry(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition"><Edit3 size={13} /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editEntry && (
        <LogEntryModal entry={editEntry} date={date} onClose={() => setEditEntry(null)} onSaved={() => { setEditEntry(null); load() }} />
      )}
    </div>
  )
}

// ── Follow-ups Tab ────────────────────────────────────────────────────────────

function FollowupsTab() {
  const [followups, setFollowups] = useState([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getPendingFollowups()
      .then(r => setFollowups(r.data.followups || []))
      .catch(() => setFollowups([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDone = async (id) => {
    try { await markFollowupDone(id); toast.success('Follow-up marked as done'); load() }
    catch { toast.error('Failed to update') }
  }

  if (loading) return <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>

  if (followups.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <Check className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
      <p className="font-medium text-emerald-600">All caught up! No pending follow-ups.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {followups.map(f => {
        const cat = getCategoryInfo(f.category)
        const overdue = f.followup_date && f.followup_date < TODAY
        return (
          <div key={f.id} className={`bg-white rounded-xl border p-4 shadow-sm ${overdue ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="text-lg">{cat.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{cat.label}</span>
                    {f.person_name && <span className="text-xs text-slate-500">· {f.person_name}</span>}
                    {overdue && <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><AlertTriangle size={10} /> Overdue</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Logged: {f.log_date} · Due: {f.followup_date || 'Not set'}</p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{f.description}</p>
                  {f.followup_note && <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded px-2 py-0.5 w-fit">{f.followup_note}</p>}
                </div>
              </div>
              <button onClick={() => handleDone(f.id)}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition flex-shrink-0">
                <Check size={12} /> Done
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OwnerDailyLog() {
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [activeTab, setActiveTab]       = useState('log')
  const [dots, setDots]                 = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [dotsMonth, setDotsMonth]       = useState(TODAY.slice(0, 7))
  const [sendingReport, setSendingReport] = useState(false)

  const loadDots = useCallback((month) => {
    getDailyLogDots(month).then(r => setDots(r.data.dots || [])).catch(() => {})
  }, [])

  useEffect(() => { loadDots(dotsMonth) }, [dotsMonth, loadDots])

  const handleDateSelect = (d) => {
    setSelectedDate(d)
    const m = d.slice(0,7)
    if (m !== dotsMonth) setDotsMonth(m)
  }

  const refreshDots = () => loadDots(selectedDate.slice(0,7))

  const handleSendReport = async () => {
    setSendingReport(true)
    try {
      await sendDailyReport(selectedDate)
      toast.success('Report triggered — will be sent to owner shortly')
    } catch { toast.error('Failed to trigger report') }
    finally { setSendingReport(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Log</h1>
          <p className="text-slate-500 text-sm mt-1">Track all admin activities day by day</p>
        </div>
        <button onClick={handleSendReport} disabled={sendingReport}
          className="flex items-center gap-2 border border-slate-200 hover:border-primary hover:text-primary text-slate-600 text-sm font-medium px-4 py-2 rounded-xl transition disabled:opacity-50">
          <Send size={14} /> {sendingReport ? 'Sending…' : 'Send Report Now'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-medium w-fit mb-5">
        <button onClick={() => setActiveTab('log')} className={`px-4 py-2 transition ${activeTab === 'log' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <span className="flex items-center gap-1.5"><CalIcon size={14} /> Activity Log</span>
        </button>
        <button onClick={() => setActiveTab('followups')} className={`px-4 py-2 transition ${activeTab === 'followups' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <span className="flex items-center gap-1.5"><Clock size={14} /> Pending Follow-ups</span>
        </button>
      </div>

      {activeTab === 'log' && (
        <div className="flex gap-5 items-start">
          {/* Left: calendar */}
          <div className="w-56 flex-shrink-0">
            <MiniCalendar selectedDate={selectedDate} onSelect={handleDateSelect} dots={dots} />
          </div>
          {/* Right: day view */}
          <div className="flex-1 min-w-0">
            <DayView
              date={selectedDate}
              onAddClick={() => setShowAddModal(true)}
            />
          </div>
        </div>
      )}

      {activeTab === 'followups' && <FollowupsTab />}

      {showAddModal && (
        <LogEntryModal
          date={selectedDate}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); refreshDots() }}
        />
      )}
    </div>
  )
}
