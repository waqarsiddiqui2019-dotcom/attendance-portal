import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Users,
  CheckCircle,
  Activity,
  ArrowRight,
  Plus,
  CalendarDays,
} from 'lucide-react'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { getBatches } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ icon: Icon, label, value, color, bgColor, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 ${bgColor} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 mb-0.5">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

export default function TrainerDashboard() {
  const { user } = useAuth()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBatches()
      .then((res) => setBatches(res.data.batches || res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const activeBatches = batches.filter((b) => {
    try {
      return isWithinInterval(today, {
        start: parseISO(b.start_date),
        end: parseISO(b.end_date),
      })
    } catch {
      return false
    }
  })

  const totalStudents = batches.reduce(
    (sum, b) => sum + (b.student_count || b.students?.length || 0),
    0
  )

  const recentBatches = [...batches]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3)

  const stats = [
    {
      icon: BookOpen,
      label: 'Total Batches',
      value: batches.length,
      color: 'text-primary',
      bgColor: 'bg-primary-light',
    },
    {
      icon: Users,
      label: 'Total Students',
      value: totalStudents,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue-light',
    },
    {
      icon: CheckCircle,
      label: "Today's Attendance",
      value: '—',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      icon: Activity,
      label: 'Active Batches',
      value: activeBatches.length,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      trend: true,
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          {getGreeting()}, {user?.name?.split(' ')[0] || 'Trainer'}!
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {format(today, "EEEE, MMMM d, yyyy")} &mdash; Here's your overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent batches */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Recent Batches</h2>
            <Link
              to="/trainer/batches"
              className="text-sm text-primary font-medium hover:text-primary-dark flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentBatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No batches yet</p>
              <Link
                to="/trainer/batches"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-dark"
              >
                <Plus size={14} /> Create your first batch
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm truncate">
                        {batch.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <CalendarDays size={12} />
                          {batch.start_date
                            ? format(parseISO(batch.start_date), 'MMM d')
                            : '—'}{' '}
                          &mdash;{' '}
                          {batch.end_date
                            ? format(parseISO(batch.end_date), 'MMM d, yyyy')
                            : '—'}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Users size={12} />
                          {batch.student_count || batch.students?.length || 0} students
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/trainer/batches/${batch.id}`}
                      className="ml-4 text-xs font-medium text-primary bg-primary-light hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg transition flex items-center gap-1 flex-shrink-0"
                    >
                      View <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/trainer/batches"
              className="flex items-center gap-3 w-full bg-primary hover:bg-primary-dark text-white font-medium px-4 py-3.5 rounded-xl transition shadow-sm shadow-primary/30 text-sm"
            >
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Plus size={16} />
              </div>
              Create New Batch
            </Link>

            <Link
              to="/trainer/batches"
              className="flex items-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-3.5 rounded-xl border border-slate-200 transition text-sm"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <BookOpen size={16} className="text-slate-500" />
              </div>
              View All Batches
            </Link>
          </div>

          {/* Summary card */}
          <div className="mt-4 bg-gradient-to-br from-[#1B3A6B] to-[#2272B9] rounded-2xl p-5 text-white">
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-3">
              Today
            </p>
            <p className="text-2xl font-bold mb-1">{format(today, 'd MMM')}</p>
            <p className="text-indigo-200 text-sm">{format(today, 'EEEE')}</p>
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-xs text-indigo-200">
                {activeBatches.length > 0
                  ? `${activeBatches.length} batch${activeBatches.length > 1 ? 'es' : ''} currently active`
                  : 'No active batches today'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
