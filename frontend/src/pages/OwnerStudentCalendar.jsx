import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, X, GraduationCap, CheckCircle2, XCircle, Clock, BookOpen, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getStudentCalendar } from '../api/index.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_STYLE = {
  present: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Present' },
  absent:  { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-500',    label: 'Absent' },
  late:    { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Late' },
  holiday: { bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Holiday' },
}

function fmt(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toYMD(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function buildGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  // JS: 0=Sun..6=Sat → convert to Mon-first: Mon=0..Sun=6
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ── Day Popup ─────────────────────────────────────────────────────────────────
function DayPopup({ date, attendance, topic, holiday, batches, onClose }) {
  const att = attendance
  const st = att ? STATUS_STYLE[att.status] : holiday ? STATUS_STYLE.holiday : null
  const batchName = att ? batches.find(b => b.batch_id === att.batch_id)?.batch_name || `Batch ${att.batch_id}` : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-800">{fmt(date)}</p>
            {batchName && <p className="text-xs text-slate-500 mt-0.5">{batchName}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {holiday && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Holiday</p>
                <p className="text-sm font-medium text-slate-700">{holiday.name}</p>
              </div>
            </div>
          )}
          {st && !holiday && (
            <div className={`flex items-center gap-2 ${st.bg} rounded-xl px-4 py-3`}>
              <span className={`w-2 h-2 rounded-full ${st.dot} flex-shrink-0`} />
              <p className={`text-sm font-semibold ${st.text}`}>{st.label}</p>
            </div>
          )}
          {!att && !holiday && (
            <p className="text-sm text-slate-400 text-center py-2">No attendance record for this day</p>
          )}
          {topic && (
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Topic Covered</p>
              <p className="text-sm font-semibold text-slate-800">{topic.title}</p>
              {topic.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{topic.notes}</p>}
              {topic.is_revision ? (
                <span className="inline-block mt-1.5 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Revision</span>
              ) : null}
              {topic.completion_status === 'completed' ? (
                <span className="inline-block mt-1.5 ml-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Completed</span>
              ) : null}
            </div>
          )}
          {!topic && att?.status === 'present' && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 text-center">No topic recorded for this session</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerStudentCalendar() {
  const { studentId } = useParams()
  const navigate      = useNavigate()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('summary')
  const [popup, setPopup]       = useState(null)

  const today   = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const load = useCallback(() => {
    setLoading(true)
    getStudentCalendar(studentId, monthStr)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load calendar'))
      .finally(() => setLoading(false))
  }, [studentId, monthStr])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const cells    = buildGrid(year, month)
  const att      = data?.attendance_map   || {}
  const topics   = data?.topics_map       || {}
  const holidays = data?.holidays         || []
  const stats    = data?.stats            || {}
  const student  = data?.student          || {}
  const batches  = data?.batches          || []

  const holidayByDate = {}
  holidays.forEach(h => { holidayByDate[h.date] = h })

  const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0

  const getDayStyle = (dateStr) => {
    if (holidayByDate[dateStr]) return 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'
    const a = att[dateStr]
    if (!a) return 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
    if (a.status === 'present') return 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300'
    if (a.status === 'absent')  return 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-300'
    if (a.status === 'late')    return 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300'
    return 'bg-white text-slate-400 border-slate-100'
  }

  const TABS = [
    { id: 'summary',  label: 'Attendance Summary' },
    { id: 'topics',   label: 'Topics Covered' },
    { id: 'absences', label: 'Absences' },
  ]

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/owner/calendars')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium mb-5 transition">
        <ArrowLeft size={16} /> Back to Calendars
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{student.name || 'Student'}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {batches.map(b => b.batch_name).join(', ') || 'No active batches'}
            </p>
          </div>
        </div>
        {/* All-time stats */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Present', value: stats.present ?? '—', color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Absent',  value: stats.absent  ?? '—', color: 'text-rose-600 bg-rose-50' },
            { label: 'Late',    value: stats.late    ?? '—', color: 'text-amber-600 bg-amber-50' },
            { label: 'Attendance', value: `${pct}%`, color: pct >= 75 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl px-4 py-2 text-center min-w-[68px] ${color}`}>
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs font-medium opacity-70">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5">
        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"><ChevronLeft size={18} /></button>
          <p className="font-bold text-slate-800">
            {new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"><ChevronRight size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : (
          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr  = toYMD(year, month, day)
                const isToday  = dateStr === toYMD(today.getFullYear(), today.getMonth(), today.getDate())
                const topic    = topics[dateStr]
                const holiday  = holidayByDate[dateStr]
                const isClickable = att[dateStr] || holiday || topic

                return (
                  <button key={i}
                    onClick={() => isClickable && setPopup(dateStr)}
                    className={`relative rounded-xl border p-1.5 min-h-[68px] flex flex-col items-start transition cursor-default ${isClickable ? 'cursor-pointer' : ''} ${getDayStyle(dateStr)}`}
                  >
                    <span className={`text-xs font-bold mb-1 ${isToday ? 'bg-[#F5A623] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]' : ''}`}>
                      {day}
                    </span>
                    {holiday && <span className="text-[9px] leading-tight text-slate-400 font-medium">🏖 {holiday.name.length > 10 ? holiday.name.slice(0, 10) + '…' : holiday.name}</span>}
                    {!holiday && topic && <span className="text-[9px] leading-tight truncate w-full font-medium">{topic.title}</span>}
                    {att[dateStr] && !holiday && (
                      <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${STATUS_STYLE[att[dateStr].status]?.dot}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-slate-100">
              {Object.entries(STATUS_STYLE).map(([key, s]) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                activeTab === t.id ? 'text-[#1B3A6B] border-b-2 border-[#1B3A6B]' : 'text-slate-400 hover:text-slate-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Attendance Summary ── */}
          {activeTab === 'summary' && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Monthly Breakdown (last 12 months)</p>
              {(data?.monthly_summary || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No data available</p>
              ) : (
                <div className="space-y-2">
                  {(data.monthly_summary || []).map(m => {
                    const mp = m.total > 0 ? Math.round((m.present / m.total) * 100) : 0
                    return (
                      <div key={m.month} className="flex items-center gap-3">
                        <p className="text-sm text-slate-600 w-24 font-medium flex-shrink-0">{m.month}</p>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${mp >= 75 ? 'bg-emerald-500' : mp >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${mp}%` }} />
                        </div>
                        <div className="text-xs text-slate-500 w-28 text-right flex-shrink-0">
                          {m.present}P / {m.absent}A / {m.late}L · <span className="font-bold">{mp}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Topics Covered ── */}
          {activeTab === 'topics' && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {stats.topics_covered || 0} Sessions with Topics
              </p>
              {(data?.topics_attended || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No topics recorded yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(data.topics_attended || []).map((t, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={13} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmt(t.date)}</p>
                      </div>
                      {t.is_revision ? <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-1">Revision</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Absences ── */}
          {activeTab === 'absences' && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Absent &amp; Late Records (all time)
              </p>
              {(() => {
                const absences = Object.entries(att)
                  .filter(([, v]) => v.status === 'absent' || v.status === 'late')
                  .sort(([a], [b]) => b.localeCompare(a))
                if (absences.length === 0)
                  return <p className="text-sm text-slate-400 py-4 text-center">No absences or late marks on record</p>
                return (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {absences.map(([date, rec]) => {
                      const s = STATUS_STYLE[rec.status]
                      const bn = batches.find(b => b.batch_id === rec.batch_id)?.batch_name || ''
                      return (
                        <div key={date} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          <p className="text-sm text-slate-700 font-medium">{fmt(date)}</p>
                          {bn && <p className="text-xs text-slate-400 ml-auto">{bn}</p>}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {popup && (
        <DayPopup
          date={popup}
          attendance={att[popup]}
          topic={topics[popup]}
          holiday={holidayByDate[popup]}
          batches={batches}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}
