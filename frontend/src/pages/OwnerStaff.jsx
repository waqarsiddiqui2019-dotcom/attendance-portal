import React, { useEffect, useState, useCallback } from 'react'
import { Shield, Plus, Trash2, Edit3, Loader2, CheckCircle, X, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOwnerStaff, createStaff, updateStaffPermissions, deleteStaff } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

const PERM_LABELS = {
  can_manage_trainers:    'Manage Trainers (approve/reject/delete)',
  can_manage_students:    'Manage Students',
  can_manage_batches:     'Manage Batches',
  can_view_reports:       'View Reports & Calendars',
  can_approve_leaves:     'Approve Emergency Leaves',
  can_message_all:        'Message Anyone',
  can_admit_students:     'Admit Students (access admission form)',
  can_reassign_students:  'Reassign Students (change batch or trainer)',
  can_send_announcements: 'Send Announcements to all users',
  can_view_financials:    'View Financials (fee management)',
  can_manage_daily_log:   'Manage Daily Activity Log',
}

const PERM_GROUPS = [
  { label: 'Core Access', keys: ['can_manage_trainers','can_manage_students','can_manage_batches','can_view_reports','can_approve_leaves','can_message_all'] },
  { label: 'Extended Access', keys: ['can_admit_students','can_reassign_students','can_send_announcements','can_view_financials','can_manage_daily_log'] },
]

const ROLE_CONFIG = {
  co_owner: { label: 'Co-Owner', color: 'bg-purple-100 text-purple-700', desc: 'Full access with selected permissions' },
  admin:    { label: 'Admin',    color: 'bg-slate-100 text-slate-700',   desc: 'Limited operational access' },
}

const DEFAULT_PERMS = {
  can_manage_trainers:    false,
  can_manage_students:    false,
  can_manage_batches:     false,
  can_view_reports:       true,
  can_approve_leaves:     false,
  can_message_all:        true,
  can_admit_students:     false,
  can_reassign_students:  false,
  can_send_announcements: false,
  can_view_financials:    false,
  can_manage_daily_log:   false,
}

function PermToggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300'}`}>
      <span className="text-sm text-slate-700">{label}</span>
      <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300'} ${disabled ? '' : ''}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  )
}

export default function OwnerStaff() {
  const { user } = useAuth()
  const [staff, setStaff]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [editPerms, setEditPerms] = useState({})
  const [saving, setSaving]       = useState(false)
  const [showPwd, setShowPwd]     = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'co_owner', permissions: { ...DEFAULT_PERMS },
  })

  const isRootOwner = user?.role === 'owner'

  const load = useCallback(() => {
    setLoading(true)
    getOwnerStaff()
      .then(r => setStaff(r.data.staff || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error('Name, email and password are required')
      return
    }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      await createStaff({ ...form })
      toast.success(`${ROLE_CONFIG[form.role].label} account created ✅`)
      setShowForm(false)
      setForm({ name: '', email: '', password: '', role: 'co_owner', permissions: { ...DEFAULT_PERMS } })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create staff account')
    } finally { setSaving(false) }
  }

  const handlePermSave = async (id) => {
    setSaving(true)
    try {
      await updateStaffPermissions(id, editPerms)
      toast.success('Permissions updated ✅')
      setEditId(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update permissions')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove ${name} from staff? This cannot be undone.`)) return
    try {
      await deleteStaff(id)
      toast.success('Staff member removed')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove')
    }
  }

  if (!isRootOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Shield size={36} className="mb-3 text-slate-300" />
        <p className="text-sm">Only the root owner can manage staff roles</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Staff Roles</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage co-owner and admin accounts with custom permissions</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-[#1B3A6B] hover:bg-[#2272B9] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Staff'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-slate-700 text-sm">Create Staff Account</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Staff member name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="staff@domain.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30" />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2272B9]/30" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-2 bottom-2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role *</label>
              <div className="flex gap-2">
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <button key={key} type="button"
                    onClick={() => setForm(p => ({ ...p, role: key }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${form.role === key ? `${cfg.color} border-current` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{ROLE_CONFIG[form.role].desc}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">Permissions</p>
            <div className="space-y-4">
              {PERM_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {group.keys.map(key => (
                      <PermToggle key={key} label={PERM_LABELS[key]}
                        checked={form.permissions[key] || false}
                        onChange={() => setForm(p => ({ ...p, permissions: { ...p.permissions, [key]: !p.permissions[key] } }))} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Create Account
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <Shield size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No staff accounts yet</p>
          <p className="text-xs text-slate-400 mt-1">Create co-owner or admin accounts to delegate access</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => {
            const cfg = ROLE_CONFIG[s.role] || ROLE_CONFIG.admin
            const isEditing = editId === s.id
            return (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                      {s.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-slate-500">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditId(isEditing ? null : s.id); setEditPerms({ ...s }) }}
                      className="p-2 text-slate-400 hover:text-[#2272B9] hover:bg-blue-50 rounded-lg transition">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDelete(s.id, s.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {!isEditing ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(PERM_LABELS).map(([key, label]) => (
                      <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${s[key] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s[key] ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {label}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 mt-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Edit Permissions</p>
                    {PERM_GROUPS.map(group => (
                      <div key={group.label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{group.label}</p>
                        <div className="space-y-1.5">
                          {group.keys.map(key => (
                            <PermToggle key={key} label={PERM_LABELS[key]}
                              checked={editPerms[key] || false}
                              onChange={() => setEditPerms(p => ({ ...p, [key]: !p[key] }))} />
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 justify-end mt-3">
                      <button onClick={() => setEditId(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
                      <button onClick={() => handlePermSave(s.id)} disabled={saving}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
