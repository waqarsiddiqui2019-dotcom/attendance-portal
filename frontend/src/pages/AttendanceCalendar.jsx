import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import {
  ArrowLeft, X, CheckCircle, XCircle, Clock, Loader2,
  BookOpen, Plus, Edit2, Trash2, Save, ChevronDown, ChevronUp
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { getBatch, getCalendarData, getTopics, saveTopic, deleteTopic } from '../api/index.js'

// ── Topic form (inline, reused in modal and list) ──────────────────────────
function TopicForm({ initialTitle = '', initialNotes = '', onSave, onCancel, saving }) {
  const [title, setTitle] = useState(initialTitle)
  const [notes, setNotes] = useState(initialNotes)

  const handleSave = () => {
    if (!title.trim()) { toast.error('Topic title is required'); return }
    onSave(title.trim(), notes.trim())
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Topic Title *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Introduction to SEO"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Brief description of what was covered..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save Topic
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Calendar Page ─────────────────────────────────────────────────────
export default function AttendanceCalendar() {
  const { batchId } = useParams()
  const [batch, setBatch] = useState(null)
  const [events, setEvents] = useState([])            // attendance events
  const [topicEvents, setTopicEvents] = useState([])  // topic chip events
  const [topicsMap, setTopicsMap] = useState({})      // { 'YYYY-MM-DD': topicObj }
  const [allTopics, setAllTopics] = useState([])      // all topics for list section
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [dayModal, setDayModal] = useState(null)      // { date, present, absent, late, total, topic }
  const [modalEditing, setModalEditing] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalDeleting, setModalDeleting] = useState(false)
  // Topics list section
  const [showTopicList, setShowTopicList] = useState(true)
  const [addingTopic, setAddingTopic] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [listSaving, setListSaving] = useState(false)
  const [editingTopicId, setEditingTopicId] = useState(null)
  const [listEditSaving, setListEditSaving] = useState(false)
  const calendarRef = useRef(null)

  const buildTopicState = useCallback((topics) => {
    const map = {}
    topics.forEach(t => { map[t.date] = t })
    setTopicsMap(map)
    setTopicEvents(topics.map(t => ({
      id: `topic-${t.date}`,
      title: `${t.mode === 'online' ? '💻' : '🏫'} ${t.title}`,
      start: t.date,
      backgroundColor: '#1B3A6B',
      borderColor: '#163058',
      textColor: '#ffffff',
      extendedProps: { type: 'topic', date: t.date, topicData: t },
    })))
  }, [])

  const fetchCalendar = useCallback(async (month) => {
    setLoading(true)
    try {
      const res = await getCalendarData(batchId, month)
      const calData = res.data.calendar || res.data || []
      const mapped = calData.map((item) => {
        const total = item.total || 0
        const present = item.present_count || 0
        const absent = item.absent_count || 0
        const late = item.late_count || 0
        const isAllPresent = absent === 0 && late === 0 && total > 0
        return {
          id: `att-${item.date}`,
          title: `P:${present} A:${absent} L:${late}`,
          start: item.date,
          backgroundColor: isAllPresent ? '#10B981' : absent > 0 ? '#F43F5E' : '#F59E0B',
          borderColor: isAllPresent ? '#059669' : absent > 0 ? '#E11D48' : '#D97706',
          textColor: '#ffffff',
          extendedProps: { type: 'attendance', present, absent, late, total, date: item.date },
        }
      })
      setEvents(mapped)
    } catch {
      toast.error('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }, [batchId])

  const fetchTopicsForMonth = useCallback(async (month) => {
    try {
      const res = await getTopics(batchId, month)
      buildTopicState(res.data.topics || [])
    } catch { /* silently ignore */ }
  }, [batchId, buildTopicState])

  const fetchAllTopics = useCallback(async () => {
    try {
      const res = await getTopics(batchId)
      setAllTopics((res.data.topics || []).slice().sort((a, b) => b.date.localeCompare(a.date)))
    } catch { /* silently ignore */ }
  }, [batchId])

  useEffect(() => {
    getBatch(batchId).then(res => setBatch(res.data.batch || res.data)).catch(console.error)
    fetchCalendar(currentMonth)
    fetchTopicsForMonth(currentMonth)
    fetchAllTopics()
  }, [batchId, currentMonth, fetchCalendar, fetchTopicsForMonth, fetchAllTopics])

  const handleDatesSet = (info) => {
    const month = format(info.view.currentStart, 'yyyy-MM')
    if (month !== currentMonth) setCurrentMonth(month)
  }

  const openModal = (date) => {
    const attEvent = events.find(e => e.extendedProps?.date === date)
    const topic = topicsMap[date] || null
    setModalEditing(false)
    setDayModal({
      date,
      present: attEvent?.extendedProps?.present ?? null,
      absent: attEvent?.extendedProps?.absent ?? null,
      late: attEvent?.extendedProps?.late ?? null,
      total: attEvent?.extendedProps?.total ?? null,
      topic,
    })
  }

  const handleEventClick = (info) => {
    const date = info.event.extendedProps?.date || info.event.startStr
    openModal(date)
  }

  // ── Modal topic actions ────────────────────────────────────────────────────
  const handleModalSave = async (title, notes) => {
    setModalSaving(true)
    try {
      await saveTopic(batchId, { date: dayModal.date, title, notes })
      toast.success('Topic saved!')
      await Promise.all([fetchTopicsForMonth(currentMonth), fetchAllTopics()])
      const newTopic = { date: dayModal.date, title, notes: notes || null }
      setDayModal(prev => ({ ...prev, topic: newTopic }))
      setModalEditing(false)
    } catch {
      toast.error('Failed to save topic')
    } finally {
      setModalSaving(false)
    }
  }

  const handleModalDelete = async () => {
    if (!window.confirm('Remove the topic for this day?')) return
    setModalDeleting(true)
    try {
      await deleteTopic(batchId, dayModal.date)
      toast.success('Topic removed')
      await Promise.all([fetchTopicsForMonth(currentMonth), fetchAllTopics()])
      setDayModal(prev => ({ ...prev, topic: null }))
      setModalEditing(false)
    } catch {
      toast.error('Failed to delete topic')
    } finally {
      setModalDeleting(false)
    }
  }

  // ── Topics list actions ────────────────────────────────────────────────────
  const handleListAdd = async (title, notes) => {
    if (!addDate) { toast.error('Please select a date'); return }
    setListSaving(true)
    try {
      await saveTopic(batchId, { date: addDate, title, notes })
      toast.success('Topic added!')
      setAddingTopic(false)
      setAddDate('')
      await Promise.all([fetchTopicsForMonth(currentMonth), fetchAllTopics()])
    } catch {
      toast.error('Failed to save topic')
    } finally {
      setListSaving(false)
    }
  }

  const handleListEdit = async (topicDate, title, notes) => {
    setListEditSaving(true)
    try {
      await saveTopic(batchId, { date: topicDate, title, notes })
      toast.success('Topic updated!')
      setEditingTopicId(null)
      await Promise.all([fetchTopicsForMonth(currentMonth), fetchAllTopics()])
    } catch {
      toast.error('Failed to update topic')
    } finally {
      setListEditSaving(false)
    }
  }

  const handleListDelete = async (topicDate) => {
    if (!window.confirm('Remove this topic?')) return
    try {
      await deleteTopic(batchId, topicDate)
      toast.success('Topic removed')
      await Promise.all([fetchTopicsForMonth(currentMonth), fetchAllTopics()])
    } catch {
      toast.error('Failed to delete topic')
    }
  }

  const formatDate = (d) => {
    try { return d ? format(parseISO(d), 'EEE, MMM d, yyyy') : '—' } catch { return d }
  }

  const allCalendarEvents = [...events, ...topicEvents]

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={`/trainer/batches/${batchId}`}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-primary hover:text-primary transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Attendance Calendar</h1>
            {batch && <p className="text-sm text-slate-500 mt-0.5">{batch.name}</p>}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {[
          { color: '#10B981', label: '100% Present' },
          { color: '#F43F5E', label: 'Has Absences' },
          { color: '#F59E0B', label: 'Has Late Arrivals' },
          { color: '#1B3A6B', label: 'Topic Recorded' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-sm text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 relative mb-8">
        {loading && (
          <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={allCalendarEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={3}
        />
      </div>

      {/* Topics List Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button
            onClick={() => setShowTopicList(v => !v)}
            className="flex items-center gap-2 font-semibold text-slate-800 hover:text-primary transition"
          >
            <BookOpen size={18} className="text-[#1B3A6B]" />
            Class Topics
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {allTopics.length}
            </span>
            {showTopicList ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </button>
          {!addingTopic && (
            <button
              onClick={() => { setAddingTopic(true); setAddDate('') }}
              className="flex items-center gap-1.5 bg-[#1B3A6B] hover:bg-[#163058] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              <Plus size={13} /> Add Topic
            </button>
          )}
        </div>

        {showTopicList && (
          <div>
            {/* Add topic form */}
            {addingTopic && (
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700 mb-3">Add New Topic</p>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Class Date *</label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={e => setAddDate(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <TopicForm
                  onSave={handleListAdd}
                  onCancel={() => { setAddingTopic(false); setAddDate('') }}
                  saving={listSaving}
                />
              </div>
            )}

            {allTopics.length === 0 && !addingTopic ? (
              <div className="flex flex-col items-center justify-center py-14">
                <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm font-medium">No topics recorded yet</p>
                <p className="text-slate-400 text-xs mt-1">Click "Add Topic" to record what was covered in class</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {allTopics.map(topic => (
                  <div key={topic.id} className="px-6 py-4">
                    {editingTopicId === topic.id ? (
                      <div>
                        <p className="text-xs text-slate-400 mb-3">{formatDate(topic.date)}</p>
                        <TopicForm
                          initialTitle={topic.title}
                          initialNotes={topic.notes || ''}
                          onSave={(t, n) => handleListEdit(topic.date, t, n)}
                          onCancel={() => setEditingTopicId(null)}
                          saving={listEditSaving}
                        />
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#1B3A6B] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <BookOpen size={14} className="text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-400 mb-0.5">{formatDate(topic.date)}</p>
                            <p className="font-semibold text-slate-800 text-sm">{topic.title}</p>
                            {topic.notes && (
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{topic.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingTopicId(topic.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleListDelete(topic.date)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day detail modal */}
      {dayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-800">
                  {dayModal.date ? format(new Date(dayModal.date + 'T00:00:00'), 'MMMM d, yyyy') : '—'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">Class Details</p>
              </div>
              <button
                onClick={() => { setDayModal(null); setModalEditing(false) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Attendance section */}
            {dayModal.total !== null ? (
              <>
                <div className="px-6 pt-5 pb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Attendance</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-2xl font-bold text-emerald-700">{dayModal.present}</p>
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">Present</p>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-4 text-center border border-rose-100">
                      <XCircle className="w-5 h-5 text-rose-500 mx-auto mb-1.5" />
                      <p className="text-2xl font-bold text-rose-700">{dayModal.absent}</p>
                      <p className="text-xs text-rose-600 font-medium mt-0.5">Absent</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                      <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                      <p className="text-2xl font-bold text-amber-700">{dayModal.late}</p>
                      <p className="text-xs text-amber-600 font-medium mt-0.5">Late</p>
                    </div>
                  </div>
                  <div className="mt-3 bg-slate-50 rounded-xl p-3 flex justify-between text-sm">
                    <span className="text-slate-500">Total Students</span>
                    <span className="font-semibold text-slate-800">{dayModal.total}</span>
                  </div>
                </div>
                <div className="mx-6 border-t border-slate-100 my-4" />
              </>
            ) : (
              <div className="px-6 pt-5">
                <div className="bg-slate-50 rounded-xl p-3 mb-4 text-center">
                  <p className="text-xs text-slate-400">No attendance marked for this day</p>
                </div>
              </div>
            )}

            {/* Topic section */}
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class Topic</p>
                {dayModal.topic && !modalEditing && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setModalEditing(true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition"
                      title="Edit topic"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={handleModalDelete}
                      disabled={modalDeleting}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition disabled:opacity-50"
                      title="Delete topic"
                    >
                      {modalDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                )}
              </div>

              {modalEditing ? (
                <TopicForm
                  initialTitle={dayModal.topic?.title || ''}
                  initialNotes={dayModal.topic?.notes || ''}
                  onSave={handleModalSave}
                  onCancel={() => setModalEditing(false)}
                  saving={modalSaving}
                />
              ) : dayModal.topic ? (
                <div className="bg-[#1B3A6B]/5 border border-[#1B3A6B]/15 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen size={14} className="text-[#1B3A6B] flex-shrink-0" />
                      <p className="font-semibold text-[#1B3A6B] text-sm">{dayModal.topic.title}</p>
                    </div>
                    {dayModal.topic.mode && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${dayModal.topic.mode === 'online' ? 'bg-brand-blue-light text-brand-blue' : 'bg-slate-100 text-slate-600'}`}>
                        {dayModal.topic.mode === 'online' ? '💻 Online' : '🏫 Offline'}
                      </span>
                    )}
                  </div>
                  {dayModal.topic.notes && (
                    <p className="text-xs text-slate-600 leading-relaxed pl-5">{dayModal.topic.notes}</p>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center">
                  <BookOpen size={18} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 mb-3">No topic recorded for this day</p>
                  <button
                    onClick={() => setModalEditing(true)}
                    className="flex items-center gap-1.5 bg-[#1B3A6B] hover:bg-[#163058] text-white text-xs font-semibold px-4 py-2 rounded-lg transition mx-auto"
                  >
                    <Plus size={12} /> Add Topic
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
