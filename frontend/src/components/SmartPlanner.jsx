import React, { useState, useEffect, useMemo } from 'react'
import { X, ChevronRight, ChevronLeft, Shuffle, CheckCircle, AlertTriangle, XCircle, Loader2, Info } from 'lucide-react'
import { format, addDays, differenceInWeeks } from 'date-fns'
import toast from 'react-hot-toast'
import { getBatches, getTopicSets, getTopicSetItems, distributeTopics } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

// ── Algorithm helpers ─────────────────────────────────────────────────────────
const DAYS_MAP = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 }
const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function getSessionDates(startDate, endDate, classDays) {
  if (!startDate || !endDate || !classDays?.length) return []
  const nums = classDays.map(d => DAYS_MAP[d]).filter(n => n !== undefined)
  const dates = []
  let cur = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (cur <= end) {
    if (nums.includes(cur.getDay())) dates.push(format(cur, 'yyyy-MM-dd'))
    cur = addDays(cur, 1)
  }
  return dates
}

function calcSuggestedEndDate(startDate, classDays, neededSessions) {
  if (!startDate || !classDays?.length || neededSessions <= 0) return null
  const nums = classDays.map(d => DAYS_MAP[d]).filter(n => n !== undefined)
  let found = 0
  let cur = new Date(startDate + 'T00:00:00')
  while (found < neededSessions) {
    if (nums.includes(cur.getDay())) found++
    if (found < neededSessions) cur = addDays(cur, 1)
  }
  return format(cur, 'yyyy-MM-dd')
}

function buildDistribution(topics, sessions, max, min, revEnabled, revInterval) {
  if (!topics.length || !sessions.length) return []

  // Figure out how many revision slots we need
  const revCount = revEnabled ? Math.floor(topics.length / revInterval) : 0
  const topicSlots = sessions.length - revCount
  if (topicSlots <= 0) return []

  // Distribute topics evenly across topic slots, respecting max
  const base = Math.floor(topics.length / topicSlots)
  const extra = topics.length % topicSlots
  const groups = []
  let idx = 0
  for (let i = 0; i < topicSlots && idx < topics.length; i++) {
    const cnt = Math.min((i < extra ? base + 1 : base), max, topics.length - idx)
    groups.push(topics.slice(idx, idx + cnt))
    idx += cnt
  }

  // Interleave revision sessions
  const plan = []
  let sessionIdx = 0
  let topicsSinceRev = 0
  for (const group of groups) {
    if (revEnabled && topicsSinceRev > 0 && topicsSinceRev % revInterval === 0) {
      if (sessionIdx < sessions.length) {
        plan.push({ date: sessions[sessionIdx], is_revision: true, items: [] })
        sessionIdx++
      }
    }
    if (sessionIdx < sessions.length) {
      plan.push({ date: sessions[sessionIdx], is_revision: false, items: group })
      topicsSinceRev += group.length
      sessionIdx++
    }
  }
  return plan
}

