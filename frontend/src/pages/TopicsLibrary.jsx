import React, { useEffect, useState, useCallback } from 'react'
import {
  Library, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Shuffle,
  BookOpen, Loader2, X, Save, Wifi, Building2, Clock, AlertCircle,
  CheckCircle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getTopicSets, createTopicSet, updateTopicSet, deleteTopicSet,
  getTopicSetItems, saveTopicSetItems,
} from '../api/index.js'

// ── helpers ────────────────────────────────────────────────────────────────────
function friendlyError(err) {
  if (!err) return 'Unknown error.'
  if (!err.response) return 'Cannot reach the server. Make sure START-APP.bat is running and try again.'
  const msg = err.response?.data?.error || err.response?.data?.message || ''
  if (err.response.status === 403) return 'Access denied. Make sure you are logged in as a Trainer.'
  if (err.response.status === 404) return 'Item not found. Refresh the page and try again.'
  if (err.response.status === 400) return msg || 'Invalid input. Check all fields and try again.'
  if (err.response.status >= 500) return 'Server error. Restart the app via START-APP.bat and try again.'
  return msg || 'Something went wrong. Please try again.'
}

// ── PageError banner ───────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
      <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-rose-700 flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-rose-600 font-semibold hover:underline flex-shrink-0">
          Retry
        </button>
      )}
    </div>
  )
}

