import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, BookOpen, Library, CalendarDays, ScrollText, MessageSquare, Shield, GraduationCap, ClipboardList, NotebookPen, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { getOwnerStats, getMessageUnreadCount } from '../api/index.js'
import NotificationBell from './NotificationBell.jsx'

export default function OwnerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMessages = location.pathname.endsWith('/messages')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [msgCount, setMsgCount] = useState(0)

  useEffect(() => {
    const fetchCounts = () => {
      getOwnerStats().then(res => setPendingCount(res.data.pending || 0)).catch(() => {})
      getMessageUnreadCount().then(res => setMsgCount(res.data.count || 0)).catch(() => {})
    }
    fetchCounts()
    const iv = setInterval(fetchCounts, 30000)
    return () => clearInterval(iv)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const roleLabel = user?.role === 'co_owner' ? 'Co-Owner' : user?.role === 'admin' ? 'Admin' : 'Owner'
  const isPrivileged = ['owner', 'co_owner'].includes(user?.role)
  const p = user?.permissions || {}
  const can = (flag) => isPrivileged || p[flag] === 1

  const navItems = [
    { to: '/owner/dashboard',       icon: LayoutDashboard, label: 'Dashboard',      show: true },
    { to: '/owner/team',            icon: Users,           label: 'Team',           badge: pendingCount, show: can('can_manage_trainers') },
    { to: '/owner/admissions',      icon: ClipboardList,   label: 'Admissions',     show: can('can_admit_students') },
    { to: '/owner/batches',         icon: BookOpen,        label: 'All Batches',    show: can('can_manage_batches') },
    { to: '/owner/topics-library',  icon: Library,         label: 'Topics Library', show: can('can_manage_batches') },
    { to: '/owner/calendars',       icon: CalendarDays,    label: 'Calendars',      show: can('can_view_reports') },
    { to: '/owner/students',        icon: GraduationCap,   label: 'Students',       show: can('can_manage_students') },
    { to: '/owner/daily-log',       icon: NotebookPen,     label: 'Daily Log',      show: can('can_manage_daily_log') },
    { to: '/owner/leave-log',       icon: ScrollText,      label: 'Leave Log',      show: can('can_approve_leaves') || can('can_view_reports') },
    { to: '/owner/messages',        icon: MessageSquare,   label: 'Messages',       badge: msgCount, show: can('can_message_all') },
    { to: '/owner/staff',           icon: Shield,          label: 'Staff Roles',    show: isPrivileged },
  ].filter(item => item.show)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="bg-white rounded-xl p-3 flex items-center justify-center">
          <img src="/DD_Logo_.png" alt="Define Digital" className="h-9 w-auto" />
        </div>
      </div>

      {/* User info */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: '#F5A623', color: '#1B3A6B' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'O'}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{user?.name || roleLabel}</p>
            <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 font-bold"
              style={{ background: '#F5A623', color: '#1B3A6B' }}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive ? 'bg-[#F5A623] text-[#1B3A6B] shadow-sm' : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <span className="text-xs font-bold bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Notification Bell + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <NotificationBell />
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-all">
          <LogOut size={18} className="flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 shadow-xl"
        style={{ background: 'linear-gradient(180deg, #1B3A6B 0%, #163058 100%)' }}>
        <SidebarContent />
      </aside>

      <aside className={`flex flex-col w-64 fixed inset-y-0 left-0 z-30 shadow-xl lg:hidden transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #1B3A6B 0%, #163058 100%)' }}>
        <div className="absolute top-4 right-4">
          <button onClick={() => setSidebarOpen(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
        </div>
        <SidebarContent />
      </aside>

      <div className={`flex-1 lg:ml-64 flex flex-col ${isMessages ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 z-10 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <img src="/DD_Logo_.png" alt="Define Digital" className="h-7 w-auto" />
        </header>
        <main className={`flex-1 ${isMessages ? 'overflow-hidden' : 'p-6 lg:p-8 overflow-y-auto'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
