import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight, UserPlus, Trash2, Calendar, Users, BarChart3, X, Loader2,
  CheckCircle, XCircle, Clock, FileText, Download, AlertCircle, BookOpen,
  Plus, Edit2, ArrowUp, ArrowDown, Shuffle, Wifi, Building2,
} from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  getBatch, getStudents, addStudent, removeStudent,
  getAttendanceByDate, markAttendance, getAttendanceSummary,
  getSyllabus, saveSyllabus, distributeTopics, getTopics,
} from '../api/index.js'
import SmartPlanner from '../components/SmartPlanner.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'students',  label: 'Students',  icon: Users },
  { id: 'attendance',label: 'Attendance',icon: Calendar },
  { id: 'syllabus',  label: 'Syllabus',  icon: BookOpen },
  { id: 'reports',   label: 'Reports',   icon: BarChart3 },
]
const WEEK_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MODE_OPTS = [
  { value: 'offline', label: '🏫 Offline' },
  { value: 'online',  label: '💻 Online'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSessionDates(startDate, endDate, classDays) {
  if (!startDate || !endDate || !classDays?.length) return []
  const dayNums = classDays.map(d => WEEK_DAYS.indexOf(d)).filter(n => n >= 0)
  const dates = []
  const end = new Date(endDate + 'T00:00:00')
  let cur = new Date(startDate + 'T00:00:00')
  while (cur <= end) {
    if (dayNums.includes(cur.getDay())) dates.push(format(cur, 'yyyy-MM-dd'))
    cur = addDays(cur, 1)
  }
  return dates
}

function buildDistribution(topics, sessions) {
  if (!topics.length || !sessions.length) return []
  const result = []
  if (topics.length <= sessions.length) {
    topics.forEach((t, i) => result.push({ date: sessions[i], items: [t] }))
  } else {
    const base = Math.floor(topics.length / sessions.length)
    const extra = topics.length % sessions.length
    let idx = 0
    sessions.forEach((date, i) => {
      const count = i < extra ? base + 1 : base
      const items = topics.slice(idx, idx + count)
      if (items.length) result.push({ date, items })
      idx += count
    })
  }
  return result
}

// ── AddStudentModal ───────────────────────────────────────────────────────────
function AddStudentModal({ open, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  useEffect(() => { if (open) setForm({ name: '', email: '', password: '' }) }, [open])
  if (!open) return null
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast.error('All fields are required'); return }
    onSubmit(form)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Add Student</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[{n:'name',l:'Full Name',t:'text',p:'John Doe'},{n:'email',l:'Email',t:'email',p:'john@example.com'},{n:'password',l:'Password',t:'password',p:'Min. 6 characters'}].map(f => (
            <div key={f.n}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.l} <span className="text-rose-500">*</span></label>
              <input type={f.t} value={form[f.n]} onChange={e => setForm(p => ({...p,[f.n]:e.target.value}))} placeholder={f.p}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition" />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Adding...</> : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = { present:'bg-emerald-50 text-emerald-700 border-emerald-200', absent:'bg-rose-50 text-rose-700 border-rose-200', late:'bg-amber-50 text-amber-700 border-amber-200' }
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${map[status]||'bg-slate-50 text-slate-500 border-slate-200'}`}>{status?.charAt(0)?.toUpperCase()+status?.slice(1)||'—'}</span>
}

function AttendanceToggle({ status, onChange }) {
  const opts = [
    {value:'present',icon:CheckCircle,color:'text-emerald-600',active:'bg-emerald-500 text-white border-emerald-500'},
    {value:'absent', icon:XCircle,    color:'text-rose-500',   active:'bg-rose-500 text-white border-rose-500'},
    {value:'late',   icon:Clock,      color:'text-amber-500',  active:'bg-amber-500 text-white border-amber-500'},
  ]
  return (
    <div className="flex gap-1">
      {opts.map(({value,icon:Icon,color,active}) => (
        <button key={value} type="button" onClick={() => onChange(value)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${status===value ? active : `bg-white border-slate-200 ${color} hover:bg-slate-50`}`}>
          <Icon size={13} />{value.charAt(0).toUpperCase()+value.slice(1)}
        </button>
      ))}
    </div>
  )
}

