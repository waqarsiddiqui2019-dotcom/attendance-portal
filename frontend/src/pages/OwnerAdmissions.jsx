import React, { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Plus, X, ChevronRight, ChevronLeft, CheckCircle, Search, Eye, Upload, User, BookOpen, Phone, MapPin, GraduationCap, FileText, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdmissions, createAdmission, getBatches, getOwnerTrainers, getTopicSets, reassignStudent, getActiveBatchesWithTrainers } from '../api/index.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']

const STEPS = [
  { label: 'Personal Info',        icon: User },
  { label: 'Address & Education',  icon: GraduationCap },
  { label: 'Course Details',       icon: BookOpen },
  { label: 'Contact & Docs',       icon: FileText },
  { label: 'Review & Submit',      icon: CheckCircle },
]

const EMPTY_FORM = {
  // A
  name:'', email:'', phone:'', whatsapp:'', same_whatsapp: false, dob:'', gender:'',
  // B
  city:'', state:'', pin_code:'',
  // C
  highest_qualification:'', field_of_study:'', college_name:'', year_of_passing:'',
  // D
  batch_id:'', preferred_mode:'no_preference', trainer_id:'', password:'', confirm_password:'',
  // E
  emergency_contact_name:'', emergency_contact_relation:'', emergency_contact_phone:'',
  // F
  heard_about_us:'', prior_knowledge:'none', special_requirements:'',
  // G (docs stored as {name, data})
  id_proof: null, edu_cert: null, other_doc: null,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, required, children, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  )
}

