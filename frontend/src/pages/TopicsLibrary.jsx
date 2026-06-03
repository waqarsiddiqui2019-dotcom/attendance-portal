import React, { useEffect, useState, useCallback } from 'react'
import {
  Library, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Shuffle,
  BookOpen, Loader2, X, Save, Wifi, Building2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getTopicSets, createTopicSet, updateTopicSet, deleteTopicSet,
  getTopicSetItems, saveTopicSetItems,
} from '../api/index.js'
import SmartPlanner from '../components/SmartPlanner.jsx'

// ── Mode badge ────────────────────────────────────────────────────────────────
function ModeBadge({ mode }) {
  return mode === 'online'
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-blue-light text-brand-blue"><Wifi size={10} /> Online</span>
    : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"><Building2 size={10} /> Offline</span>
}

// ── Inline set name editor ─────────────────────────────────────────────────────
function SetNameEditor({ set, onSave, onCancel }) {
  const [name, setName] = useState(set.name)
  const [desc, setDesc] = useState(set.description || '')
  return (
    <div className="space-y-2 p-3">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Set name" />
      <input value={desc} onChange={e => setDesc(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Description (optional)" />
      <div className="flex gap-2">
        <button onClick={() => onSave(name, desc)} className="flex items-center gap-1 text-xs bg-primary text-white font-semibold px-3 py-1.5 rounded-lg"><Save size={11} /> Save</button>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100">Cancel</button>
      </div>
    </div>
  )
}

// ── Item form row (add / edit) ─────────────────────────────────────────────────
function ItemFormRow({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { title: '', description: '', duration_hours: 1, mode: 'offline' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="grid grid-cols-[1fr_1fr_80px_90px_80px] gap-2 p-3 bg-slate-50 border-b border-slate-100 items-end">
      <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
        placeholder="Topic title *"
        className="px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      <input value={form.description} onChange={e => set('description', e.target.value)}
        placeholder="Description"
        className="px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      <input type="number" step="0.5" min="0.5" value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)}
        className="px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      <select value={form.mode} onChange={e => set('mode', e.target.value)}
        className="px-2.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
        <option value="offline">🏫 Offline</option>
        <option value="online">💻 Online</option>
      </select>
      <div className="flex gap-1">
        <button onClick={() => { if (!form.title.trim()) { toast.error('Title required'); return } onSave(form) }}
          disabled={saving}
          className="flex items-center gap-1 bg-primary text-white text-xs font-semibold px-2.5 py-2 rounded-lg disabled:opacity-50 transition">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 px-1.5 py-2 rounded-lg hover:bg-slate-100 transition"><X size={13} /></button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TopicsLibrary() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  const [sets, setSets] = useState([])
  const [loadingSets, setLoadingSets] = useState(true)
  const [selectedSetId, setSelectedSetId] = useState(null)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  // Set CRUD state
  const [creatingSet, setCreatingSet] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const [newSetDesc, setNewSetDesc] = useState('')
  const [editingSetId, setEditingSetId] = useState(null)
  const [savingSet, setSavingSet] = useState(false)

  // Item state
  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItemIdx, setEditingItemIdx] = useState(null)
  const [savingItems, setSavingItems] = useState(false)

  // Planner
  const [plannerOpen, setPlannerOpen] = useState(false)

  const fetchSets = useCallback(() => {
    setLoadingSets(true)
    getTopicSets()
      .then(res => { setSets(res.data.sets || []); })
      .catch(() => toast.error('Failed to load topic sets'))
      .finally(() => setLoadingSets(false))
  }, [])

  const fetchItems = useCallback((setId) => {
    if (!setId) return
    setLoadingItems(true)
    getTopicSetItems(setId)
      .then(res => setItems(res.data.items || []))
      .catch(() => toast.error('Failed to load topics'))
      .finally(() => setLoadingItems(false))
  }, [])

  useEffect(() => { fetchSets() }, [fetchSets])
  useEffect(() => { if (selectedSetId) fetchItems(selectedSetId) }, [selectedSetId, fetchItems])

  const saveItems = async (list) => {
    if (!selectedSetId) return
    setSavingItems(true)
    try {
      const res = await saveTopicSetItems(selectedSetId, list)
      setItems(res.data.items || list)
    } catch { toast.error('Failed to save topics') }
    finally { setSavingItems(false) }
  }

  // ── Set handlers ──────────────────────────────────────────────────────────
  const handleCreateSet = async () => {
    if (!newSetName.trim()) { toast.error('Set name required'); return }
    setSavingSet(true)
    try {
      const res = await createTopicSet({ name: newSetName, description: newSetDesc })
      const newSet = res.data.set
      setSets(prev => [newSet, ...prev])
      setSelectedSetId(newSet.id)
      setItems([])
      setCreatingSet(false)
      setNewSetName(''); setNewSetDesc('')
      toast.success('Topic set created!')
    } catch { toast.error('Failed to create set') }
    finally { setSavingSet(false) }
  }

  const handleRenameSet = async (id, name, description) => {
    if (!name.trim()) return
    try {
      const res = await updateTopicSet(id, { name, description })
      setSets(prev => prev.map(s => s.id === id ? { ...s, ...res.data.set } : s))
      setEditingSetId(null)
    } catch { toast.error('Failed to rename set') }
  }

  const handleDeleteSet = async (set) => {
    if (!window.confirm(`Delete "${set.name}" and all its topics?`)) return
    try {
      await deleteTopicSet(set.id)
      setSets(prev => prev.filter(s => s.id !== set.id))
      if (selectedSetId === set.id) { setSelectedSetId(null); setItems([]) }
      toast.success('Set deleted')
    } catch { toast.error('Failed to delete set') }
  }

  // ── Item handlers ─────────────────────────────────────────────────────────
  const handleAddItem = async (form) => {
    const newList = [...items, form]
    setShowAddItem(false)
    await saveItems(newList)
  }

  const handleEditItem = async (idx, form) => {
    const newList = items.map((t, i) => i === idx ? { ...t, ...form } : t)
    setEditingItemIdx(null)
    await saveItems(newList)
  }

  const handleDeleteItem = async (idx) => {
    if (!window.confirm('Remove this topic?')) return
    await saveItems(items.filter((_, i) => i !== idx))
  }

  const handleMoveUp = async (idx) => {
    if (idx === 0) return
    const list = [...items];
    [list[idx-1], list[idx]] = [list[idx], list[idx-1]]
    await saveItems(list)
  }

  const handleMoveDown = async (idx) => {
    if (idx === items.length - 1) return
    const list = [...items];
    [list[idx], list[idx+1]] = [list[idx+1], list[idx]]
    await saveItems(list)
  }

  const selectedSet = sets.find(s => s.id === selectedSetId)
  const totalHours = items.reduce((s, t) => s + (parseFloat(t.duration_hours) || 1), 0)

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B3A6B] flex items-center justify-center">
            <Library size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Topics Library</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {isOwner ? 'View topic sets across all trainers' : 'Create reusable topic sets for your batches'}
            </p>
          </div>
        </div>
        {!isOwner && (
          <button onClick={() => setPlannerOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm shadow-primary/30">
            <Shuffle size={15} /> Smart Planner
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* ── Left: Set List ─────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {!isOwner && (
            <button onClick={() => setCreatingSet(true)}
              className="flex items-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-slate-200 hover:border-primary text-slate-400 hover:text-primary rounded-xl text-sm font-medium transition">
              <Plus size={15} /> New Topic Set
            </button>
          )}

          {/* Create set form */}
          {creatingSet && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <input autoFocus value={newSetName} onChange={e => setNewSetName(e.target.value)}
                placeholder="Set name *"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <input value={newSetDesc} onChange={e => setNewSetDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <div className="flex gap-2">
                <button onClick={handleCreateSet} disabled={savingSet}
                  className="flex-1 bg-primary text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50">
                  {savingSet ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => { setCreatingSet(false); setNewSetName(''); setNewSetDesc('') }}
                  className="text-xs text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100">Cancel</button>
              </div>
            </div>
          )}

          {loadingSets ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : sets.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <Library size={28} className="mx-auto mb-2 text-slate-300" />
              {isOwner ? 'No topic sets yet' : 'No sets yet — create your first one'}
            </div>
          ) : (
            sets.map(set => (
              <div key={set.id}>
                {editingSetId === set.id ? (
                  <div className="bg-white border border-primary rounded-xl">
                    <SetNameEditor set={set}
                      onSave={(n, d) => handleRenameSet(set.id, n, d)}
                      onCancel={() => setEditingSetId(null)} />
                  </div>
                ) : (
                  <button onClick={() => setSelectedSetId(set.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition group ${selectedSetId === set.id ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-slate-200 hover:border-[#1B3A6B]/40'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold text-sm truncate ${selectedSetId === set.id ? 'text-white' : 'text-slate-800'}`}>{set.name}</p>
                        {set.trainer_name && (
                          <p className={`text-xs mt-0.5 ${selectedSetId === set.id ? 'text-blue-200' : 'text-slate-400'}`}>by {set.trainer_name}</p>
                        )}
                        <p className={`text-xs mt-1 ${selectedSetId === set.id ? 'text-blue-200' : 'text-slate-400'}`}>{set.item_count || 0} topics</p>
                      </div>
                      {!isOwner && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={e => { e.stopPropagation(); setEditingSetId(set.id) }}
                            className={`p-1 rounded ${selectedSetId === set.id ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-100 text-slate-400'}`}>
                            <Edit2 size={12} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteSet(set) }}
                            className={`p-1 rounded ${selectedSetId === set.id ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'}`}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Right: Topics Table ────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden self-start">
          {!selectedSetId ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <BookOpen size={32} className="mb-3 text-slate-300" />
              <p className="text-sm font-medium">Select a topic set to view its topics</p>
            </div>
          ) : loadingItems ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : (
            <>
              {/* Set header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800">{selectedSet?.name}</h2>
                  {selectedSet?.description && <p className="text-xs text-slate-500 mt-0.5">{selectedSet.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {items.length} topics · {totalHours.toFixed(1)} hrs total
                  </p>
                </div>
                {!isOwner && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPlannerOpen(true)}
                      className="flex items-center gap-1.5 bg-[#1B3A6B] hover:bg-[#163058] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition">
                      <Shuffle size={12} /> Plan Batch
                    </button>
                    <button onClick={() => { setShowAddItem(true); setEditingItemIdx(null) }}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition">
                      <Plus size={12} /> Add Topic
                    </button>
                  </div>
                )}
              </div>

              {/* Column header */}
              <div className="grid grid-cols-[40px_40px_1fr_1fr_80px_100px_70px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>#</span><span></span><span>Title</span><span>Description</span>
                <span>Hours</span><span>Mode</span><span className="text-right">Actions</span>
              </div>

              {/* Add item form */}
              {showAddItem && (
                <ItemFormRow
                  onSave={handleAddItem}
                  onCancel={() => setShowAddItem(false)}
                  saving={savingItems}
                />
              )}

              {items.length === 0 && !showAddItem ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">No topics yet</p>
                  {!isOwner && <button onClick={() => setShowAddItem(true)} className="mt-3 text-xs text-primary font-medium hover:underline">+ Add your first topic</button>}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <div key={item.id || idx}>
                      {editingItemIdx === idx ? (
                        <ItemFormRow
                          initial={item}
                          onSave={form => handleEditItem(idx, form)}
                          onCancel={() => setEditingItemIdx(null)}
                          saving={savingItems}
                        />
                      ) : (
                        <div className="grid grid-cols-[40px_40px_1fr_1fr_80px_100px_70px] gap-2 items-center px-4 py-3 hover:bg-slate-50/50 transition">
                          <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                          {!isOwner ? (
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => handleMoveUp(idx)} disabled={idx === 0 || savingItems}
                                className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"><ArrowUp size={13} /></button>
                              <button onClick={() => handleMoveDown(idx)} disabled={idx === items.length - 1 || savingItems}
                                className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"><ArrowDown size={13} /></button>
                            </div>
                          ) : <span />}
                          <p className="font-semibold text-slate-800 text-sm truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 truncate">{item.description || '—'}</p>
                          <p className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />{item.duration_hours || 1}h
                          </p>
                          <ModeBadge mode={item.mode} />
                          {!isOwner && (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setEditingItemIdx(idx); setShowAddItem(false) }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleDeleteItem(idx)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                                <Trash2 size={13} />
                              </button>
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
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                  <span>{items.length} topics</span>
                  <span>·</span>
                  <span>{totalHours.toFixed(1)} hrs total</span>
                  <span>·</span>
                  <span>{items.filter(t => t.mode === 'online').length} online / {items.filter(t => t.mode === 'offline').length} offline</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {plannerOpen && (
        <SmartPlanner
          onClose={() => setPlannerOpen(false)}
          onSuccess={() => toast.success('Distribution complete!')}
        />
      )}
    </div>
  )
}