// ── SyllabusTab ────────────────────────────────────────────────────────────────
function SyllabusTab({ batch }) {
  const batchId = batch.id
  const [topics, setTopics] = useState([])          // syllabus list
  const [loading, setLoading] = useState(true)
  const [savingAll, setSavingAll] = useState(false)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', description: '', mode: 'offline' })

  // Edit
  const [editIdx, setEditIdx] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', mode: 'offline' })

  // Distribution preview
  const [preview, setPreview] = useState(null)   // [{date, items:[topic,...]}]
  const [distributing, setDistributing] = useState(false)

  const fetchSyllabus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSyllabus(batchId)
      setTopics(res.data.topics || [])
    } catch { toast.error('Failed to load syllabus') }
    finally { setLoading(false) }
  }, [batchId])

  useEffect(() => { fetchSyllabus() }, [fetchSyllabus])

  const save = async (list) => {
    setSavingAll(true)
    try {
      const res = await saveSyllabus(batchId, list.map(t => ({ title: t.title, description: t.description, mode: t.mode })))
      setTopics(res.data.topics || list)
    } catch { toast.error('Failed to save syllabus') }
    finally { setSavingAll(false) }
  }

  const handleAdd = async () => {
    if (!addForm.title.trim()) { toast.error('Topic title is required'); return }
    const newList = [...topics, { ...addForm, order_index: topics.length }]
    setShowAdd(false)
    setAddForm({ title: '', description: '', mode: 'offline' })
    await save(newList)
  }

  const handleDelete = async (idx) => {
    if (!window.confirm('Remove this topic?')) return
    const newList = topics.filter((_, i) => i !== idx)
    await save(newList)
  }

  const handleMoveUp = async (idx) => {
    if (idx === 0) return
    const list = [...topics]
    ;[list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]
    await save(list)
  }

  const handleMoveDown = async (idx) => {
    if (idx === topics.length - 1) return
    const list = [...topics]
    ;[list[idx], list[idx + 1]] = [list[idx + 1], list[idx]]
    await save(list)
  }

  const handleEditSave = async (idx) => {
    if (!editForm.title.trim()) { toast.error('Title required'); return }
    const newList = topics.map((t, i) => i === idx ? { ...t, ...editForm } : t)
    setEditIdx(null)
    await save(newList)
  }

  // Auto-distribute
  const handlePreview = () => {
    if (!topics.length) { toast.error('Add at least one topic first'); return }
    const classDays = Array.isArray(batch.class_days) ? batch.class_days : []
    if (!classDays.length) { toast.error('Set class days on the batch first (edit the batch)'); return }
    const sessions = getSessionDates(batch.start_date, batch.end_date, classDays)
    if (!sessions.length) { toast.error('No sessions found in the batch date range'); return }
    const dist = buildDistribution(topics, sessions)
    setPreview({ dist, sessions, totalSessions: sessions.length })
  }

  const handleConfirmDistribute = async () => {
    if (!preview) return
    setDistributing(true)
    try {
      const assignments = preview.dist.map(a => ({
        date: a.date,
        title: a.items.map(t => t.title).join(' + '),
        notes: a.items.length > 1
          ? a.items.map((t, i) => `${i + 1}. ${t.description || t.title}`).join('\n')
          : (a.items[0].description || null),
        mode: a.items[0].mode,
      }))
      await distributeTopics(batchId, assignments)
      toast.success(`${assignments.length} topics distributed to calendar!`)
      setPreview(null)
    } catch { toast.error('Distribution failed') }
    finally { setDistributing(false) }
  }

  const classDays = Array.isArray(batch.class_days) ? batch.class_days : []
  const sessionDates = getSessionDates(batch.start_date, batch.end_date, classDays)
  const modeIcon = (m) => m === 'online' ? '💻' : '🏫'

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>

  return (
    <div className="space-y-5">
      {/* Schedule info banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Batch Schedule</p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                {batch.mode === 'online' ? <Wifi size={12} className="text-brand-blue" /> : <Building2 size={12} className="text-slate-400" />}
                Mode: <strong className="text-slate-700 ml-0.5 capitalize">{batch.mode || 'Offline'}</strong>
              </span>
              {classDays.length > 0 ? (
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" />
                  {classDays.map(d => d.slice(0,3)).join(' · ')} · {sessionDates.length} total sessions
                </span>
              ) : (
                <span className="text-amber-600">⚠ No class days set — edit the batch to add them</span>
              )}
            </div>
          </div>
          <button
            onClick={handlePreview}
            disabled={!topics.length || !classDays.length}
            className="flex items-center gap-2 bg-[#1B3A6B] hover:bg-[#163058] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm">
            <Shuffle size={15} /> Auto-Distribute to Calendar
          </button>
        </div>
      </div>

      {/* Topics table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800">Syllabus Topics</h2>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{topics.length}</span>
          </div>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
              <Plus size={13} /> Add Topic
            </button>
          )}
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wider">New Topic</p>
            <div className="grid gap-3">
              <input value={addForm.title} onChange={e => setAddForm(f=>({...f,title:e.target.value}))}
                placeholder="Topic title *"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" autoFocus />
              <input value={addForm.description} onChange={e => setAddForm(f=>({...f,description:e.target.value}))}
                placeholder="Short description (optional)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <div className="flex items-center gap-3">
                <select value={addForm.mode} onChange={e => setAddForm(f=>({...f,mode:e.target.value}))}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
                  {MODE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => { setShowAdd(false); setAddForm({title:'',description:'',mode:'offline'}) }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition">Cancel</button>
                  <button onClick={handleAdd} disabled={savingAll}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition">
                    {savingAll ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {topics.length === 0 && !showAdd ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No topics yet</p>
            <p className="text-slate-400 text-xs mt-1">Add the topics you'll cover in this batch, then auto-distribute them to the calendar</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[40px_40px_1fr_1.5fr_100px_80px] gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>#</span>
              <span></span>
              <span>Title</span>
              <span>Description</span>
              <span>Mode</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-100">
              {topics.map((topic, idx) => (
                <div key={topic.id || idx}>
                  {editIdx === idx ? (
                    <div className="px-6 py-4 bg-slate-50/50">
                      <div className="grid gap-3">
                        <input value={editForm.title} onChange={e => setEditForm(f=>({...f,title:e.target.value}))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" autoFocus />
                        <input value={editForm.description} onChange={e => setEditForm(f=>({...f,description:e.target.value}))}
                          placeholder="Description (optional)"
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                        <div className="flex items-center gap-3">
                          <select value={editForm.mode} onChange={e => setEditForm(f=>({...f,mode:e.target.value}))}
                            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
                            {MODE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <div className="flex gap-2 ml-auto">
                            <button onClick={() => setEditIdx(null)} className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition">Cancel</button>
                            <button onClick={() => handleEditSave(idx)} disabled={savingAll}
                              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition">
                              {savingAll ? <Loader2 size={12} className="animate-spin" /> : null} Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[40px_40px_1fr] sm:grid-cols-[40px_40px_1fr_1.5fr_100px_80px] gap-3 items-center px-6 py-3.5 hover:bg-slate-50/50 transition">
                      <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMoveUp(idx)} disabled={idx === 0 || savingAll}
                          className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"><ArrowUp size={13} /></button>
                        <button onClick={() => handleMoveDown(idx)} disabled={idx === topics.length - 1 || savingAll}
                          className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"><ArrowDown size={13} /></button>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{topic.title}</p>
                        <p className="text-xs text-slate-400 truncate sm:hidden">{topic.description}</p>
                      </div>
                      <p className="hidden sm:block text-xs text-slate-500 truncate">{topic.description || '—'}</p>
                      <div className="hidden sm:flex items-center gap-1.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          topic.mode === 'online'
                            ? 'bg-brand-blue-light text-brand-blue'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {modeIcon(topic.mode)} {topic.mode === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center justify-end gap-1">
                        <button onClick={() => { setEditIdx(idx); setEditForm({title:topic.title,description:topic.description||'',mode:topic.mode||'offline'}) }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition" title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(idx)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Distribution Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Auto-Distribution Preview</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {topics.length} topic{topics.length !== 1 ? 's' : ''} across {preview.totalSessions} session{preview.totalSessions !== 1 ? 's' : ''} ({classDays.map(d => d.slice(0,3)).join('/')})
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"><X size={18} /></button>
            </div>

            {/* Warning */}
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-800 font-medium">
                ⚠ This will replace all existing calendar topics for this batch.
              </p>
              {topics.length <= preview.totalSessions ? (
                <p className="text-xs text-amber-600 mt-0.5">{preview.totalSessions - preview.dist.length} sessions will have no topic assigned.</p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">{preview.dist.filter(a => a.items.length > 1).length} session(s) will have multiple topics.</p>
              )}
            </div>

            {/* Distribution list */}
            <div className="overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100">
                {preview.dist.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 px-6 py-3">
                    <span className="text-xs text-slate-400 w-32 flex-shrink-0 pt-0.5">
                      {format(new Date(a.date + 'T00:00:00'), 'EEE, MMM d')}
                    </span>
                    <div className="min-w-0">
                      {a.items.map((t, j) => (
                        <div key={j} className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs">{modeIcon(t.mode)}</span>
                          <span className={`text-sm font-medium ${j > 0 ? 'text-slate-500' : 'text-slate-800'}`}>{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setPreview(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={handleConfirmDistribute} disabled={distributing}
                className="flex-1 bg-[#1B3A6B] hover:bg-[#163058] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition">
                {distributing ? <><Loader2 size={15} className="animate-spin" /> Distributing...</> : <><Shuffle size={15} /> Confirm & Distribute</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [students, setStudents] = useState([])
  const [activeTab, setActiveTab] = useState('students')
  const [loading, setLoading] = useState(true)

  const [addModal, setAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [attendanceData, setAttendanceData] = useState({})
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)

  const [summary, setSummary] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [calendarTopics, setCalendarTopics] = useState([])

  const fetchBatch = useCallback(async () => {
    try {
      const [bRes, sRes] = await Promise.all([getBatch(id), getStudents(id)])
      setBatch(bRes.data.batch || bRes.data)
      setStudents(sRes.data.students || sRes.data || [])
    } catch { toast.error('Failed to load batch details') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  useEffect(() => {
    // Load calendar topics for progress bar
    getTopics(id)
      .then(res => setCalendarTopics(res.data.topics || []))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (activeTab === 'reports') {
      setSummaryLoading(true)
      getAttendanceSummary(id)
        .then(res => setSummary(res.data.summary || []))
        .catch(console.error)
        .finally(() => setSummaryLoading(false))
    }
  }, [activeTab, id])

  const handleAddStudent = async (form) => {
    setAddLoading(true)
    try {
      await addStudent(id, form)
      toast.success('Student added!')
      setAddModal(false)
      fetchBatch()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add student') }
    finally { setAddLoading(false) }
  }

  const handleRemoveStudent = async (student) => {
    if (!window.confirm(`Remove ${student.name}?`)) return
    try {
      await removeStudent(id, student.id)
      toast.success('Student removed')
      fetchBatch()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to remove student') }
  }

  const handleLoadAttendance = async () => {
    setLoadingAttendance(true)
    try {
      const res = await getAttendanceByDate(id, attendanceDate)
      const records = res.data.records || []
      const map = {}
      students.forEach(s => (map[s.id] = 'present'))
      records.forEach(r => { if (r.student_id) map[r.student_id] = r.status })
      setAttendanceData(map)
      setAttendanceLoaded(true)
    } catch { toast.error('Failed to load attendance') }
    finally { setLoadingAttendance(false) }
  }

  const handleSaveAttendance = async () => {
    setSavingAttendance(true)
    try {
      const records = Object.entries(attendanceData).map(([student_id, status]) => ({ student_id, status }))
      await markAttendance(id, { date: attendanceDate, records })
      toast.success('Attendance saved!')
    } catch { toast.error('Failed to save attendance') }
    finally { setSavingAttendance(false) }
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16); doc.setTextColor('#1B3A6B')
    doc.text('Attendance Report', 14, 18)
    doc.setFontSize(11); doc.setTextColor('#64748B')
    doc.text(`Batch: ${batch?.name || ''}`, 14, 27)
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, 14, 34)
    const rows = summary.map(s => [s.name||'—', s.present??0, s.absent??0, s.late??0, (s.present??0)+(s.absent??0)+(s.late??0), `${s.percentage??0}%`])
    autoTable(doc, { startY: 40, head:[['Student','Present','Absent','Late','Total Days','%']], body:rows, headStyles:{fillColor:[27,58,107]}, alternateRowStyles:{fillColor:[254,243,217]}, styles:{fontSize:10,cellPadding:4} })
    doc.save(`attendance-${batch?.name||'report'}-${format(new Date(),'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported!')
  }

  const exportExcel = () => {
    const rows = summary.map(s => ({ Student:s.name||'—', Present:s.present??0, Absent:s.absent??0, Late:s.late??0, 'Total Days':(s.present??0)+(s.absent??0)+(s.late??0), 'Attendance %':`${s.percentage??0}%` }))
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance-${batch?.name||'report'}-${format(new Date(),'yyyy-MM-dd')}.xlsx`)
    toast.success('Excel exported!')
  }

  const formatDate = (d) => { try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—' } catch { return '—' } }

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!batch) return <div className="text-center py-32"><AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">Batch not found</p></div>

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/trainer/batches" className="text-slate-500 hover:text-primary transition">Batches</Link>
        <ChevronRight size={14} className="text-slate-400" />
        <span className="text-slate-800 font-medium truncate">{batch.name}</span>
      </div>

      {/* Batch info card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{batch.name}</h1>
              {batch.mode && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${batch.mode === 'online' ? 'bg-brand-blue-light text-brand-blue' : batch.mode === 'hybrid' ? 'bg-primary-light text-primary' : 'bg-slate-100 text-slate-600'}`}>
                  {batch.mode === 'online' ? '💻' : batch.mode === 'hybrid' ? '🔀' : '🏫'} {batch.mode.charAt(0).toUpperCase()+batch.mode.slice(1)}
                </span>
              )}
            </div>
            {batch.description && <p className="text-slate-500 text-sm mb-3">{batch.description}</p>}
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                {formatDate(batch.start_date)} — {formatDate(batch.end_date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-primary" />
                {students.length} students
              </span>
              {Array.isArray(batch.class_days) && batch.class_days.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <BookOpen size={14} className="text-primary" />
                  {batch.class_days.map(d => d.slice(0,3)).join(' · ')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPlannerOpen(true)}
              className="flex items-center gap-2 bg-[#1B3A6B] hover:bg-[#163058] text-white text-sm font-medium px-4 py-2 rounded-xl transition">
              <Shuffle size={15} /> Smart Planner
            </button>
            <Link to={`/trainer/calendar/${id}`}
              className="flex items-center gap-2 bg-primary-light hover:bg-primary text-primary hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition">
              <Calendar size={15} /> View Calendar
            </Link>
          </div>
        </div>
        {/* Progress bar */}
        {calendarTopics.length > 0 && (() => {
          const nonRev = calendarTopics.filter(t => !t.is_revision)
          const covered = nonRev.filter(t => t.completion_status === 'covered').length
          const pct = Math.round((covered / nonRev.length) * 100)
          return (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600">Syllabus Progress</span>
                <span className="text-xs font-bold text-slate-700">{covered} of {nonRev.length} topics covered ({pct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6 flex-wrap">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} onClick={() => setActiveTab(tid)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tid ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── Students Tab ── */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Enrolled Students
              <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{students.length}</span>
            </h2>
            <button onClick={() => setAddModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-xs font-medium px-3.5 py-2 rounded-xl transition">
              <UserPlus size={14} /> Add Student
            </button>
          </div>
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm mb-4">No students enrolled yet</p>
              <button onClick={() => setAddModal(true)} className="flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-dark transition">
                <UserPlus size={15} /> Add your first student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50">
                  {['Student','Email','Enrolled',''].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-semibold text-xs">{s.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          <span className="font-medium text-slate-700 text-sm">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">{s.email}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">{s.enrolled_at ? formatDate(s.enrolled_at) : '—'}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button onClick={() => handleRemoveStudent(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Attendance Tab ── */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Mark Attendance</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Select Date</label>
                <input type="date" value={attendanceDate} onChange={e => { setAttendanceDate(e.target.value); setAttendanceLoaded(false) }}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition" />
              </div>
              <button onClick={handleLoadAttendance} disabled={loadingAttendance || students.length === 0}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-50 transition">
                {loadingAttendance ? <><Loader2 size={15} className="animate-spin" /> Loading...</> : 'Load Attendance'}
              </button>
            </div>
          </div>
          {attendanceLoaded && (
            <div className="bg-white rounded-2xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Attendance for {format(parseISO(attendanceDate), 'MMMM d, yyyy')}</h3>
              </div>
              {students.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">No students enrolled</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="bg-slate-50">
                        {['Student','Status'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center"><span className="text-primary font-semibold text-xs">{s.name?.charAt(0)?.toUpperCase()}</span></div>
                                <span className="font-medium text-slate-700 text-sm">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <AttendanceToggle status={attendanceData[s.id]||'present'} onChange={val => setAttendanceData(p => ({...p,[s.id]:val}))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                    <button onClick={handleSaveAttendance} disabled={savingAttendance}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-60 transition shadow-sm shadow-primary/30">
                      {savingAttendance ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><CheckCircle size={15} /> Save Attendance</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Syllabus Tab ── */}
      {activeTab === 'syllabus' && <SyllabusTab batch={batch} />}

      {/* ── Reports Tab ── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Attendance Summary</h2>
            <div className="flex gap-2">
              <button onClick={exportPDF} disabled={summary.length === 0} className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium px-3.5 py-2 rounded-xl disabled:opacity-50 transition"><FileText size={13} /> Export PDF</button>
              <button onClick={exportExcel} disabled={summary.length === 0} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3.5 py-2 rounded-xl disabled:opacity-50 transition"><Download size={13} /> Export Excel</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : summary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><BarChart3 className="w-10 h-10 text-slate-300 mb-3" /><p className="text-slate-500 text-sm">No attendance data available</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-slate-50">
                    {['Student','Present','Absent','Late','Total','Attendance %'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.map((s, i) => {
                      const pct = s.percentage ?? 0
                      const barColor = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      const total = (s.present??0)+(s.absent??0)+(s.late??0)
                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0"><span className="text-primary font-semibold text-xs">{(s.name||'?').charAt(0).toUpperCase()}</span></div>
                              <span className="font-medium text-slate-700 text-sm">{s.name||'—'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4"><span className="text-sm font-semibold text-emerald-600">{s.present??0}</span></td>
                          <td className="px-6 py-4"><span className="text-sm font-semibold text-rose-500">{s.absent??0}</span></td>
                          <td className="px-6 py-4"><span className="text-sm font-semibold text-amber-500">{s.late??0}</span></td>
                          <td className="px-6 py-4 text-sm text-slate-600">{total}</td>
                          <td className="px-6 py-4 min-w-[160px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{width:`${Math.min(pct,100)}%`}} />
                              </div>
                              <span className={`text-xs font-bold min-w-[36px] text-right ${pct>=75?'text-emerald-600':pct>=50?'text-amber-600':'text-rose-600'}`}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <AddStudentModal open={addModal} onClose={() => setAddModal(false)} onSubmit={handleAddStudent} loading={addLoading} />

      {plannerOpen && (
        <SmartPlanner
          initialBatchId={id}
          onClose={() => setPlannerOpen(false)}
          onSuccess={() => {
            getTopics(id).then(res => setCalendarTopics(res.data.topics || [])).catch(() => {})
          }}
        />
      )}
    </>
  )
}
