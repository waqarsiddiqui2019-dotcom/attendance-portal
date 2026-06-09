import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, BookOpen, GraduationCap, Clock, ArrowRight, AlertTriangle,
  XCircle, FileText, MessageSquare, Shield, ChevronDown, ChevronUp,
} from 'lucide-react'
import { format } from 'date-fns'
import { getOwnerStats, getOwnerBatches, getOwnerTrainerStats, getOwnerLeaveAlerts } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

const LEAVE_ICONS = { medical:'🏥', personal:'👤', emergency:'🚨', family:'👨‍👩‍👧', other:'📝' }

function StatCard({ icon: Icon, label, value, color, bg, to, subtitle }) {
  const inner = (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full">
      <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800 mb-0.5">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>
}

function SectionHeader({ title, subtitle, icon: Icon, color = 'text-slate-700' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon size={16} className={color} />}
      <div>
        <h2 className={`text-base font-semibold ${color}`}>{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return d }
}

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [stats, setStats]           = useState({ trainers: 0, inactive: 0, pending: 0, students: 0, batches: 0, activeBatches: 0, inactiveBatches: 0 })
  const [recentBatches, setRecentBatches] = useState([])
  const [trainerStats, setTrainerStats]   = useState([])
  const [alerts, setAlerts]               = useState({ overdue_48h: [], recently_rejected: [] })
  const [loading, setLoading]             = useState(true)
  const [showAllRejected, setShowAllRejected] = useState(false)

  useEffect(() => {
    Promise.all([getOwnerStats(), getOwnerBatches(), getOwnerTrainerStats(), getOwnerLeaveAlerts()])
      .then(([sRes, bRes, tRes, aRes]) => {
        setStats(sRes.data)
        setRecentBatches((bRes.data.batches || []).slice(0, 4))
        setTrainerStats(tRes.data.trainers || [])
        setAlerts(aRes.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const overdue  = alerts.overdue_48h || []
  const rejected = alerts.recently_rejected || []
  const rejectedVisible = showAllRejected ? rejected : rejected.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {greeting}, {user?.name?.split(' ')[0] || 'Owner'}!
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {format(new Date(), 'EEEE, MMMM d, yyyy')} &mdash; Owner Dashboard
        </p>
      </div>

      {/* Trainer pending approval alert */}
      {stats.pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
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

      {/* 48h Overdue Leave Alert */}
      {overdue.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-rose-600" />
            <span className="font-bold text-rose-800 text-sm">
              {overdue.length} leave request{overdue.length > 1 ? 's' : ''} pending for 48+ hours — no trainer response
            </span>
          </div>
          <div className="space-y-2">
            {overdue.map(lr => (
              <div key={lr.id} className="bg-white rounded-xl border border-rose-200 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{lr.student_name}</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-500">{lr.batch_name}</span>
                    {lr.leave_type === 'emergency' && (
                      <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full">EMERGENCY</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {LEAVE_ICONS[lr.leave_type]} {lr.leave_type} · {lr.from_date} → {lr.to_date} · Trainer: {lr.trainer_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-rose-700">{lr.hours_pending}h pending</p>
                  <Link to="/owner/leave-log"
                    className="text-[10px] text-[#2272B9] hover:underline">View log</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Trainers" value={stats.trainers}
          color="text-primary" bg="bg-primary-light" to="/owner/team"
          subtitle={stats.inactive > 0 ? `${stats.inactive} inactive` : undefined} />
        <StatCard icon={GraduationCap} label="Total Students" value={stats.students}
          color="text-brand-blue" bg="bg-brand-blue-light" />
        <StatCard icon={BookOpen} label="Total Batches" value={stats.batches}
          color="text-emerald-600" bg="bg-emerald-50" to="/owner/batches"
          subtitle={stats.inactiveBatches > 0 ? `${stats.activeBatches} active · ${stats.inactiveBatches} inactive` : undefined} />
        <StatCard icon={Clock} label="Pending Approvals" value={stats.pending}
          color={stats.pending > 0 ? 'text-rose-600' : 'text-slate-400'}
          bg={stats.pending > 0 ? 'bg-rose-50' : 'bg-slate-100'}
          to="/owner/team" />
      </div>

      {/* Trainer Stats Grid */}
      {!loading && trainerStats.length > 0 && (
        <div>
          <SectionHeader title="Trainer Activity Overview" subtitle="Pending requests, approvals and appointments this month" icon={Users} />
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {trainerStats.map(t => {
              const totalPending = t.pending_leaves + t.pending_appts
              const isInactive = t.status === 'inactive'
              return (
                <div key={t.id} className={`bg-white border rounded-2xl p-4 transition ${isInactive ? 'opacity-60 border-slate-200' : totalPending > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isInactive ? 'bg-slate-200 text-slate-500' : 'bg-[#2272B9] text-white'}`}>
                      {t.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.batch_count} batch{t.batch_count !== 1 ? 'es' : ''} · {t.student_count} students</p>
                    </div>
                    {isInactive ? (
                      <span className="ml-auto text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0">Inactive</span>
                    ) : totalPending > 0 ? (
                      <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        {totalPending} pending
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-xs">
                    {[
                      { l: 'Leave\nPending',  v: t.pending_leaves,        c: t.pending_leaves > 0 ? 'text-amber-600 font-bold' : 'text-slate-400' },
                      { l: 'Appt\nPending',   v: t.pending_appts,         c: t.pending_appts > 0 ? 'text-amber-600 font-bold' : 'text-slate-400' },
                      { l: 'Approved\nThis Month', v: t.approved_leaves_month, c: 'text-emerald-600' },
                      { l: 'Rejected\nThis Month', v: t.rejected_leaves_month, c: t.rejected_leaves_month > 0 ? 'text-rose-600' : 'text-slate-400' },
                    ].map(s => (
                      <div key={s.l} className="bg-slate-50 rounded-lg p-2">
                        <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
                        <p className="text-[9px] text-slate-500 leading-tight whitespace-pre-line">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Rejection log */}
        <div className="lg:col-span-2 space-y-4">
          {rejected.length > 0 && (
            <div>
              <SectionHeader
                title="Recent Trainer Rejections"
                subtitle="Leave requests rejected by trainers in the last 30 days"
                icon={XCircle}
                color="text-rose-700"
              />
              <div className="space-y-2">
                {rejectedVisible.map(lr => (
                  <div key={lr.id} className="bg-white border border-rose-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{lr.student_name}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500">{lr.batch_name}</span>
                          <span className="text-xs bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded-full">
                            {LEAVE_ICONS[lr.leave_type]} {lr.leave_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {lr.from_date} → {lr.to_date} · Rejected by <span className="font-medium">{lr.trainer_name}</span> on {fmtDate(lr.reviewed_at?.slice(0,10))}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Trainer Rejection Reason</p>
                      <p className="text-xs text-slate-700">{lr.rejection_reason || '—'}</p>
                    </div>
                    {lr.student_reason && (
                      <div className="mt-2 bg-blue-50 rounded-lg p-2.5">
                        <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Student's Original Reason</p>
                        <p className="text-xs text-slate-700">{lr.student_reason}</p>
                      </div>
                    )}
                  </div>
                ))}
                {rejected.length > 3 && (
                  <button onClick={() => setShowAllRejected(v => !v)}
                    className="flex items-center gap-1 text-xs text-[#2272B9] font-medium hover:underline mx-auto mt-1">
                    {showAllRejected ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show {rejected.length - 3} more</>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recent batches */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-800">Recent Batches</h2>
              <Link to="/owner/batches" className="text-sm text-primary font-medium hover:text-primary-dark flex items-center gap-1">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : recentBatches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No batches created yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentBatches.map(batch => (
                  <div key={batch.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between hover:border-primary/30 transition">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{batch.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium text-brand-blue">{batch.trainer_name}</span>
                        <span className="text-slate-400"> · {batch.student_count} students</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/owner/team"
              className="flex items-center gap-3 w-full bg-primary hover:bg-primary-dark text-white font-medium px-4 py-3.5 rounded-xl transition shadow-sm shadow-primary/30 text-sm">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Users size={16} /></div>
              Manage Team
            </Link>
            <Link to="/owner/messages"
              className="flex items-center gap-3 w-full bg-[#2272B9] hover:bg-[#1B3A6B] text-white font-medium px-4 py-3.5 rounded-xl transition text-sm">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><MessageSquare size={16} /></div>
              Send Messages
            </Link>
            <Link to="/owner/leave-log"
              className="flex items-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-3.5 rounded-xl border border-slate-200 transition text-sm">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><FileText size={16} className="text-slate-500" /></div>
              Leave Log
            </Link>
            <Link to="/owner/staff"
              className="flex items-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-3.5 rounded-xl border border-slate-200 transition text-sm">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><Shield size={16} className="text-purple-600" /></div>
              Manage Staff Roles
            </Link>
          </div>

          <div className="mt-4 rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2272B9 100%)' }}>
            <p className="text-blue-200 text-xs font-medium uppercase tracking-wider mb-3">Institute Overview</p>
            <p className="text-2xl font-bold mb-1">{stats.trainers} Active Trainers</p>
            <p className="text-blue-200 text-sm">
              {stats.students} students · {stats.batches} batches
              {stats.inactive > 0 && ` · ${stats.inactive} inactive`}
            </p>
            {(overdue.length > 0 || rejected.length > 0) && (
              <div className="mt-3 pt-3 border-t border-white/20 space-y-1">
                {overdue.length > 0 && <p className="text-xs text-rose-300 font-medium">⏱ {overdue.length} leave{overdue.length > 1 ? 's' : ''} overdue 48h</p>}
                {rejected.length > 0 && <p className="text-xs text-amber-300 font-medium">❌ {rejected.length} recent rejection{rejected.length > 1 ? 's' : ''}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
