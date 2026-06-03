import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, BookOpen, GraduationCap, Clock, ArrowRight, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { getOwnerStats, getOwnerBatches } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800 mb-0.5">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ trainers: 0, pending: 0, students: 0, batches: 0 })
  const [recentBatches, setRecentBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getOwnerStats(), getOwnerBatches()])
      .then(([sRes, bRes]) => {
        setStats(sRes.data)
        setRecentBatches((bRes.data.batches || []).slice(0, 4))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const statCards = [
    { icon: Users,          label: 'Active Trainers',   value: stats.trainers, color: 'text-primary',    bg: 'bg-primary-light' },
    { icon: GraduationCap,  label: 'Total Students',    value: stats.students, color: 'text-brand-blue', bg: 'bg-brand-blue-light' },
    { icon: BookOpen,       label: 'Total Batches',     value: stats.batches,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: Clock,          label: 'Pending Approvals', value: stats.pending,  color: stats.pending > 0 ? 'text-rose-600' : 'text-slate-400', bg: stats.pending > 0 ? 'bg-rose-50' : 'bg-slate-100' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          {greeting}, {user?.name?.split(' ')[0] || 'Owner'}!
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {format(new Date(), 'EEEE, MMMM d, yyyy')} &mdash; Owner Dashboard
        </p>
      </div>

      {/* Pending alert */}
      {stats.pending > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {stats.pending} trainer request{stats.pending > 1 ? 's' : ''} waiting for approval
              </p>
              <p className="text-xs text-amber-600">Review and approve or reject from the Team section</p>
            </div>
          </div>
          <Link to="/owner/team"
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex-shrink-0">
            Review <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent batches */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Recent Batches (All Trainers)</h2>
            <Link to="/owner/batches" className="text-sm text-primary font-medium hover:text-primary-dark flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : recentBatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No batches created yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBatches.map(batch => (
                <div key={batch.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{batch.name}</h3>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">Trainer: <span className="font-medium text-brand-blue">{batch.trainer_name}</span></span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{batch.student_count} students</span>
                      </div>
                    </div>
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
            <Link to="/owner/team"
              className="flex items-center gap-3 w-full bg-primary hover:bg-primary-dark text-white font-medium px-4 py-3.5 rounded-xl transition shadow-sm shadow-primary/30 text-sm">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Users size={16} />
              </div>
              Manage Trainers
            </Link>
            <Link to="/owner/batches"
              className="flex items-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-3.5 rounded-xl border border-slate-200 transition text-sm">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <BookOpen size={16} className="text-slate-500" />
              </div>
              View All Batches
            </Link>
          </div>

          <div className="mt-4 rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2272B9 100%)' }}>
            <p className="text-blue-200 text-xs font-medium uppercase tracking-wider mb-3">Institute Overview</p>
            <p className="text-2xl font-bold mb-1">{stats.trainers} Trainers</p>
            <p className="text-blue-200 text-sm">{stats.students} students across {stats.batches} batches</p>
            {stats.pending > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs text-amber-300 font-medium">⚠ {stats.pending} pending approval</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
