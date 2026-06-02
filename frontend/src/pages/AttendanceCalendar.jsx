import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { ArrowLeft, X, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { getBatch, getCalendarData } from '../api/index.js'

export default function AttendanceCalendar() {
  const { batchId } = useParams()
  const [batch, setBatch] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(
    format(new Date(), 'yyyy-MM')
  )
  const [dayModal, setDayModal] = useState(null) // { date, data }
  const calendarRef = useRef(null)

  const fetchCalendar = useCallback(
    async (month) => {
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
            id: item.date,
            title: `P:${present} A:${absent} L:${late}`,
            start: item.date,
            backgroundColor: isAllPresent
              ? '#10B981'
              : absent > 0
              ? '#F43F5E'
              : '#F59E0B',
            borderColor: isAllPresent
              ? '#059669'
              : absent > 0
              ? '#E11D48'
              : '#D97706',
            textColor: '#ffffff',
            extendedProps: { present, absent, late, total, date: item.date },
          }
        })
        setEvents(mapped)
      } catch (err) {
        toast.error('Failed to load calendar data')
      } finally {
        setLoading(false)
      }
    },
    [batchId]
  )

  useEffect(() => {
    getBatch(batchId)
      .then((res) => setBatch(res.data.batch || res.data))
      .catch(console.error)
    fetchCalendar(currentMonth)
  }, [batchId, currentMonth, fetchCalendar])

  const handleDatesSet = (info) => {
    const month = format(info.view.currentStart, 'yyyy-MM')
    if (month !== currentMonth) {
      setCurrentMonth(month)
    }
  }

  const handleEventClick = (info) => {
    const props = info.event.extendedProps
    setDayModal({
      date: props.date,
      present: props.present,
      absent: props.absent,
      late: props.late,
      total: props.total,
    })
  }

  const handleDateClick = (info) => {
    const event = events.find((e) => e.start === info.dateStr)
    if (event) {
      setDayModal({
        date: info.dateStr,
        ...event.extendedProps,
      })
    }
  }

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
            <h1 className="text-xl font-bold text-slate-800">
              Attendance Calendar
            </h1>
            {batch && (
              <p className="text-sm text-slate-500 mt-0.5">{batch.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {[
          { color: '#10B981', label: '100% Present' },
          { color: '#F43F5E', label: 'Has Absences' },
          { color: '#F59E0B', label: 'Has Late Arrivals' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={2}
        />
      </div>

      {/* Day detail modal */}
      {dayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">
                  {dayModal.date
                    ? format(new Date(dayModal.date + 'T00:00:00'), 'MMMM d, yyyy')
                    : '—'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">Attendance Breakdown</p>
              </div>
              <button
                onClick={() => setDayModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-700">
                  {dayModal.present}
                </p>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">Present</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-4 text-center border border-rose-100">
                <XCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-rose-700">
                  {dayModal.absent}
                </p>
                <p className="text-xs text-rose-600 font-medium mt-0.5">Absent</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-700">
                  {dayModal.late}
                </p>
                <p className="text-xs text-amber-600 font-medium mt-0.5">Late</p>
              </div>
            </div>

            <div className="px-6 pb-5">
              <div className="bg-slate-50 rounded-xl p-3 flex justify-between text-sm">
                <span className="text-slate-500">Total Students</span>
                <span className="font-semibold text-slate-800">
                  {dayModal.total}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
