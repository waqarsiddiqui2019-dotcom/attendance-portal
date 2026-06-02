import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight,
  UserPlus,
  Trash2,
  Calendar,
  Users,
  BarChart3,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  AlertCircle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  getBatch,
  getStudents,
  addStudent,
  removeStudent,
  getAttendanceByDate,
  markAttendance,
  getAttendanceSummary,
} from '../api/index.js'

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'students', label: 'Students', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

// ── Add Student Modal ─────────────────────────────────────────────────────────
function AddStudentModal({ open, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  useEffect(() => {
    if (open) setForm({ name: '', email: '', password: '' })
  }, [open])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('All fields are required')
      return
    }
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Add Student</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { name: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe' },
            { name: 'email', label: 'Email Address', type: 'email', placeholder: 'john@example.com' },
            { name: 'password', label: 'Password', type: 'password', placeholder: 'Min. 6 characters' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {f.label} <span className="text-rose-500">*</span>
              </label>
              <input
                type={f.type}
                value={form[f.name]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                }
                placeholder={f.placeholder}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
          ))}
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
                  <Loader2 size={15} className="animate-spin" /> Adding...
                </>
              ) : (
                'Add Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    absent: 'bg-rose-50 text-rose-700 border-rose-200',
    late: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
        map[status] || 'bg-slate-50 text-slate-500 border-slate-200'
      }`}
    >
      {status?.charAt(0)?.toUpperCase() + status?.slice(1) || '—'}
    </span>
  )
}

// ── Attendance Status Buttons ─────────────────────────────────────────────────
function AttendanceToggle({ status, onChange }) {
  const options = [
    { value: 'present', icon: CheckCircle, color: 'text-emerald-600', active: 'bg-emerald-500 text-white border-emerald-500' },
    { value: 'absent', icon: XCircle, color: 'text-rose-500', active: 'bg-rose-500 text-white border-rose-500' },
    { value: 'late', icon: Clock, color: 'text-amber-500', active: 'bg-amber-500 text-white border-amber-500' },
  ]
  return (
    <div className="flex gap-1">
      {options.map(({ value, icon: Icon, color, active }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
            status === value
              ? active
              : `bg-white border-slate-200 ${color} hover:bg-slate-50`
          }`}
        >
          <Icon size={13} />
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </button>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BatchDetail() {
  const { id } = useParams()
  const [batch, setBatch] = useState(null)
  const [students, setStudents] = useState([])
  const [activeTab, setActiveTab] = useState('students')
  const [loading, setLoading] = useState(true)

  // Students tab state
  const [addModal, setAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  // Attendance tab state
  const [attendanceDate, setAttendanceDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [attendanceData, setAttendanceData] = useState({})
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)

  // Reports tab state
  const [summary, setSummary] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  const fetchBatch = useCallback(async () => {
    try {
      const [bRes, sRes] = await Promise.all([
        getBatch(id),
        getStudents(id),
      ])
      setBatch(bRes.data.batch || bRes.data)
      setStudents(sRes.data.students || sRes.data || [])
    } catch (err) {
      toast.error('Failed to load batch details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchBatch()
  }, [fetchBatch])

  useEffect(() => {
    if (activeTab === 'reports') {
      setSummaryLoading(true)
      getAttendanceSummary(id)
        .then((res) => setSummary(res.data.summary || res.data || []))
        .catch(console.error)
        .finally(() => setSummaryLoading(false))
    }
  }, [activeTab, id])

  // ── Students ────────────────────────────────────────────────────────────────
  const handleAddStudent = async (form) => {
    setAddLoading(true)
    try {
      await addStudent(id, form)
      toast.success('Student added successfully!')
      setAddModal(false)
      fetchBatch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student')
    } finally {
      setAddLoading(false)
    }
  }

  const handleRemoveStudent = async (student) => {
    if (!window.confirm(`Remove ${student.name} from this batch?`)) return
    try {
      await removeStudent(id, student.id)
      toast.success('Student removed')
      fetchBatch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove student')
    }
  }

  // ── Attendance ──────────────────────────────────────────────────────────────
  const handleLoadAttendance = async () => {
    setLoadingAttendance(true)
    try {
      const res = await getAttendanceByDate(id, attendanceDate)
      const records = res.data.records || res.data || []
      const map = {}
      // Pre-fill all students as present
      students.forEach((s) => (map[s.id] = 'present'))
      // Override with actual records
      records.forEach((r) => {
        const sid = r.student_id
        if (sid) map[sid] = r.status
      })
      setAttendanceData(map)
      setAttendanceLoaded(true)
    } catch (err) {
      toast.error('Failed to load attendance')
    } finally {
      setLoadingAttendance(false)
    }
  }

  const handleSaveAttendance = async () => {
    setSavingAttendance(true)
    try {
      const records = Object.entries(attendanceData).map(([student_id, status]) => ({
        student_id,
        status,
      }))
      await markAttendance(id, { date: attendanceDate, records })
      toast.success('Attendance saved successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  // ── Reports / Exports ───────────────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.setTextColor('#4F46E5')
    doc.text('Attendance Report', 14, 18)
    doc.setFontSize(11)
    doc.setTextColor('#64748B')
    doc.text(`Batch: ${batch?.name || ''}`, 14, 27)
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, 14, 34)

    const rows = summary.map((s) => [
      s.studentName || s.name || '—',
      s.present ?? 0,
      s.absent ?? 0,
      s.late ?? 0,
      (s.present ?? 0) + (s.absent ?? 0) + (s.late ?? 0),
      `${s.percentage ?? 0}%`,
    ])

    autoTable(doc, {
      startY: 40,
      head: [['Student', 'Present', 'Absent', 'Late', 'Total Days', '%']],
      body: rows,
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      styles: { fontSize: 10, cellPadding: 4 },
    })

    doc.save(`attendance-${batch?.name || 'report'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported!')
  }

  const exportExcel = () => {
    const rows = summary.map((s) => ({
      Student: s.studentName || s.name || '—',
      Present: s.present ?? 0,
      Absent: s.absent ?? 0,
      Late: s.late ?? 0,
      'Total Days': (s.present ?? 0) + (s.absent ?? 0) + (s.late ?? 0),
      'Attendance %': `${s.percentage ?? 0}%`,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance-${batch?.name || 'report'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success('Excel exported!')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="text-center py-32">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Batch not found</p>
      </div>
    )
  }

  const formatDate = (d) => {
    try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—' } catch { return '—' }
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/trainer/batches" className="text-slate-500 hover:text-primary transition">
          Batches
        </Link>
        <ChevronRight size={14} className="text-slate-400" />
        <span className="text-slate-800 font-medium truncate">{batch.name}</span>
      </div>

      {/* Batch info card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">{batch.name}</h1>
            {batch.description && (
              <p className="text-slate-500 text-sm mb-3">{batch.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                {formatDate(batch.start_date)} — {formatDate(batch.end_date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-primary" />
                {students.length} students
              </span>
            </div>
          </div>
          <Link
            to={`/trainer/calendar/${id}`}
            className="flex items-center gap-2 bg-primary-light hover:bg-primary text-primary hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            <Calendar size={15} /> View Calendar
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setActiveTab(tid)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tid
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Students Tab ── */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">
              Enrolled Students
              <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {students.length}
              </span>
            </h2>
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-xs font-medium px-3.5 py-2 rounded-xl transition"
            >
              <UserPlus size={14} /> Add Student
            </button>
          </div>

          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm mb-4">No students enrolled yet</p>
              <button
                onClick={() => setAddModal(true)}
                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-dark transition"
              >
                <UserPlus size={15} /> Add your first student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Student
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Email
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                      Enrolled
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-semibold text-xs">
                              {s.name?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-700 text-sm">
                            {s.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">{s.email}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">
                        {s.enrolled_at ? formatDate(s.enrolled_at) : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleRemoveStudent(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
                        >
                          <Trash2 size={15} />
                        </button>
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
          {/* Date selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Mark Attendance</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Select Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => {
                    setAttendanceDate(e.target.value)
                    setAttendanceLoaded(false)
                  }}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>
              <button
                onClick={handleLoadAttendance}
                disabled={loadingAttendance || students.length === 0}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-50 transition"
              >
                {loadingAttendance ? (
                  <><Loader2 size={15} className="animate-spin" /> Loading...</>
                ) : (
                  'Load Attendance'
                )}
              </button>
            </div>
          </div>

          {/* Attendance table */}
          {attendanceLoaded && (
            <div className="bg-white rounded-2xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">
                  Attendance for {format(parseISO(attendanceDate), 'MMMM d, yyyy')}
                </h3>
              </div>

              {students.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No students enrolled
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                            Student
                          </th>
                          <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
                                  <span className="text-primary font-semibold text-xs">
                                    {s.name?.charAt(0)?.toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-slate-700 text-sm">
                                  {s.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <AttendanceToggle
                                status={attendanceData[s.id] || 'present'}
                                onChange={(val) =>
                                  setAttendanceData((prev) => ({
                                    ...prev,
                                    [s.id]: val,
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={handleSaveAttendance}
                      disabled={savingAttendance}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-60 transition shadow-sm shadow-primary/30"
                    >
                      {savingAttendance ? (
                        <><Loader2 size={15} className="animate-spin" /> Saving...</>
                      ) : (
                        <><CheckCircle size={15} /> Save Attendance</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Reports Tab ── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Attendance Summary</h2>
            <div className="flex gap-2">
              <button
                onClick={exportPDF}
                disabled={summary.length === 0}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium px-3.5 py-2 rounded-xl disabled:opacity-50 transition"
              >
                <FileText size={13} /> Export PDF
              </button>
              <button
                onClick={exportExcel}
                disabled={summary.length === 0}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3.5 py-2 rounded-xl disabled:opacity-50 transition"
              >
                <Download size={13} /> Export Excel
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : summary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No attendance data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      {['Student', 'Present', 'Absent', 'Late', 'Total', 'Attendance %'].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.map((s, i) => {
                      const pct = s.percentage ?? 0
                      const barColor =
                        pct >= 75
                          ? 'bg-emerald-500'
                          : pct >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      const total = (s.present ?? 0) + (s.absent ?? 0) + (s.late ?? 0)
                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                                <span className="text-primary font-semibold text-xs">
                                  {(s.studentName || s.name || '?')
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-slate-700 text-sm">
                                {s.studentName || s.name || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-emerald-600">
                              {s.present ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-rose-500">
                              {s.absent ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-amber-500">
                              {s.late ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{total}</td>
                          <td className="px-6 py-4 min-w-[160px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span
                                className={`text-xs font-bold min-w-[36px] text-right ${
                                  pct >= 75
                                    ? 'text-emerald-600'
                                    : pct >= 50
                                    ? 'text-amber-600'
                                    : 'text-rose-600'
                                }`}
                              >
                                {pct}%
                              </span>
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

      {/* Add Student Modal */}
      <AddStudentModal
        open={addModal}
        onClose={() => setAddModal(false)}
        onSubmit={handleAddStudent}
        loading={addLoading}
      />
    </>
  )
}
