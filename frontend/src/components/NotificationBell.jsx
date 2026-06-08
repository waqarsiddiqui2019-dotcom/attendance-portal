import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-react'
import { getNotifications, getUnreadCount, markNotificationRead, markAllRead } from '../api/index.js'
import { formatDistanceToNow, parseISO } from 'date-fns'

const TYPE_CONFIG = {
  info:    { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-50'   },
  success: { icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-50' },
  warning: { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-50'  },
  error:   { icon: XCircle,       color: 'text-rose-500',    bg: 'bg-rose-50'   },
  urgent:  { icon: Zap,           color: 'text-rose-600',    bg: 'bg-rose-100'  },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  try {
    // SQLite returns UTC as "2026-06-07 12:34:56" — append Z so browser parses as UTC, not local time
    const iso = dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z')
    const d = parseISO(iso)
    if (isNaN(d.getTime())) return ''
    return formatDistanceToNow(d, { addSuffix: true })
  } catch { return '' }
}

export default function NotificationBell({ sidebarMode = false }) {
  const [unread, setUnread]           = useState(0)
  const [open, setOpen]               = useState(false)
  const [notifications, setNotifs]    = useState([])
  const [loading, setLoading]         = useState(false)
  const dropRef                       = useRef(null)

  const fetchCount = useCallback(() => {
    getUnreadCount().then(r => setUnread(r.data.count || 0)).catch(() => {})
  }, [])

  const fetchNotifs = useCallback(() => {
    setLoading(true)
    getNotifications()
      .then(r => setNotifs(r.data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open) fetchNotifs()
  }

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const handleMarkAll = async () => {
    try {
      await markAllRead()
      setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnread(0)
    } catch {}
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={handleOpen}
        className={`relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          open ? 'bg-[#F5A623] text-[#1B3A6B]' : 'text-blue-200 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Bell size={18} className="flex-shrink-0" />
        <span className="flex-1">Notifications</span>
        {unread > 0 && (
          <span className="text-xs font-bold bg-rose-500 text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 flex-shrink-0">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span className="font-bold text-slate-800 text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-[#2272B9] hover:text-[#1B3A6B] font-medium flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Bell size={24} className="mb-2 text-slate-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
                const Icon = cfg.icon
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition ${n.is_read ? '' : 'bg-blue-50/30'}`}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold ${n.is_read ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