function healthScore(avg, max) {
  if (avg <= max * 0.7) return { label: 'Balanced', emoji: '✅', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
  if (avg <= max * 0.9) return { label: 'Slightly Heavy', emoji: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
  return { label: 'Overloaded', emoji: '🔴', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' }
}

// ── Spinner number input with +/- buttons ──────────────────────────────────
function SpinnerInput({ label, value, onChange, min = 1, max = 99 }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-0">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="w-9 h-9 rounded-l-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-lg font-bold flex items-center justify-center transition">−</button>
        <input type="number" value={value} readOnly
          className="w-14 h-9 text-center text-sm font-bold text-slate-800 border-y border-slate-200 bg-white outline-none" />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-9 h-9 rounded-r-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-lg font-bold flex items-center justify-center transition">+</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SmartPlanner({ initialBatchId, onClose, onSuccess }) {
  const { user } = useAuth()
  const [step, setStep] = useState('config') // config | preview
  const [batches, setBatches] = useState([])
  const [sets, setSets] = useState([])
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [distributing, setDistributing] = useState(false)

  // Config state
  const [selectedSetId, setSelectedSetId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')          // empty = Mode B
  const [classDays, setClassDays] = useState([])
  const [hoursPerSession, setHoursPerSession] = useState(2)
  const [minPerSession, setMinPerSession] = useState(1)
  const [maxPerSession, setMaxPerSession] = useState(3)
  const [revEnabled, setRevEnabled] = useState(false)
  const [revInterval, setRevInterval] = useState(5)

  // Load data on mount
  useEffect(() => {
    Promise.all([getBatches(), getTopicSets()])
      .then(([bRes, sRes]) => {
        setBatches(bRes.data.batches || [])
        setSets(sRes.data.sets || [])
      })
      .catch(() => toast.error('Failed to load data'))
  }, [])

  // Pre-fill from selected batch
  useEffect(() => {
    const batch = batches.find(b => String(b.id) === String(selectedBatchId))
    if (batch) {
      if (batch.start_date) setStartDate(batch.start_date.split('T')[0])
      if (batch.end_date) setEndDate(batch.end_date.split('T')[0])
      const cd = Array.isArray(batch.class_days) ? batch.class_days : []
      if (cd.length) setClassDays(cd)
    }
  }, [selectedBatchId, batches])

  // Load items when set selected
  useEffect(() => {
    if (!selectedSetId) { setItems([]); return }
    setLoadingItems(true)
    getTopicSetItems(selectedSetId)
      .then(res => setItems(res.data.items || []))
      .catch(() => toast.error('Failed to load topics'))
      .finally(() => setLoadingItems(false))
  }, [selectedSetId])

  const toggleDay = (day) =>
    setClassDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  // ── Live calculations ──────────────────────────────────────────────────────
  const modeB = !endDate
  const sessions = useMemo(() => getSessionDates(startDate, endDate || '2099-12-31', classDays), [startDate, endDate, classDays])
  const revCount = revEnabled ? Math.floor(items.length / revInterval) : 0
  const topicSlotsA = sessions.length - revCount
  const minSessions = Math.ceil(items.length / maxPerSession)
  const neededTotalB = minSessions + revCount
  const suggestedEnd = modeB ? calcSuggestedEndDate(startDate, classDays, neededTotalB) : null

  const canFitA = !modeB && topicSlotsA >= minSessions
  const suggestedFix = !canFitA && !modeB
    ? calcSuggestedEndDate(startDate, classDays, minSessions + revCount) : null

  const distribution = useMemo(() => {
    if (!items.length || !classDays.length || !startDate) return []
    const effectiveEnd = modeB ? (suggestedEnd || '') : endDate
    if (!effectiveEnd) return []
    const allSessions = getSessionDates(startDate, effectiveEnd, classDays)
    return buildDistribution(items, allSessions, maxPerSession, minPerSession, revEnabled, revInterval)
  }, [items, classDays, startDate, endDate, modeB, suggestedEnd, maxPerSession, minPerSession, revEnabled, revInterval])

  const topicSessions = distribution.filter(d => !d.is_revision)
  const totalHours = items.reduce((s, t) => s + (t.duration_hours || 1), 0)
  const avgTopics = topicSessions.length ? items.length / topicSessions.length : 0
  const health = healthScore(avgTopics, maxPerSession)
  const weeksToComplete = distribution.length && startDate
    ? Math.ceil(differenceInWeeks(new Date((distribution.at(-1)?.date || startDate) + 'T00:00:00'), new Date(startDate + 'T00:00:00')) + 1)
    : 0

  // ── Validation ─────────────────────────────────────────────────────────────
  const minMaxError = minPerSession > maxPerSession
  const isConfigValid = selectedSetId && selectedBatchId && startDate && classDays.length && items.length && !minMaxError && (modeB ? !!suggestedEnd : canFitA)

  const handleApply = async () => {
    if (!distribution.length) return
    const selectedBatch = batches.find(b => String(b.id) === String(selectedBatchId))
    if (selectedBatch) {
      const hasTopic = await getTopicSets().then(() => true).catch(() => false)
      // Check if batch already has topics via simple confirm
    }
    setDistributing(true)
    try {
      const assignments = distribution.map(d => ({
        date: d.date,
        is_revision: d.is_revision,
        title: d.is_revision
          ? `📝 Revision`
          : d.items.map(t => t.title).join(' + '),
        notes: d.is_revision
          ? 'Revision session — review topics covered so far'
          : (d.items.length > 1 ? d.items.map((t, i) => `${i+1}. ${t.description || t.title}`).join('\n') : d.items[0]?.description || null),
        mode: d.is_revision ? null : d.items[0]?.mode,
        duration_hours: d.is_revision
          ? hoursPerSession
          : d.items.reduce((s, t) => s + (t.duration_hours || 1), 0),
      }))
      await distributeTopics(selectedBatchId, assignments)
      toast.success(`${assignments.length} sessions distributed to calendar!`)
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Distribution failed')
    } finally {
      setDistributing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B3A6B] flex items-center justify-center">
              <Shuffle size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Smart Planner</h2>
              <p className="text-xs text-slate-500">{step === 'config' ? 'Configure schedule' : 'Review & confirm distribution'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center transition"><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50">
          {['config','preview'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${step === s ? 'text-[#1B3A6B]' : i < ['config','preview'].indexOf(step) ? 'text-emerald-600' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-[#1B3A6B] text-white' : i < ['config','preview'].indexOf(step) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>{i+1}</span>
                {s === 'config' ? 'Configure' : 'Preview & Confirm'}
              </div>
              {i < 1 && <ChevronRight size={12} className="text-slate-300" />}
            </React.Fragment>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── STEP 1: CONFIG ── */}
          {step === 'config' && (
            <div className="p-6 space-y-6">
              {/* Select Set + Batch */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Topic Set *</label>
                  <select value={selectedSetId} onChange={e => setSelectedSetId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                    <option value="">— Select a topic set —</option>
                    {sets.map(s => <option key={s.id} value={s.id}>{s.name} ({s.item_count} topics)</option>)}
                  </select>
                  {loadingItems && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Loading topics...</p>}
                  {selectedSetId && !loadingItems && <p className="text-xs text-slate-500 mt-1">{items.length} topics · {totalHours.toFixed(1)} total hrs</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Batch *</label>
                  <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                    <option value="">— Select a batch —</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date *</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    End Date <span className="text-slate-400 font-normal">(leave blank for flexible)</span>
                  </label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  {modeB && <span className="text-xs text-brand-blue font-medium mt-1 inline-block">Mode B — flexible timeline</span>}
                  {!modeB && <span className="text-xs text-slate-500 font-medium mt-1 inline-block">Mode A — fixed timeline</span>}
                </div>
              </div>

              {/* Class days */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Class Days *</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${classDays.includes(day) ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]' : 'bg-white text-slate-500 border-slate-200 hover:border-[#1B3A6B] hover:text-[#1B3A6B]'}`}>
                      {day.slice(0,3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numeric controls */}
              <div className="grid grid-cols-3 gap-4">
                <SpinnerInput label="Hours / session" value={hoursPerSession} onChange={setHoursPerSession} min={1} max={8} />
                <SpinnerInput label="Min topics / day" value={minPerSession} onChange={setMinPerSession} min={1} max={maxPerSession} />
                <SpinnerInput label="Max topics / day" value={maxPerSession} onChange={v => { setMaxPerSession(v); if (minPerSession > v) setMinPerSession(v) }} min={1} max={10} />
              </div>
              {minMaxError && <p className="text-xs text-rose-600 font-medium -mt-4">⚠ Max must be ≥ Min</p>}

              {/* Revision toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Revision Buffer</p>
                  <p className="text-xs text-slate-400">Adds a review session after every N topics</p>
                </div>
                <div className="flex items-center gap-3">
                  {revEnabled && (
                    <select value={revInterval} onChange={e => setRevInterval(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {[3,5,8,10].map(n => <option key={n} value={n}>Every {n} topics</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setRevEnabled(v => !v)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${revEnabled ? 'bg-[#1B3A6B]' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${revEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Live warnings */}
              {items.length > 0 && startDate && classDays.length > 0 && (
                <div className="space-y-2">
                  {/* Mode B suggestion */}
                  {modeB && suggestedEnd && (
                    <div className="flex items-start gap-2 p-3 bg-brand-blue-light border border-brand-blue/20 rounded-xl text-sm">
                      <Info size={15} className="text-brand-blue mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-brand-blue">Flexible Timeline — Mode B</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {items.length} topics · max {maxPerSession}/day · {revCount} revision session{revCount !== 1 ? 's' : ''} →
                          needs <strong>{neededTotalB} sessions</strong>.
                          Suggested end date: <strong>{format(new Date(suggestedEnd+'T00:00:00'), 'MMM d, yyyy')}</strong>
                          {' '}({weeksToComplete} week{weeksToComplete !== 1 ? 's' : ''})
                        </p>
                        <button onClick={() => setEndDate(suggestedEnd)}
                          className="mt-1.5 text-xs text-brand-blue font-semibold underline">
                          Use this end date →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode A — can't fit */}
                  {!modeB && !canFitA && suggestedFix && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm">
                      <XCircle size={15} className="text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-rose-700">Cannot fit all {items.length} topics by {format(new Date(endDate+'T00:00:00'), 'MMM d, yyyy')}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          With max {maxPerSession}/day you need at least {minSessions + revCount} sessions.
                          Suggested end: <strong>{format(new Date(suggestedFix+'T00:00:00'), 'MMM d, yyyy')}</strong>
                        </p>
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => setEndDate(suggestedFix)} className="text-xs bg-rose-500 text-white px-3 py-1 rounded-lg font-semibold">Adjust end date →</button>
                          <button onClick={() => setMaxPerSession(Math.ceil(items.length / sessions.length))} className="text-xs bg-white text-rose-600 border border-rose-200 px-3 py-1 rounded-lg font-semibold">Increase max to {Math.ceil(items.length / sessions.length)}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode A — tight */}
                  {!modeB && canFitA && avgTopics > maxPerSession * 0.9 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
                      <p className="text-amber-700 text-xs">Schedule is tight — at near-maximum capacity ({avgTopics.toFixed(1)} avg topics/day)</p>
                    </div>
                  )}

                  {/* Balanced */}
                  {!modeB && canFitA && avgTopics <= maxPerSession * 0.7 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                      <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
                      <p className="text-emerald-700 text-xs">Schedule looks balanced ✅ ({avgTopics.toFixed(1)} avg topics/day)</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: PREVIEW ── */}
          {step === 'preview' && (
            <div className="p-6 space-y-5">
              {/* Health card */}
              <div className={`border rounded-2xl p-5 ${health.bg}`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-slate-800">Schedule Health</p>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full border ${health.bg} ${health.color}`}>
                    {health.emoji} {health.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Topics', value: items.length },
                    { label: 'Est. Hours', value: `${totalHours.toFixed(1)} hrs` },
                    { label: 'Total Sessions', value: distribution.length },
                    { label: 'Avg Topics/Day', value: avgTopics.toFixed(1) },
                    { label: 'Min / Max', value: `${minPerSession} / ${maxPerSession}` },
                    { label: 'Revision Sessions', value: revCount },
                    { label: 'Weeks', value: weeksToComplete },
                    { label: 'Topic Sessions', value: topicSessions.length },
                  ].map(s => (
                    <div key={s.label} className="bg-white/70 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
                      <p className="text-base font-bold text-slate-800">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overwrite warning */}
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                <AlertTriangle size={14} className="flex-shrink-0 text-amber-500" />
                This will replace all existing calendar topics for the selected batch.
              </div>

              {/* Preview table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_70px_80px_70px] bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span>#</span><span>Topics</span><span>Mode</span><span>Hours</span><span>Type</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {distribution.map((d, i) => (
                    <div key={i} className={`grid grid-cols-[40px_1fr_70px_80px_70px] items-start px-4 py-3 text-sm ${d.is_revision ? 'bg-purple-50/50' : ''}`}>
                      <span className="text-xs text-slate-400 pt-0.5">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 mb-0.5">{format(new Date(d.date+'T00:00:00'), 'EEE, MMM d')}</p>
                        {d.is_revision ? (
                          <span className="text-sm font-semibold text-purple-700">📝 Revision Session</span>
                        ) : (
                          <div className="space-y-0.5">
                            {d.items.map((t, j) => (
                              <p key={j} className="text-xs text-slate-700 truncate">
                                {t.mode === 'online' ? '💻' : '🏫'} {t.title}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 pt-4">{d.is_revision ? '—' : (d.items[0]?.mode === 'online' ? 'Online' : 'Offline')}</span>
                      <span className="text-xs text-slate-500 pt-4">
                        {d.is_revision ? `${hoursPerSession}h` : `${d.items.reduce((s, t) => s + (t.duration_hours || 1), 0).toFixed(1)}h`}
                      </span>
                      <span className={`text-xs font-semibold pt-4 ${d.is_revision ? 'text-purple-600' : 'text-slate-600'}`}>
                        {d.is_revision ? 'Revision' : 'Class'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <button onClick={() => step === 'config' ? onClose() : setStep('config')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition">
            {step === 'preview' && <ChevronLeft size={15} />}
            {step === 'config' ? 'Cancel' : 'Back'}
          </button>
          {step === 'config' ? (
            <button onClick={() => setStep('preview')} disabled={!isConfigValid}
              className="flex items-center gap-2 bg-[#1B3A6B] hover:bg-[#163058] disabled:opacity-40 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition">
              Preview Distribution <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={handleApply} disabled={distributing}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition shadow-sm shadow-primary/30">
              {distributing ? <><Loader2 size={15} className="animate-spin" /> Applying...</> : <><Shuffle size={15} /> Apply to Calendar</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