function Input({ className = '', ...props }) {
  return <input className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white ${className}`} {...props} />
}

function Select({ className = '', children, ...props }) {
  return (
    <select className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white ${className}`} {...props}>
      {children}
    </select>
  )
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '?'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ admission, onClose }) {
  const rows = [
    ['Phone',                     admission.phone],
    ['WhatsApp',                  admission.whatsapp],
    ['Date of Birth',             fmtDate(admission.dob)],
    ['Gender',                    admission.gender],
    ['City',                      admission.city],
    ['State',                     admission.state],
    ['PIN Code',                  admission.pin_code],
    ['Highest Qualification',     admission.highest_qualification],
    ['Field of Study',            admission.field_of_study],
    ['College/University',        admission.college_name],
    ['Year of Passing',           admission.year_of_passing],
    ['Preferred Mode',            admission.preferred_mode?.replace(/_/g,' ')],
    ['Batch',                     admission.batch_name],
    ['Trainer',                   admission.trainer_name],
    ['Emergency Contact',         admission.emergency_contact_name],
    ['Relation',                  admission.emergency_contact_relation],
    ['Emergency Phone',           admission.emergency_contact_phone],
    ['How Heard',                 admission.heard_about_us?.replace(/_/g,' ')],
    ['Prior Knowledge',           admission.prior_knowledge],
    ['Special Requirements',      admission.special_requirements],
    ['ID Proof',                  admission.id_proof_name],
    ['Education Certificate',     admission.edu_cert_name],
    ['Other Document',            admission.other_doc_name],
  ].filter(([,v]) => v)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" style={{background:'#1B3A6B',color:'#F5A623'}}>
              {initials(admission.name)}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{admission.name}</h3>
              <p className="text-xs text-slate-500">{admission.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            {rows.map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-slate-700 capitalize">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">Admitted on {fmtDate(admission.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Allocate / Reassign Batch Modal ──────────────────────────────────────────

function AllocateBatchModal({ student, onClose, onSuccess }) {
  const [batches, setBatches]  = useState([])
  const [form,    setForm]     = useState({
    new_batch_id: '', new_trainer_id: '', reason: '',
    effective_date: new Date().toISOString().slice(0,10), keep_attendance: true,
  })
  const [loading, setLoading] = useState(false)
  const isReassign = !!student.batch_id

  useEffect(() => {
    getActiveBatchesWithTrainers().then(r => setBatches(r.data.batches || [])).catch(() => {})
  }, [])

  const selectedBatch = batches.find(b => String(b.id) === String(form.new_batch_id))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (selectedBatch) set('new_trainer_id', String(selectedBatch.trainer_id))
  }, [form.new_batch_id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.new_batch_id) { toast.error('Please select a batch'); return }
    if (isReassign && !form.reason.trim()) { toast.error('Please enter a reason for reassignment'); return }
    setLoading(true)
    try {
      await reassignStudent(student.id, {
        new_batch_id:    Number(form.new_batch_id),
        new_trainer_id:  form.new_trainer_id ? Number(form.new_trainer_id) : null,
        reason:          form.reason.trim() || 'Initial batch allocation from admissions',
        effective_date:  form.effective_date,
        keep_attendance: form.keep_attendance,
      })
      toast.success(`${student.name} ${isReassign ? 'reassigned' : 'allocated'} successfully`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate batch')
    } finally { setLoading(false) }
  }

  const uniqueTrainers = [...new Map(batches.filter(b => b.trainer_id).map(b => [b.trainer_id, b.trainer_name])).entries()]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'#E8F2FC'}}>
            <RefreshCw className="w-5 h-5" style={{color:'#2272B9'}} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{isReassign ? 'Change Batch' : 'Assign to Batch'}</h3>
            <p className="text-xs text-slate-500">
              {student.name}
              {isReassign ? <> · Currently in <strong>{student.batch_name}</strong></> : ' · Not yet assigned to a batch'}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Select Batch *</label>
            <select value={form.new_batch_id} onChange={e => set('new_batch_id', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
              <option value="">Choose a batch…</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Trainer</label>
            <select value={form.new_trainer_id} onChange={e => set('new_trainer_id', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
              <option value="">Auto (from batch)</option>
              {uniqueTrainers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          {isReassign && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Reason for Change *</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
                placeholder="Why is the student being moved?"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Effective Date</label>
            <input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          {isReassign && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={form.keep_attendance} onChange={e => set('keep_attendance', e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-700">Keep existing attendance records</span>
            </label>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition mt-1">
            {loading ? 'Saving…' : isReassign ? 'Confirm Reassignment' : 'Assign to Batch'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Admissions List ───────────────────────────────────────────────────────────

function AdmissionsList() {
  const [admissions,      setAdmissions]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [search,          setSearch]          = useState('')
  const [batchFilter,     setBatchFilter]      = useState('')
  const [detail,          setDetail]          = useState(null)
  const [allocateStudent, setAllocateStudent] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdmissions()
      .then(r => setAdmissions(r.data.admissions || []))
      .catch(() => toast.error('Failed to load admissions'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const batches = [...new Map(admissions.filter(a => a.batch_id).map(a => [a.batch_id, a.batch_name])).entries()]

  const filtered = admissions.filter(a => {
    const q = search.toLowerCase()
    if (q && !a.name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false
    if (batchFilter && String(a.batch_id) !== batchFilter) return false
    return true
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap gap-3 items-center p-4 border-b border-slate-100">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <Select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="w-auto">
          <option value="">All Batches</option>
          {batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="divide-y divide-slate-100">{[...Array(5)].map((_,i) => <div key={i} className="h-14 m-3 bg-slate-50 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No admissions found</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              {['Student','Email','Batch','Trainer','Mode','Admitted','Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{background:'#1B3A6B',color:'#F5A623'}}>
                      {initials(a.name)}
                    </div>
                    <span className="font-medium text-slate-800 truncate max-w-[120px]">{a.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[140px]">{a.email}</td>
                <td className="px-4 py-3 text-slate-600">{a.batch_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{a.trainer_name || '—'}</td>
                <td className="px-4 py-3 text-slate-500 capitalize text-xs">{a.preferred_mode?.replace(/_/g,' ') || '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(a.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setAllocateStudent(a)}
                      title={a.batch_id ? 'Change Batch' : 'Assign to Batch'}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${a.batch_id ? 'text-[#2272B9] bg-blue-50 hover:bg-blue-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}>
                      <RefreshCw size={12} />
                      {a.batch_id ? 'Reassign' : 'Assign'}
                    </button>
                    <button onClick={() => setDetail(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition">
                      <Eye size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {detail && <DetailModal admission={detail} onClose={() => setDetail(null)} />}
      {allocateStudent && (
        <AllocateBatchModal
          student={allocateStudent}
          onClose={() => setAllocateStudent(null)}
          onSuccess={load}
        />
      )}
    </div>
  )
}

// ── Multi-Step Form ───────────────────────────────────────────────────────────

function AdmissionForm({ onSuccess }) {
  const [step,    setStep]    = useState(0)
  const [form,    setForm]    = useState({ ...EMPTY_FORM })
  const [errors,  setErrors]  = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [batches,  setBatches]  = useState([])
  const [trainers, setTrainers] = useState([])
  const [courses,  setCourses]  = useState([])
  const [showPw,   setShowPw]   = useState(false)

  useEffect(() => {
    getBatches().then(r => setBatches((r.data.batches || r.data || []).filter(b => (b.status || 'active') === 'active'))).catch(() => {})
    getOwnerTrainers().then(r => setTrainers((r.data.trainers || []).filter(t => t.status === 'active'))).catch(() => {})
    getTopicSets().then(r => setCourses(r.data.sets || r.data || [])).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setE = (k) => (e) => set(k, e.target.value)

  const validate = (s) => {
    const errs = {}
    if (s === 0) {
      if (!form.name.trim())  errs.name  = 'Full name is required'
      if (!form.email.trim()) errs.email = 'Email is required'
      else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email'
      if (!form.phone.trim()) errs.phone = 'Phone number is required'
      if (!form.dob)          errs.dob   = 'Date of birth is required'
      if (!form.gender)       errs.gender = 'Please select gender'
    }
    if (s === 1) {
      if (!form.city.trim())          errs.city     = 'City is required'
      if (!form.state)                errs.state    = 'State is required'
      if (!form.pin_code.trim())      errs.pin_code = 'PIN code is required'
      else if (!/^\d{6}$/.test(form.pin_code.trim())) errs.pin_code = 'PIN code must be 6 digits'
    }
    if (s === 2) {
      if (!form.password)             errs.password  = 'Password is required'
      else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
      if (!form.confirm_password)         errs.confirm_password = 'Please confirm password'
      else if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match'
    }
    if (s === 3) {
      if (!form.emergency_contact_name.trim())  errs.emergency_contact_name  = 'Contact name is required'
      if (!form.emergency_contact_phone.trim()) errs.emergency_contact_phone = 'Contact phone is required'
      if (!form.emergency_contact_relation)     errs.emergency_contact_relation = 'Please select relationship'
    }
    return errs
  }

  const nextStep = () => {
    const errs = validate(step)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 0)) }

  const handleFileUpload = async (field, e) => {
    const file = e.target.files[0]
    if (!file) return
    const maxMb = field === 'id_proof' || field === 'edu_cert' || field === 'other_doc' ? 5 : 2
    if (file.size > maxMb * 1024 * 1024) { toast.error(`File too large (max ${maxMb}MB)`); return }
    try {
      const data = await fileToBase64(file)
      set(field, { name: file.name, data })
    } catch { toast.error('Failed to read file') }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(),
        whatsapp: form.same_whatsapp ? form.phone.trim() : (form.whatsapp.trim() || null),
        dob: form.dob, gender: form.gender,
        profile_photo: null,
        city: form.city.trim(), state: form.state, pin_code: form.pin_code.trim(),
        highest_qualification: form.highest_qualification, field_of_study: form.field_of_study.trim() || null,
        college_name: form.college_name.trim() || null, year_of_passing: form.year_of_passing || null,
        batch_id: form.batch_id ? Number(form.batch_id) : null,
        preferred_mode: form.preferred_mode, trainer_id: form.trainer_id ? Number(form.trainer_id) : null,
        password: form.password,
        emergency_contact_name: form.emergency_contact_name.trim(), emergency_contact_relation: form.emergency_contact_relation,
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        heard_about_us: form.heard_about_us, prior_knowledge: form.prior_knowledge,
        special_requirements: form.special_requirements.trim() || null,
        id_proof_name: form.id_proof?.name || null,   id_proof_data: form.id_proof?.data || null,
        edu_cert_name: form.edu_cert?.name || null,   edu_cert_data: form.edu_cert?.data || null,
        other_doc_name: form.other_doc?.name || null, other_doc_data: form.other_doc?.data || null,
      }
      const res = await createAdmission(payload)
      toast.success(`${form.name.trim()} admitted successfully! Student ID: ${res.data.student_id}`)
      setForm({ ...EMPTY_FORM })
      setStep(0)
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit admission')
    } finally { setSubmitting(false) }
  }

  const ReviewRow = ({ label, value }) => value ? (
    <div className="flex gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-700 font-medium flex-1 capitalize">{value}</span>
    </div>
  ) : null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Progress bar */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step, active = i === step
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${done ? 'bg-emerald-500' : active ? 'bg-primary' : 'bg-slate-200'}`}>
                  {done ? <CheckCircle className="w-4 h-4 text-white" /> : <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${active ? 'text-primary' : done ? 'text-emerald-600' : 'text-slate-400'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[360px]">

        {/* Step 0 — Personal Info */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required error={errors.name}>
                <Input value={form.name} onChange={setE('name')} placeholder="Enter full name" />
              </Field>
              <Field label="Email Address" required error={errors.email}>
                <Input type="email" value={form.email} onChange={setE('email')} placeholder="student@email.com" />
              </Field>
              <Field label="Phone Number" required error={errors.phone}>
                <Input type="tel" value={form.phone} onChange={setE('phone')} placeholder="+91 98765 43210" />
              </Field>
              <Field label="WhatsApp Number" error={errors.whatsapp}>
                <div className="space-y-2">
                  <Input type="tel" value={form.same_whatsapp ? form.phone : form.whatsapp} onChange={setE('whatsapp')} placeholder="Same as phone or different" disabled={form.same_whatsapp} className={form.same_whatsapp ? 'bg-slate-50 text-slate-400' : ''} />
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={form.same_whatsapp} onChange={e => set('same_whatsapp', e.target.checked)} className="rounded" />
                    Same as phone number
                  </label>
                </div>
              </Field>
              <Field label="Date of Birth" required error={errors.dob}>
                <Input type="date" value={form.dob} onChange={setE('dob')} max={new Date().toISOString().slice(0,10)} />
              </Field>
              <Field label="Gender" required error={errors.gender}>
                <Select value={form.gender} onChange={setE('gender')}>
                  <option value="">Select gender</option>
                  {['Male','Female','Other','Prefer not to say'].map(g => <option key={g}>{g}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 1 — Address + Education */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2"><MapPin size={14} /> Address</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="City" required error={errors.city}>
                  <Input value={form.city} onChange={setE('city')} placeholder="City" />
                </Field>
                <Field label="State" required error={errors.state}>
                  <Select value={form.state} onChange={setE('state')}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="PIN Code" required error={errors.pin_code}>
                  <Input value={form.pin_code} onChange={setE('pin_code')} placeholder="6-digit PIN" maxLength={6} />
                </Field>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2"><GraduationCap size={14} /> Educational Background</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Highest Qualification">
                  <Select value={form.highest_qualification} onChange={setE('highest_qualification')}>
                    <option value="">Select qualification</option>
                    {['10th','12th','Diploma','Graduate','Post Graduate','Other'].map(q => <option key={q}>{q}</option>)}
                  </Select>
                </Field>
                <Field label="Field of Study">
                  <Input value={form.field_of_study} onChange={setE('field_of_study')} placeholder="e.g. Computer Science" />
                </Field>
                <Field label="College / University Name">
                  <Input value={form.college_name} onChange={setE('college_name')} placeholder="Institution name" />
                </Field>
                <Field label="Year of Passing">
                  <Input type="number" value={form.year_of_passing} onChange={setE('year_of_passing')} placeholder="e.g. 2023" min="1990" max="2030" />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Course Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2"><BookOpen size={14} /> Course Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Course Interested In">
                <Select value={form.course_interest} onChange={setE('course_interest')}>
                  <option value="">Select course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Preferred Batch">
                <Select value={form.batch_id} onChange={setE('batch_id')}>
                  <option value="">Select batch (optional)</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Preferred Mode">
                <div className="flex gap-2 flex-wrap">
                  {[['no_preference','No Preference'],['online','Online'],['offline','Offline']].map(([val, lbl]) => (
                    <label key={val} className={`flex items-center gap-1.5 text-sm cursor-pointer px-3 py-2 rounded-xl border transition ${form.preferred_mode === val ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="radio" name="preferred_mode" value={val} checked={form.preferred_mode === val} onChange={() => set('preferred_mode', val)} className="sr-only" />
                      {lbl}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Assign Trainer">
                <Select value={form.trainer_id} onChange={setE('trainer_id')}>
                  <option value="">Select trainer (optional)</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Set Initial Password" required error={errors.password}>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={setE('password')} placeholder="Min 8 characters" className="pr-10" />
                  <button type="button" onClick={() => setShowPw(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{showPw ? 'Hide' : 'Show'}</button>
                </div>
              </Field>
              <Field label="Confirm Password" required error={errors.confirm_password}>
                <Input type="password" value={form.confirm_password} onChange={setE('confirm_password')} placeholder="Repeat password"
                  className={form.confirm_password && form.password !== form.confirm_password ? 'border-rose-300' : ''} />
              </Field>
            </div>
          </div>
        )}

        {/* Step 3 — Emergency Contact + Docs */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2"><Phone size={14} /> Emergency Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Contact Name" required error={errors.emergency_contact_name}>
                  <Input value={form.emergency_contact_name} onChange={setE('emergency_contact_name')} placeholder="Name" />
                </Field>
                <Field label="Relationship" required error={errors.emergency_contact_relation}>
                  <Select value={form.emergency_contact_relation} onChange={setE('emergency_contact_relation')}>
                    <option value="">Select</option>
                    {['Parent','Sibling','Spouse','Friend','Other'].map(r => <option key={r}>{r}</option>)}
                  </Select>
                </Field>
                <Field label="Contact Phone" required error={errors.emergency_contact_phone}>
                  <Input type="tel" value={form.emergency_contact_phone} onChange={setE('emergency_contact_phone')} placeholder="+91 98765 43210" />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Additional Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="How did you hear about us?">
                  <Select value={form.heard_about_us} onChange={setE('heard_about_us')}>
                    <option value="">Select</option>
                    {['Google Search','Social Media','Friend Referral','Newspaper','Walk-in','Other'].map(o => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
                <Field label="Prior Digital Marketing Knowledge">
                  <Select value={form.prior_knowledge} onChange={setE('prior_knowledge')}>
                    <option value="none">None</option>
                    <option value="basic">Basic</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Field label="Special Requirements or Notes">
                    <textarea value={form.special_requirements} onChange={setE('special_requirements')} rows={3}
                      placeholder="Any special requirements or notes…"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
                  </Field>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2"><Upload size={14} /> Documents (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[['id_proof','ID Proof (Aadhaar/PAN/Passport)'],['edu_cert','Educational Certificate'],['other_doc','Other Document']].map(([field, label]) => (
                  <Field key={field} label={label}>
                    {form[field] ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <FileText size={14} className="text-emerald-600 flex-shrink-0" />
                        <span className="text-xs text-emerald-700 truncate flex-1">{form[field].name}</span>
                        <button type="button" onClick={() => set(field, null)} className="text-rose-400 hover:text-rose-600">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                        <Upload size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-500">PDF or Image (max 5MB)</span>
                        <input type="file" accept=".pdf,image/*" className="sr-only" onChange={e => handleFileUpload(field, e)} />
                      </label>
                    )}
                  </Field>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4 flex items-center gap-2"><CheckCircle size={14} /> Review Before Submitting</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 bg-slate-50 rounded-xl p-4">
              <ReviewRow label="Full Name"          value={form.name} />
              <ReviewRow label="Email"              value={form.email} />
              <ReviewRow label="Phone"              value={form.phone} />
              <ReviewRow label="WhatsApp"           value={form.same_whatsapp ? form.phone : form.whatsapp} />
              <ReviewRow label="Date of Birth"      value={form.dob} />
              <ReviewRow label="Gender"             value={form.gender} />
              <ReviewRow label="City / State"       value={[form.city, form.state].filter(Boolean).join(', ')} />
              <ReviewRow label="PIN Code"           value={form.pin_code} />
              <ReviewRow label="Qualification"      value={form.highest_qualification} />
              <ReviewRow label="College"            value={form.college_name} />
              <ReviewRow label="Preferred Mode"     value={form.preferred_mode?.replace(/_/g,' ')} />
              <ReviewRow label="Emergency Contact"  value={`${form.emergency_contact_name} (${form.emergency_contact_relation})`} />
              <ReviewRow label="Emergency Phone"    value={form.emergency_contact_phone} />
              <ReviewRow label="How Heard"          value={form.heard_about_us} />
              <ReviewRow label="Prior Knowledge"    value={form.prior_knowledge} />
              <ReviewRow label="Documents"          value={[form.id_proof?.name, form.edu_cert?.name, form.other_doc?.name].filter(Boolean).join(', ') || null} />
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">A welcome email with login credentials will be sent to <strong>{form.email}</strong> immediately after submission.</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
        <button onClick={prevStep} disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-40 text-sm font-medium transition">
          <ChevronLeft size={16} /> Back
        </button>
        <span className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1 ? (
          <button onClick={nextStep} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-xl text-sm font-semibold transition">
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition">
            {submitting ? <>Submitting…</> : <><CheckCircle size={15} /> Admit Student</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OwnerAdmissions() {
  const [activeTab, setActiveTab] = useState('form')
  const [listKey, setListKey]     = useState(0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admissions</h1>
          <p className="text-slate-500 text-sm mt-1">Admit new students and view all admission records</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-medium">
          <button onClick={() => setActiveTab('form')} className={`px-4 py-2 transition ${activeTab === 'form' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> New Admission</span>
          </button>
          <button onClick={() => setActiveTab('list')} className={`px-4 py-2 transition ${activeTab === 'list' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span className="flex items-center gap-1.5"><ClipboardList size={14} /> All Admissions</span>
          </button>
        </div>
      </div>

      {activeTab === 'form' && (
        <AdmissionForm onSuccess={() => { setActiveTab('list'); setListKey(k => k + 1) }} />
      )}
      {activeTab === 'list' && (
        <AdmissionsList key={listKey} />
      )}
    </div>
  )
}