// ── TopicForm (add / edit inline) ──────────────────────────────────────────────
function TopicForm({ initial, onSave, onCancel, saving }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [desc,  setDesc]  = useState(initial?.description || '')
  const [hours, setHours] = useState(initial?.duration_hours ?? 1)
  const [mode,  setMode]  = useState(initial?.mode || 'offline')
  const [err,   setErr]   = useState('')

  const handleSave = () => {
    if (!title.trim()) { setErr('Topic title is required.'); return }
    setErr('')
    onSave({ title: title.trim(), description: desc.trim(), duration_hours: parseFloat(hours) || 1, mode })
  }

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-4 py-4">
      <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wider">
        {initial ? 'Edit Topic' : 'Add New Topic'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input
            autoFocus
            value={title}
            onChange={e => { setTitle(e.target.value); setErr('') }}
            placeholder="e.g. Introduction to SEO"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {err && <p className="text-xs text-rose-600 mt-1">⚠ {err}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Brief description (optional)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Duration (hours)</label>
          <input
            type="number" step="0.5" min="0.5" max="12"
            value={hours}
            onChange={e => setHours(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="offline">🏫 Offline</option>
            <option value="online">💻 Online</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition"
        >
          {saving
            ? <><Loader2 size={12} className="animate-spin" /> Saving...</>
            : <><Save size={12} /> {initial ? 'Save Changes' : 'Add Topic'}</>}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TopicsLibrary() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  // ── Sets state ───────────────────────────────────────────────────────────────
  const [sets, setSets]               = useState([])
  const [loadingSets, setLoadingSets] = useState(true)
  const [setsError, setSetsError]     = useState('')
  const [selectedSetId, setSelectedSetId] = useState(null)

  // ── Items state ──────────────────────────────────────────────────────────────
  const [items, setItems]               = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [itemsError, setItemsError]     = useState('')
  const [savingItems, setSavingItems]   = useState(false)

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [creatingSet, setCreatingSet] = useState(false)
  const [newSetName, setNewSetName]   = useState('')
  const [newSetDesc, setNewSetDesc]   = useState('')
  const [savingSet, setSavingSet]     = useState(false)
  const [setFormError, setSetFormError] = useState('')

  const [editingSetId, setEditingSetId] = useState(null)

  const [showAddTopic, setShowAddTopic]     = useState(false)
  const [editingTopicIdx, setEditingTopicIdx] = useState(null)

  const [plannerOpen, setPlannerOpen] = useState(false)

  // ── Load sets ─────────────────────────────────────────────────────────────────
  const loadSets = useCallback(() => {
    setLoadingSets(true)
    setSetsError('')
    getTopicSets()
      .then(res => setSets(res.data.sets || []))
      .catch(err => setSetsError(friendlyError(err)))
      .finally(() => setLoadingSets(false))
  }, [])

  useEffect(() => { loadSets() }, [loadSets])

  // ── Load items when set selected ──────────────────────────────────────────────
  const loadItems = useCallback((setId) => {
    if (!setId) return
    setLoadingItems(true)
    setItemsError('')
    setShowAddTopic(false)
    setEditingTopicIdx(null)
    getTopicSetItems(setId)
      .then(res => setItems(res.data.items || []))
      .catch(err => setItemsError(friendlyError(err)))
      .finally(() => setLoadingItems(false))
  }, [])

  useEffect(() => { if (selectedSetId) loadItems(selectedSetId) }, [selectedSetId, loadItems])

  // ── Set CRUD ──────────────────────────────────────────────────────────────────
  const handleCreateSet = async () => {
    if (!newSetName.trim()) { setSetFormError('Please enter a set name.'); return }
    setSavingSet(true)
    setSetFormError('')
    try {
      const res = await createTopicSet({ name: newSetName.trim(), description: newSetDesc.trim() || null })
      const newSet = { ...res.data.set, item_count: 0 }
      setSets(prev => [newSet, ...prev])
      setSelectedSetId(newSet.id)
      setItems([])
      setCreatingSet(false)
      setNewSetName('')
      setNewSetDesc('')
      toast.success('Topic set created! Now add topics to it.')
    } catch (err) {
      setSetFormError(friendlyError(err))
    } finally {
      setSavingSet(false)
    }
  }

  const handleRenameSet = async (setId, name, description) => {
    if (!name.trim()) return
    try {
      const res = await updateTopicSet(setId, { name: name.trim(), description: description?.trim() || null })
      setSets(prev => prev.map(s => s.id === setId ? { ...s, ...res.data.set } : s))
      setEditingSetId(null)
      toast.success('Set renamed ✅')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  const handleDeleteSet = async (set) => {
    if (!window.confirm(`Delete "${set.name}" and all its topics?`)) return
    try {
      await deleteTopicSet(set.id)
      setSets(prev => prev.filter(s => s.id !== set.id))
      if (selectedSetId === set.id) { setSelectedSetId(null); setItems([]) }
      toast.success('Set deleted ✅')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────────
  const persistItems = async (list) => {
    if (!selectedSetId) {
      toast.error('No topic set selected. Please select a set first.')
      return false
    }
    setSavingItems(true)
    setItemsError('')
    try {
      const res = await saveTopicSetItems(selectedSetId, list.map(t => ({
        title: t.title,
        description: t.description || null,
        duration_hours: parseFloat(t.duration_hours) || 1,
        mode: t.mode || 'offline',
      })))
      const saved = res.data.items || list
      setItems(saved)
      // Update item count in set list
      setSets(prev => prev.map(s =>
        s.id === selectedSetId ? { ...s, item_count: saved.length } : s
      ))
      return true
    } catch (err) {
      const msg = friendlyError(err)
      setItemsError(msg)
      toast.error(msg)
      return false
    } finally {
      setSavingItems(false)
    }
  }

  const handleAddTopic = async (form) => {
    const ok = await persistItems([...items, form])
    if (ok) {
      setShowAddTopic(false)
      toast.success('Topic added ✅')
    }
  }

  const handleEditTopic = async (idx, form) => {
    const ok = await persistItems(items.map((t, i) => i === idx ? { ...t, ...form } : t))
    if (ok) {
      setEditingTopicIdx(null)
      toast.success('Topic updated ✅')
    }
  }

  const handleDeleteTopic = async (idx) => {
    if (!window.confirm('Remove this topic?')) return
    const ok = await persistItems(items.filter((_, i) => i !== idx))
    if (ok) toast.success('Topic removed ✅')
  }

  const handleMoveUp = async (idx) => {
    if (idx === 0) return
    const list = [...items]
    ;[list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]
    await persistItems(list)
  }

  const handleMoveDown = async (idx) => {
    if (idx === items.length - 1) return
    const list = [...items]
    ;[list[idx], list[idx + 1]] = [list[idx + 1], list[idx]]
    await persistItems(list)
  }

  const selectedSet = sets.find(s => s.id === selectedSetId)
  const totalHours  = items.reduce((sum, t) => sum + (parseFloat(t.duration_hours) || 1), 0)

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B3A6B] flex items-center justify-center">
            <Library size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Topics Library</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {isOwner ? 'View all trainer topic sets' : 'Create and manage reusable topic sets for your batches'}
            </p>
          </div>
        </div>
        {!isOwner && (
          <button
            onClick={() => {
              // Lazy-import SmartPlanner only when opened
              setPlannerOpen(true)
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm shadow-primary/30"
          >
            <Shuffle size={15} /> Smart Planner
          </button>
        )}
      </div>

      {/* Top-level sets error */}
      <ErrorBanner message={setsError} onRetry={loadSets} />

      <div className="flex gap-5 items-start">

        {/* ── LEFT: Set list ───────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-2">

          {/* Create set button */}
          {!isOwner && !creatingSet && (
            <button
              onClick={() => { setCreatingSet(true); setSetFormError('') }}
              className="flex items-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-slate-200 hover:border-primary text-slate-400 hover:text-primary rounded-xl text-sm font-medium transition"
            >
              <Plus size={15} /> New Topic Set
            </button>
          )}

          {/* Create set form */}
          {creatingSet && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
              <p className="text-xs font-semibold text-slate-600">New Topic Set</p>
              <input
                autoFocus
                value={newSetName}
                onChange={e => { setNewSetName(e.target.value); setSetFormError('') }}
                onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                placeholder="Set name *"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <input
                value={newSetDesc}
                onChange={e => setNewSetDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {setFormError && <p className="text-xs text-rose-600">⚠ {setFormError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSet}
                  disabled={savingSet}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50 transition"
                >
                  {savingSet ? 'Creating...' : 'Create Set'}
                </button>
                <button
                  onClick={() => { setCreatingSet(false); setNewSetName(''); setNewSetDesc(''); setSetFormError('') }}
                  className="text-xs text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100"
                >Cancel</button>
              </div>
            </div>
          )}

          {/* Set list */}
          {loadingSets ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading sets…
            </div>
          ) : sets.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <Library size={28} className="mx-auto mb-2 text-slate-300" />
              {isOwner ? 'No topic sets created yet' : 'No sets yet — create your first one above'}
            </div>
          ) : (
            sets.map(set => (
              <div key={set.id}>
                {editingSetId === set.id && !isOwner ? (
                  <SetNameEditor
                    set={set}
                    onSave={(n, d) => handleRenameSet(set.id, n, d)}
                    onCancel={() => setEditingSetId(null)}
                  />
                ) : (
                  <button
                    onClick={() => setSelectedSetId(set.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition group ${
                      selectedSetId === set.id
                        ? 'bg-[#1B3A6B] border-[#1B3A6B]'
                        : 'bg-white border-slate-200 hover:border-[#1B3A6B]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold text-sm truncate ${selectedSetId === set.id ? 'text-white' : 'text-slate-800'}`}>
                          {set.name}
                        </p>
                        {set.trainer_name && (
                          <p className={`text-xs mt-0.5 ${selectedSetId === set.id ? 'text-blue-200' : 'text-slate-400'}`}>
                            by {set.trainer_name}
                          </p>
                        )}
                        <p className={`text-xs mt-0.5 ${selectedSetId === set.id ? 'text-blue-200' : 'text-slate-400'}`}>
                          {set.item_count ?? 0} topic{(set.item_count ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {!isOwner && (
                        <div className={`flex gap-0.5 opacity-0 group-hover:opacity-100 transition`}>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingSetId(set.id) }}
                            className={`p-1 rounded ${selectedSetId === set.id ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-100 text-slate-400'}`}
                          ><Edit2 size={11} /></button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSet(set) }}
                            className={`p-1 rounded ${selectedSetId === set.id ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'}`}
                          ><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT: Topics table ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {!selectedSetId ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <BookOpen size={36} className="mb-3 text-slate-300" />
              <p className="text-sm font-medium">Select a topic set on the left</p>
              {!isOwner && <p className="text-xs text-slate-400 mt-1">or create a new set to get started</p>}
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800 text-base">{selectedSet?.name}</h2>
                  {selectedSet?.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedSet.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {items.length} topic{items.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)} hrs total
                  </p>
                </div>
                {!isOwner && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlannerOpen(true)}
                      className="flex items-center gap-1.5 bg-[#1B3A6B] hover:bg-[#163058] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                    >
                      <Shuffle size={12} /> Plan Batch
                    </button>
                    <button
                      onClick={() => { setShowAddTopic(v => !v); setEditingTopicIdx(null) }}
                      className={`flex items-center gap-1.5 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition ${showAddTopic ? 'bg-slate-400 hover:bg-slate-500' : 'bg-primary hover:bg-primary-dark'}`}
                    >
                      {showAddTopic ? <X size={12} /> : <Plus size={12} />}
                      {showAddTopic ? 'Cancel' : 'Add Topic'}
                    </button>
                  </div>
                )}
              </div>

              {/* Items error */}
              {itemsError && (
                <div className="px-6 pt-4">
                  <ErrorBanner message={itemsError} onRetry={() => loadItems(selectedSetId)} />
                </div>
              )}

              {/* Loading items */}
              {loadingItems ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Loading topics…
                </div>
              ) : (
                <>
                  {/* Add topic form */}
                  {showAddTopic && !isOwner && (
                    <TopicForm
                      onSave={handleAddTopic}
                      onCancel={() => setShowAddTopic(false)}
                      saving={savingItems}
                    />
                  )}

                  {/* Table header */}
                  {items.length > 0 && (
                    <div className="grid grid-cols-[36px_32px_1fr_1fr_70px_90px_60px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>#</span>
                      <span></span>
                      <span>Title</span>
                      <span>Description</span>
                      <span>Hrs</span>
                      <span>Mode</span>
                      <span className="text-right">Actions</span>
                    </div>
                  )}

                  {/* Topics list */}
                  {items.length === 0 && !showAddTopic ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-slate-500 text-sm font-medium">No topics yet</p>
                      {!isOwner && (
                        <button
                          onClick={() => setShowAddTopic(true)}
                          className="mt-3 flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary-dark transition"
                        >
                          <Plus size={13} /> Add your first topic
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <div key={item.id ?? idx}>
                          {editingTopicIdx === idx && !isOwner ? (
                            <TopicForm
                              initial={item}
                              onSave={form => handleEditTopic(idx, form)}
                              onCancel={() => setEditingTopicIdx(null)}
                              saving={savingItems}
                            />
                          ) : (
                            <div className="grid grid-cols-[36px_32px_1fr_1fr_70px_90px_60px] gap-2 items-center px-4 py-3 hover:bg-slate-50/60 transition">
                              <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                              {!isOwner ? (
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    onClick={() => handleMoveUp(idx)}
                                    disabled={idx === 0 || savingItems}
                                    className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"
                                  ><ArrowUp size={13} /></button>
                                  <button
                                    onClick={() => handleMoveDown(idx)}
                                    disabled={idx === items.length - 1 || savingItems}
                                    className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"
                                  ><ArrowDown size={13} /></button>
                                </div>
                              ) : <span />}
                              <p className="font-semibold text-slate-800 text-sm truncate">{item.title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.description || '—'}</p>
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <Clock size={11} className="text-slate-400" />
                                {item.duration_hours || 1}h
                              </p>
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                item.mode === 'online'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.mode === 'online' ? <Wifi size={9} /> : <Building2 size={9} />}
                                {item.mode === 'online' ? 'Online' : 'Offline'}
                              </span>
                              {!isOwner && (
                                <div className="flex items-center justify-end gap-0.5">
                                  <button
                                    onClick={() => { setEditingTopicIdx(idx); setShowAddTopic(false) }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                  ><Edit2 size={12} /></button>
                                  <button
                                    onClick={() => handleDeleteTopic(idx)}
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                                  ><Trash2 size={12} /></button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary footer */}
                  {items.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><CheckCircle size={11} className="text-emerald-500" /> {items.length} topics</span>
                      <span>·</span>
                      <span>{totalHours.toFixed(1)} hrs total</span>
                      <span>·</span>
                      <span>{items.filter(t => t.mode === 'online').length} online</span>
                      <span>{items.filter(t => t.mode === 'offline').length} offline</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Smart Planner — loaded lazily */}
      {plannerOpen && <PlannerWrapper onClose={() => setPlannerOpen(false)} />}
    </div>
  )
}

// Lazily wrap SmartPlanner to avoid crashing the whole page if it has issues
function PlannerWrapper({ onClose }) {
  const SmartPlanner = React.lazy(() => import('../components/SmartPlanner.jsx'))
  return (
    <React.Suspense fallback={null}>
      <SmartPlanner
        onClose={onClose}
        onSuccess={() => toast.success('Topics distributed to calendar ✅')}
      />
    </React.Suspense>
  )
}

// Inline set name editor (defined here so it has access to nothing complex)
function SetNameEditor({ set, onSave, onCancel }) {
  const [name, setName] = useState(set.name)
  const [desc, setDesc] = useState(set.description || '')
  return (
    <div className="bg-white border border-primary rounded-xl p-3 space-y-2 shadow-sm">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSave(name, desc)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        placeholder="Set name"
      />
      <input
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        placeholder="Description (optional)"
      />
      <div className="flex gap-2">
        <button onClick={() => onSave(name, desc)} className="flex items-center gap-1 text-xs bg-primary text-white font-semibold px-3 py-1.5 rounded-lg">
          <Save size={11} /> Save
        </button>
        <button onClick={onCancel} className="text-xs text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
      </div>
    </div>
  )
}
