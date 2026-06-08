import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, X, Users, BookOpen, BarChart3, Loader2, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTrainerCalendar } from '../api/index.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmt(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toYMD(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function buildGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getPct(sessions) {
  if (!sessions?.length) return null
  const agg = sessions.reduce((a, s) => ({ p: a.p + s.present, t: a.t + s.total }), { p: 0, t: 0 })
  return agg.t > 0 ? Math.round((agg.p / agg.t) * 100) : null
}

function getDayCellStyle(sessions, holiday) {
  if (holiday) return 'bg-slate-100 text-slate-500 border-slate-200'
  if (!sessions?.length) return 'bg-white text-slate-400 border-slate-100'
  const pct = getPct(sessions)
  if (pct === null) return 'bg-orange-50 text-orange-700 border-orange-200'
  if (pct >= 85)   return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (pct < 75)    return 'bg-rose-50 text-rose-800 border-rose-200'
  return 'bg-orange-50 text-orange-700 border-orange-200'
}

// ── Day Popup ─────────────────────────────────────────────────────────────────
function DayPopup({ date, sessions, holiday, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="font-bold text-slate-800">{fmt(date)}</p>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {holiday && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Holiday</p>
                <p className="text-sm font-medium text-slate-700">{holiday.name}</p>
              </div>
            </div>
          )}
          {!holiday && (!sessions?.length) && (
            <p className="text-sm text-slate-400 text-center py-4">No sessions on this day</p>
          )}
          {sessions?.map((s, i) => {
            const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0
            return (
              <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 text-sm">{s.batch_name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 85 ? 'bg-emerald-100 text-emerald-700' : pct < 75 ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{s.present} present</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{s.absent} absent</span>
                  {s.late > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{s.late} late</span>}
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct < 75 ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                </div>
                {s.topic && (
                  <p className="text-xs text-blue-600 font-medium mt-1">📖 {s.topic}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerTrainerCalendar() {
  const { trainerId } = useParams()
  const navigate      = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary')
  const [popup, setPopup]     = useState(null)

  const today  = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const load = useCallback(() => {
    setLoading(true)
    getTrainerCalendar(trainerId, monthStr)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load calendar'))
      .finally(() => setLoading(false))
  }, [trainerId, monthStr])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const cells    = buildGrid(year, month)
  const sessions = data?.sessions_map     || {}
  const holidays = data?.holidays         || []
  const stats    = data?.stats            || {}
  const trainer  = data?.trainer          || {}
  const batches  = data?.batches          || []

  const holidayByDate = {}
  holidays.forEach(h => { holidayByDate[h.date] = h })

  const TABS = [
    { id: 'summary',     label: 'Session Summary' },
    { id: 'topics',      label: 'Topic Coverage' },
    { id: 'performance', label: 'Batch Performance' },
  ]

  return (
    <div>
      <button onClick={() => navigate('/owner/calendars')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium mb-5 transition">
        <ArrowLeft size={16} /> Back to Calendars
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1B3A6B] flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{trainer.name || 'Trainer'}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{trainer.email || ''}</p>
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Total Sessions',  value: stats.total_sessions ?? '—', color: 'text-[#1B3A6B] bg-blue-50' },
            { label: 'Topics Taught',   value: stats.total_topics   ?? '—', color: 'text-blue-600 bg-blue-50' },
            { label: 'Avg Attendance',  value: stats.avg_pct != null ? `${stats.avg_pct}%` : '—',
              color: stats.avg_pct >= 75 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl px-4 py-2 text-center min-w-[80px] ${color}`}>
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs font-medium opacity-70">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5">
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
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr  = toYMD(year, month, day)
                const isToday  = dateStr === toYMD(today.getFullYear(), today.getMonth(), today.getDate())
                const sess     = sessions[dateStr]
                const holiday  = holidayByDate[dateStr]
                const isClickable = (sess?.length > 0) || holiday

                return (
                  <button key={i}
                    onClick={() => isClickable && setPopup(dateStr)}
                    className={`relative rounded-xl border p-1.5 min-h-[68px] flex flex-col items-start transition ${isClickable ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'} ${getDayCellStyle(sess, holiday)}`}
                  >
                    <span className={`text-xs font-bold mb-1 ${isToday ? 'bg-[#F5A623] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]' : ''}`}>
                      {day}
                    </span>
                    {holiday && <span className="text-[9px] leading-tight text-slate-400 font-medium">🏖 Holiday</span>}
                    {!holiday && sess?.length > 0 && (
                      <>
                        <span className="text-[9px] leading-tight font-semibold">{sess.length} batch{sess.length !== 1 ? 'es' : ''}</span>
                        {sess[0].topic && <span className="text-[9px] leading-tight truncate w-full opacity-70">{sess[0].topic}</span>}
                      </>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-slate-100">
              {[
                { dot: 'bg-emerald-500', label: '≥85% attendance' },
                { dot: 'bg-orange-400',  label: '75–84%' },
                { dot: 'bg-rose-500',    label: '<75%' },
                { dot: 'bg-slate-400',   label: 'Holiday' },
              ].map(({ dot, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  {label}
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
          {/* ── Session Summary ── */}
          {activeTab === 'summary' && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Monthly Sessions (last 12 months)</p>
              {(data?.monthly_summary || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No session data available</p>
              ) : (
                <div className="space-y-2">
                  {(data.monthly_summary || []).map(m => (
                    <div key={m.month} className="flex items-center gap-3">
                      <p className="text-sm text-slate-600 w-24 font-medium flex-shrink-0">{m.month}</p>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${(m.avg_pct || 0) >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${m.avg_pct || 0}%` }} />
                      </div>
                      <div className="text-xs text-slate-500 w-36 text-right flex-shrink-0">
                        {m.sessions} sessions · <span className="font-bold">{m.avg_pct || 0}% avg</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Topic Coverage ── */}
          {activeTab === 'topics' && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {stats.total_topics || 0} Topics Taught (recent 50)
              </p>
              {(data?.topic_coverage || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No topics recorded yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(data.topic_coverage || []).map((t, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={13} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmt(t.date)} · {t.batch_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Batch Performance ── */}
          {activeTab === 'performance' && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {batches.length} Active Batch{batches.length !== 1 ? 'es' : ''}
              </p>
              {(data?.batch_performance || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No batch performance data</p>
              ) : (
                <div className="space-y-3">
                  {(data.batch_performance || []).map(b => {
                    const pct = b.avg_pct || 0
                    return (
                      <div key={b.batch_id} className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-slate-800 text-sm">{b.batch_name}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 85 ? 'bg-emerald-100 text-emerald-700' : pct < 75 ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                            {pct}% avg
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct < 75 ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{b.total_sessions} sessions</span>
                          <span>·</span>
                          <span>{b.students} students</span>
                          {b.last_session && <><span>·</span><span>Last: {fmt(b.last_session)}</span></>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {popup && (
        <DayPopup
          date={popup}
          sessions={sessions[popup]}
          holiday={holidayByDate[popup]}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}
