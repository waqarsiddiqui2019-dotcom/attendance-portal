import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Search, MessageSquare, Loader2, ArrowLeft, Eye, ChevronDown } from 'lucide-react'
import {
  getMessageContacts, getMessageThread, sendMessage,
  getMessageAllLogs, getAdminConversation,
} from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import toast from 'react-hot-toast'

const OWNER_ROLES = ['owner', 'co_owner', 'admin']
const ROLE_LABELS = { owner: 'Owner', co_owner: 'Co-Owner', admin: 'Admin', trainer: 'Trainer', student: 'Student' }
const ROLE_BG = {
  owner: '#F5A623', co_owner: '#8B5CF6', admin: '#64748B', trainer: '#2272B9', student: '#10B981',
}
const ROLE_TEXT = {
  owner: '#1B3A6B', co_owner: '#fff', admin: '#fff', trainer: '#fff', student: '#fff',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// SQLite returns UTC datetimes with no 'Z' suffix (e.g. "2026-06-07 09:13:03") —
// parse explicitly as UTC, otherwise Node/browser interpret it as local time
function parseUTC(dt) {
  return new Date(dt.replace(' ', 'T') + (dt.endsWith('Z') ? '' : 'Z'))
}

function fmtMsgTime(dt) {
  if (!dt) return ''
  const d = parseUTC(dt)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtListTime(dt) {
  if (!dt) return ''
  const d = parseUTC(dt)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtDateSep(dt) {
  if (!dt) return ''
  const d = parseUTC(dt)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtLastSeen(ls) {
  if (!ls) return 'Offline'
  const ms = Date.now() - parseUTC(ls).getTime()
  if (ms < 60000) return 'Last seen just now'
  if (ms < 3600000) return `Last seen ${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `Last seen ${Math.floor(ms / 3600000)}h ago`
  return `Last seen ${parseUTC(ls).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, role, size = 'md', isOnline = false, showOnline = false }) {
  const s = { sm: 'w-9 h-9 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-14 h-14 text-base' }[size]
  const dotS = { sm: 'w-2.5 h-2.5 border-[1.5px]', md: 'w-3 h-3 border-2', lg: 'w-3.5 h-3.5 border-2' }[size]
  return (
    <div className="relative flex-shrink-0">
      <div className={`${s} rounded-full flex items-center justify-center font-bold select-none`}
        style={{ background: ROLE_BG[role] || '#94A3B8', color: ROLE_TEXT[role] || '#fff' }}>
        {name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      {showOnline && (
        <span className={`absolute bottom-0 right-0 ${dotS} rounded-full border-white ${isOnline ? 'bg-emerald-400' : 'bg-gray-400'}`} />
      )}
    </div>
  )
}

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role, small = false }) {
  return (
    <span className={`font-bold rounded-full px-2 ${small ? 'text-[9px] py-0.5' : 'text-[10px] py-0.5'}`}
      style={{ background: ROLE_BG[role] || '#94A3B8', color: ROLE_TEXT[role] || '#fff' }}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

// ── Date separator ─────────────────────────────────────────────────────────────
function DateSep({ label }) {
  return (
    <div className="flex items-center justify-center py-3">
      <span className="bg-white/80 backdrop-blur-sm text-gray-500 text-[11px] font-medium px-4 py-1 rounded-full shadow-sm border border-white/50">
        {label}
      </span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Messages() {
  const { user } = useAuth()
  const isOwner = OWNER_ROLES.includes(user?.role)

  const [tab, setTab]             = useState('mine')
  const [contacts, setContacts]   = useState([])
  const [thread, setThread]       = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [selected, setSelected]   = useState(null)
  const [body, setBody]           = useState('')
  const [search, setSearch]       = useState('')
  const [loadingC, setLoadingC]   = useState(true)
  const [loadingT, setLoadingT]   = useState(false)
  const [sending, setSending]     = useState(false)
  const [showThread, setShowThread] = useState(false)
  const [showDownBtn, setShowDownBtn] = useState(false)

  const [allConvos, setAllConvos]     = useState([])
  const [loadingAll, setLoadingAll]   = useState(false)
  const [adminThread, setAdminThread] = useState([])
  const [adminUsers, setAdminUsers]   = useState(null)
  const [selConvo, setSelConvo]       = useState(null)
  const [loadingAT, setLoadingAT]     = useState(false)
  const [showAT, setShowAT]           = useState(false)
  const [searchAll, setSearchAll]     = useState('')

  const bottomRef   = useRef(null)
  const aBottomRef  = useRef(null)
  const msgAreaRef  = useRef(null)
  const textRef     = useRef(null)
  const pollRef     = useRef(null)

  // ── Contacts ─────────────────────────────────────────────────────────────────
  const loadContacts = useCallback(() => {
    getMessageContacts()
      .then(r => setContacts(r.data.contacts || []))
      .catch(() => {})
      .finally(() => setLoadingC(false))
  }, [])
  useEffect(() => { loadContacts() }, [loadContacts])

  // ── Thread ────────────────────────────────────────────────────────────────────
  const loadThread = useCallback((uid) => {
    setLoadingT(true)
    getMessageThread(uid)
      .then(r => {
        setThread(r.data.messages || [])
        setOtherUser(r.data.other_user || null)
        setContacts(prev => prev.map(c => c.id === uid ? { ...c, unread_count: 0 } : c))
      })
      .catch(() => {})
      .finally(() => setLoadingT(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      getMessageThread(selected)
        .then(r => {
          setThread(r.data.messages || [])
          if (r.data.other_user) setOtherUser(r.data.other_user)
          setContacts(prev => prev.map(c => c.id === selected ? { ...c, unread_count: 0 } : c))
        })
        .catch(() => {})
    }, 10000)
    return () => clearInterval(pollRef.current)
  }, [selected])

  // Auto-scroll when thread grows
  useEffect(() => {
    const el = msgAreaRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowDownBtn(false)
    } else {
      setShowDownBtn(true)
    }
  }, [thread])

  useEffect(() => { aBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [adminThread])

  const handleScroll = (e) => {
    const el = e.target
    setShowDownBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  const scrollDown = () => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowDownBtn(false) }

  const pickContact = (c) => { setSelected(c.id); setShowThread(true); loadThread(c.id); setShowDownBtn(false) }

  const handleSend = async () => {
    if (!body.trim() || !selected || sending) return
    setSending(true)
    try {
      const r = await sendMessage({ recipient_id: selected, body: body.trim() })
      setThread(prev => [...prev, r.data.message])
      setBody('')
      if (textRef.current) textRef.current.style.height = 'auto'
      loadContacts()
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowDownBtn(false) }, 50)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send')
    } finally { setSending(false) }
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  const growTextarea = (e) => {
    setBody(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // ── All Conversations ─────────────────────────────────────────────────────────
  const loadAllConvos = useCallback(() => {
    setLoadingAll(true)
    getMessageAllLogs()
      .then(r => setAllConvos(r.data.conversations || []))
      .catch(() => {})
      .finally(() => setLoadingAll(false))
  }, [])

  useEffect(() => { if (tab === 'all' && isOwner) loadAllConvos() }, [tab, isOwner, loadAllConvos])

  const pickConvo = (conv) => {
    setSelConvo(conv); setShowAT(true); setLoadingAT(true)
    getAdminConversation(conv.user1_id, conv.user2_id)
      .then(r => { setAdminThread(r.data.messages || []); setAdminUsers({ u1: r.data.user1, u2: r.data.user2 }) })
      .catch(() => {})
      .finally(() => setLoadingAT(false))
  }

  const fc = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )
  const fv = allConvos.filter(cv =>
    cv.user1?.name?.toLowerCase().includes(searchAll.toLowerCase()) ||
    cv.user2?.name?.toLowerCase().includes(searchAll.toLowerCase())
  )

  const newDateSep = (msgs, i) => i === 0 || msgs[i].created_at?.slice(0, 10) !== msgs[i - 1]?.created_at?.slice(0, 10)

  // ─────────────────────────────────────────────────────────────────────────────
  const leftHidden = (tab === 'mine' && showThread) || (tab === 'all' && showAT)
  const rightMine  = tab === 'mine' && showThread
  const rightAll   = tab === 'all'  && showAT

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#eae6df' }}>

      {/* ════════════════════════════════════════════════════
          LEFT PANEL — Contact / Conversation list
      ════════════════════════════════════════════════════ */}
      <div className={`${leftHidden ? 'hidden lg:flex' : 'flex'} flex-col bg-white border-r border-gray-200 w-full lg:w-[360px] xl:w-96 flex-shrink-0 h-full`}>

        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">
              {tab === 'mine' ? 'Messages' : 'All Chats'}
            </h1>
            {isOwner && (
              <span className="text-xs text-[#2272B9] font-semibold bg-blue-50 px-2.5 py-1 rounded-full">
                {tab === 'mine' ? `${contacts.length} contacts` : `${allConvos.length} convos`}
              </span>
            )}
          </div>
          {/* Owner tabs */}
          {isOwner && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
              {[{ id: 'mine', label: 'My Chats' }, { id: 'all', label: 'All Logs' }].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.id ? 'bg-white text-[#2272B9] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={tab === 'mine' ? search : searchAll}
              onChange={e => tab === 'mine' ? setSearch(e.target.value) : setSearchAll(e.target.value)}
              placeholder="Search…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 text-sm text-gray-800 placeholder-gray-400 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#2272B9]/20"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'mine' ? (
            loadingC ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={26} className="animate-spin text-gray-300" />
              </div>
            ) : fc.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                <MessageSquare size={36} className="text-gray-300" />
                <p className="text-sm font-medium">No contacts found</p>
              </div>
            ) : fc.map(c => {
              const active = selected === c.id
              return (
                <button key={c.id} onClick={() => pickContact(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 ${active ? 'bg-blue-50/60 border-l-[3px] border-l-[#2272B9]' : ''}`}>
                  <Avatar name={c.name} role={c.role} size="md" showOnline isOnline={c.is_online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-sm font-semibold truncate ${active ? 'text-[#2272B9]' : 'text-gray-900'}`}>{c.name}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 font-medium">
                        {c.last_message ? fmtListTime(c.last_message.created_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <RoleBadge role={c.role} small />
                      <p className="text-[10px] text-gray-400 truncate">{c.email}</p>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-gray-500 truncate leading-relaxed">
                        {c.last_message
                          ? (c.last_message.sender_id === user?.id
                              ? <span><span className="text-gray-600">You: </span>{c.last_message.body}</span>
                              : c.last_message.body)
                          : <span className="italic text-gray-400">No messages yet</span>}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1.5"
                          style={{ background: '#2272B9' }}>
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            /* All conversations list */
            loadingAll ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={26} className="animate-spin text-gray-300" />
              </div>
            ) : fv.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                <Eye size={36} className="text-gray-300" />
                <p className="text-sm font-medium">No conversations yet</p>
              </div>
            ) : fv.map((cv, i) => {
              const isA = selConvo?.user1_id === cv.user1_id && selConvo?.user2_id === cv.user2_id
              return (
                <button key={i} onClick={() => pickConvo(cv)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-50 transition-colors hover:bg-gray-50 ${isA ? 'bg-blue-50/60 border-l-[3px] border-l-[#2272B9]' : ''}`}>
                  <div className="flex -space-x-3 flex-shrink-0">
                    <Avatar name={cv.user1?.name} role={cv.user1?.role} size="sm" />
                    <Avatar name={cv.user2?.name} role={cv.user2?.role} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0 ml-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{cv.user1?.name} ↔ {cv.user2?.name}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtListTime(cv.last_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-gray-500 truncate">{cv.last_message?.body || 'No messages'}</p>
                      <span className="flex-shrink-0 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">{cv.msg_count}</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          RIGHT PANEL — Thread / Admin view
      ════════════════════════════════════════════════════ */}

      {tab === 'mine' ? (
        /* ── MY MESSAGES THREAD ── */
        selected ? (
          <div className={`${showThread ? 'flex' : 'hidden lg:flex'} flex-col flex-1 overflow-hidden min-w-0 relative`}>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
              <button onClick={() => setShowThread(false)} className="lg:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 mr-0.5 flex-shrink-0">
                <ArrowLeft size={20} />
              </button>
              {otherUser && (
                <>
                  <Avatar name={otherUser.name} role={otherUser.role} size="md" showOnline isOnline={otherUser.is_online} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-tight truncate">{otherUser.name}</p>
                    <p className="text-[11px] text-gray-400 leading-tight truncate">{otherUser.email}</p>
                    <p className={`text-xs font-medium leading-tight ${otherUser.is_online ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {otherUser.is_online ? '● Online' : fmtLastSeen(otherUser.last_seen)}
                    </p>
                  </div>
                  <RoleBadge role={otherUser.role} />
                </>
              )}
            </div>

            {/* Messages */}
            <div
              ref={msgAreaRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5"
              style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='40' cy='40' r='1.2' fill='%23b8b0a8' opacity='0.25'/%3E%3C/svg%3E\")",
                backgroundColor: '#e5ddd5',
              }}
            >
              {loadingT ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white/80 rounded-2xl px-8 py-6 shadow-sm">
                    <Loader2 size={28} className="animate-spin text-gray-400 mx-auto" />
                  </div>
                </div>
              ) : thread.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-10 py-8 shadow-sm text-center max-w-xs">
                    <MessageSquare size={36} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-700 mb-1">Start the conversation</p>
                    <p className="text-xs text-gray-400">Messages are end-to-end within your portal</p>
                  </div>
                </div>
              ) : (
                <>
                  {thread.map((msg, i) => {
                    const mine = msg.sender_id === user?.id
                    const sep  = newDateSep(thread, i)
                    return (
                      <React.Fragment key={msg.id}>
                        {sep && <DateSep label={fmtDateSep(msg.created_at)} />}
                        <div className={`flex items-end gap-2 mb-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                          {!mine && <Avatar name={msg.sender_name} role={msg.sender_role} size="sm" />}
                          <div className={`max-w-[68%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                            <div
                              className={`px-3.5 py-2 rounded-2xl shadow-sm relative ${
                                mine ? 'rounded-br-sm' : 'rounded-bl-sm'
                              }`}
                              style={mine
                                ? { background: '#D9FDD3', color: '#111' }
                                : { background: '#fff', color: '#111' }
                              }
                            >
                              {/* Tail */}
                              <div
                                className={`absolute bottom-0 w-3 h-3 ${mine ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'}`}
                                style={{
                                  clipPath: mine ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)',
                                  background: mine ? '#D9FDD3' : '#fff',
                                }}
                              />
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                              <p className={`text-[10px] mt-1 text-right text-gray-400 leading-none`}>
                                {fmtMsgTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                  <div ref={bottomRef} className="h-1" />
                </>
              )}
            </div>

            {/* Scroll-to-bottom button */}
            {showDownBtn && (
              <button onClick={scrollDown}
                className="absolute bottom-[76px] right-5 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition z-10">
                <ChevronDown size={20} />
              </button>
            )}

            {/* Input bar */}
            <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-100">
              <div className="flex items-end gap-3">
                <div className="flex-1 flex items-end bg-gray-100 rounded-2xl px-4 py-2.5 gap-2">
                  <textarea
                    ref={textRef}
                    value={body}
                    onChange={growTextarea}
                    onKeyDown={onKey}
                    placeholder="Type a message"
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none leading-relaxed max-h-28 overflow-y-auto"
                    style={{ minHeight: 22 }}
                  />
                </div>
                <button onClick={handleSend} disabled={!body.trim() || sending}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm disabled:opacity-50 disabled:scale-95 active:scale-95"
                  style={{ background: body.trim() && !sending ? '#2272B9' : '#94A3B8' }}>
                  {sending
                    ? <Loader2 size={18} className="animate-spin text-white" />
                    : <Send size={18} className="text-white translate-x-0.5" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        ) : (
          /* No contact selected — desktop placeholder */
          <div className="hidden lg:flex flex-col items-center justify-center flex-1 h-full" style={{ background: '#eae6df' }}>
            <div className="bg-white rounded-3xl p-14 shadow-sm text-center max-w-sm">
              <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: '#e8f4fd' }}>
                <MessageSquare size={40} style={{ color: '#2272B9' }} />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Your Messages</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Select a contact on the left to open a conversation</p>
            </div>
          </div>
        )
      ) : (
        /* ── ALL CONVERSATIONS (OWNER) ── */
        selConvo ? (
          <div className={`${showAT ? 'flex' : 'hidden lg:flex'} flex-col flex-1 overflow-hidden min-w-0`}>
            {/* Admin header */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
              <button onClick={() => setShowAT(false)} className="lg:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 mr-0.5">
                <ArrowLeft size={20} />
              </button>
              {adminUsers && (
                <>
                  <div className="flex -space-x-3 flex-shrink-0">
                    <Avatar name={adminUsers.u1?.name} role={adminUsers.u1?.role} size="sm" />
                    <Avatar name={adminUsers.u2?.name} role={adminUsers.u2?.role} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0 ml-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{adminUsers.u1?.name} ↔ {adminUsers.u2?.name}</p>
                    <p className="text-xs text-gray-400">{adminThread.length} messages · monitoring view</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full flex-shrink-0 font-medium">
                    <Eye size={12} /> Read-only
                  </span>
                </>
              )}
            </div>

            {/* Admin messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
              style={{ backgroundColor: '#e5ddd5', backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='40' cy='40' r='1.2' fill='%23b8b0a8' opacity='0.25'/%3E%3C/svg%3E\")" }}>
              {loadingAT ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                </div>
              ) : adminThread.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white/90 rounded-2xl px-8 py-6 shadow-sm text-center">
                    <p className="text-sm text-gray-500">No messages in this conversation</p>
                  </div>
                </div>
              ) : (
                <>
                  {adminThread.map((msg, i) => {
                    const sep = newDateSep(adminThread, i)
                    return (
                      <React.Fragment key={msg.id}>
                        {sep && <DateSep label={fmtDateSep(msg.created_at)} />}
                        <div className="flex items-start gap-2.5">
                          <Avatar name={msg.sender_name} role={msg.sender_role} size="sm" />
                          <div className="max-w-[72%]">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-gray-700">{msg.sender_name}</span>
                              <RoleBadge role={msg.sender_role} small />
                            </div>
                            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                              <p className="text-[10px] text-gray-400 mt-1 text-right">{fmtMsgTime(msg.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                  <div ref={aBottomRef} />
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center flex-1 h-full" style={{ background: '#eae6df' }}>
            <div className="bg-white rounded-3xl p-14 shadow-sm text-center max-w-sm">
              <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: '#e8f4fd' }}>
                <Eye size={40} style={{ color: '#2272B9' }} />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">All Conversations</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Select any conversation from the list to view the full history</p>
            </div>
          </div>
        )
      )}
    </div>
  )
}
