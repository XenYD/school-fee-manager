import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Student, Gender, School } from '../../types'
import { CLASS_LIST } from '../../types'
import {
  ArrowLeft, ArrowRight, Check, User, Phone, BookOpen,
  Users, Search, ChevronLeft, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants (module-level so they never re-create) ────────────────────────

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const MONTHS = [
  { v: '01', l: 'January' },  { v: '02', l: 'February' }, { v: '03', l: 'March' },
  { v: '04', l: 'April' },    { v: '05', l: 'May' },      { v: '06', l: 'June' },
  { v: '07', l: 'July' },     { v: '08', l: 'August' },   { v: '09', l: 'September' },
  { v: '10', l: 'October' },  { v: '11', l: 'November' }, { v: '12', l: 'December' },
]

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - 4 - i))

const inputCls = 'input-field text-sm'
const labelCls = 'block text-xs font-semibold mb-1.5'

// ─── Form data type ──────────────────────────────────────────────────────────

interface FormData {
  name: string
  dobDay: string
  dobMonth: string
  dobYear: string
  gender: Gender | ''
  studentClass: string
  admission_date: string
  fee_amount: string
  exam_fee_amount: string
  parent_name: string
  parent_cnic: string
  parent_phone: string
  parent_whatsapp: string
  address: string
  blood_group: string
  religion: string
  emergency_contact_name: string
  emergency_contact_phone: string
  special_needs: string
  previous_school: string
  sibling_ids: string[]
}

const initForm = (): FormData => ({
  name: '',
  dobDay: '', dobMonth: '', dobYear: '',
  gender: '',
  studentClass: '',
  admission_date: new Date().toISOString().slice(0, 10),
  fee_amount: '',
  exam_fee_amount: '',
  parent_name: '',
  parent_cnic: '',
  parent_phone: '',
  parent_whatsapp: '',
  address: '',
  blood_group: '',
  religion: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  special_needs: '',
  previous_school: '',
  sibling_ids: [],
})

// ─── Step indicator (top-level component) ───────────────────────────────────

interface StepIndicatorProps { step: number }

function StepIndicator({ step }: StepIndicatorProps) {
  const steps = [
    { n: 1, label: 'Student Info' },
    { n: 2, label: 'Parent Info' },
    { n: 3, label: 'Optional Details' },
  ]
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((s, idx) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={{
                backgroundColor: step > s.n ? 'var(--c-success)' : step === s.n ? 'var(--c-accent)' : 'var(--c-surface-3)',
                color: step >= s.n ? 'white' : 'var(--c-text-4)',
              }}
            >
              {step > s.n ? <Check size={16} /> : s.n}
            </div>
            <p
              className="text-xs font-medium mt-1 text-center hidden sm:block"
              style={{ color: step >= s.n ? 'var(--c-text-1)' : 'var(--c-text-4)' }}
            >
              {s.label}
            </p>
          </div>
          {idx < steps.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-2 transition-all"
              style={{ backgroundColor: step > s.n ? 'var(--c-success)' : 'var(--c-surface-3)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Student Information (top-level component) ───────────────────────

interface Step1Props {
  form: FormData
  setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  isAdmin: boolean
  schools: School[]
  selectedSchoolId: string
  setSelectedSchoolId: (id: string) => void
  classFees?: Record<string, number>
}

function Step1({ form, setField, isAdmin, schools, selectedSchoolId, setSelectedSchoolId, classFees }: Step1Props) {
  function handleClassChange(cls: string) {
    const autoFee = classFees?.[cls]
    setField('studentClass', cls)
    if (autoFee) setField('fee_amount', String(autoFee))
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <User size={16} style={{ color: 'var(--c-accent)' }} />
        <h2 className="font-semibold text-gray-900">Student Information</h2>
      </div>

      {isAdmin && (
        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            School <span className="text-red-400">*</span>
          </label>
          <select
            className={inputCls}
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            <option value="">Select school</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
          Full Name <span className="text-red-400">*</span>
        </label>
        <input
          className={inputCls}
          placeholder="Student full name"
          autoFocus
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
          Date of Birth <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <select className={inputCls} value={form.dobDay} onChange={(e) => setField('dobDay', e.target.value)}>
            <option value="">Day</option>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={inputCls} value={form.dobMonth} onChange={(e) => setField('dobMonth', e.target.value)}>
            <option value="">Month</option>
            {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select className={inputCls} value={form.dobYear} onChange={(e) => setField('dobYear', e.target.value)}>
            <option value="">Year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            Gender <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['male', 'female', 'other'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setField('gender', g)}
                className="py-2 rounded-lg border text-xs font-semibold capitalize transition-all"
                style={{
                  borderColor: form.gender === g ? 'var(--c-accent)' : 'var(--c-border)',
                  backgroundColor: form.gender === g ? 'rgba(74,144,217,0.12)' : 'var(--c-surface-2)',
                  color: form.gender === g ? 'var(--c-accent)' : 'var(--c-text-2)',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            Class <span className="text-red-400">*</span>
          </label>
          <select
            className={inputCls}
            value={form.studentClass}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            <option value="">Select class</option>
            {CLASS_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Admission Date</label>
          <input
            type="date"
            className={inputCls}
            value={form.admission_date}
            onChange={(e) => setField('admission_date', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Monthly Fee (Rs)</label>
          <input
            type="number"
            className={inputCls}
            placeholder="e.g. 3500"
            value={form.fee_amount}
            onChange={(e) => setField('fee_amount', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Exam Fee (Rs)</label>
          <input
            type="number"
            className={inputCls}
            placeholder="e.g. 500"
            value={form.exam_fee_amount}
            onChange={(e) => setField('exam_fee_amount', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Parent Information (top-level component) ────────────────────────

interface Step2Props {
  form: FormData
  setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void
}

function Step2({ form, setField }: Step2Props) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <Phone size={16} style={{ color: 'var(--c-accent)' }} />
        <h2 className="font-semibold text-gray-900">Parent / Guardian Information</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            Parent / Guardian Name <span className="text-red-400">*</span>
          </label>
          <input
            className={inputCls}
            placeholder="Full name"
            value={form.parent_name}
            onChange={(e) => setField('parent_name', e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            CNIC <span className="text-red-400">*</span>
          </label>
          <input
            className={inputCls}
            placeholder="42101-1234567-1"
            value={form.parent_cnic}
            onChange={(e) => setField('parent_cnic', e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            className={inputCls}
            placeholder="03XX-XXXXXXX"
            value={form.parent_phone}
            onChange={(e) => setField('parent_phone', e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>WhatsApp Number</label>
          <input
            className={inputCls}
            placeholder="Same or different number"
            value={form.parent_whatsapp}
            onChange={(e) => setField('parent_whatsapp', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
            Home Address <span className="text-red-400">*</span>
          </label>
          <textarea
            className={inputCls}
            rows={3}
            placeholder="Full home address"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Optional Details (top-level component) ──────────────────────────

interface Step3Props {
  form: FormData
  setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  existingStudents: Student[]
  sibSearch: string
  setSibSearch: (v: string) => void
  sibClass: string
  setSibClass: (v: string) => void
}

function Step3({ form, setField, existingStudents, sibSearch, setSibSearch, sibClass, setSibClass }: Step3Props) {
  const filteredSiblings = useMemo(() => {
    let list = existingStudents
    if (sibSearch.trim()) list = list.filter((s) => s.name.toLowerCase().includes(sibSearch.toLowerCase()))
    if (sibClass) list = list.filter((s) => s.class === sibClass)
    return list
  }, [existingStudents, sibSearch, sibClass])

  function toggleSibling(id: string) {
    const current = form.sibling_ids
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setField('sibling_ids', next)
  }

  return (
    <div className="space-y-5">
      {/* Medical & Personal */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
          <BookOpen size={16} style={{ color: 'var(--c-accent)' }} />
          <h2 className="font-semibold text-gray-900">Medical &amp; Personal</h2>
          <span className="text-xs ml-auto" style={{ color: 'var(--c-text-4)' }}>All optional</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Blood Group</label>
            <select
              className={inputCls}
              value={form.blood_group}
              onChange={(e) => setField('blood_group', e.target.value)}
            >
              <option value="">Unknown</option>
              {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Religion</label>
            <input
              className={inputCls}
              placeholder="e.g. Islam"
              value={form.religion}
              onChange={(e) => setField('religion', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Emergency Contact Name</label>
            <input
              className={inputCls}
              placeholder="Name"
              value={form.emergency_contact_name}
              onChange={(e) => setField('emergency_contact_name', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Emergency Contact Phone</label>
            <input
              className={inputCls}
              placeholder="03XX-XXXXXXX"
              value={form.emergency_contact_phone}
              onChange={(e) => setField('emergency_contact_phone', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Previous School</label>
            <input
              className={inputCls}
              placeholder="Name of previous school"
              value={form.previous_school}
              onChange={(e) => setField('previous_school', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Disability / Special Needs</label>
            <textarea
              className={inputCls}
              rows={2}
              placeholder="Leave blank if none"
              value={form.special_needs}
              onChange={(e) => setField('special_needs', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Siblings */}
      {existingStudents.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Users size={16} style={{ color: 'var(--c-accent)' }} />
            <h2 className="font-semibold text-gray-900">Link Siblings</h2>
            <span className="text-xs ml-auto" style={{ color: 'var(--c-text-4)' }}>Optional</span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--c-text-4)' }}
              />
              <input
                className={inputCls + ' pl-8'}
                placeholder="Search by name…"
                value={sibSearch}
                onChange={(e) => setSibSearch(e.target.value)}
              />
            </div>
            <select
              className={inputCls + ' w-32'}
              value={sibClass}
              onChange={(e) => setSibClass(e.target.value)}
            >
              <option value="">All</option>
              {CLASS_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {filteredSiblings.length === 0 ? (
            <p className="text-xs text-center py-2" style={{ color: 'var(--c-text-4)' }}>
              No students found
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {filteredSiblings.map((s) => {
                const sel = form.sibling_ids.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSibling(s.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left"
                    style={{
                      borderColor: sel ? 'var(--c-accent)' : 'var(--c-border)',
                      backgroundColor: sel ? 'rgba(74,144,217,0.12)' : 'var(--c-surface-2)',
                      color: sel ? 'var(--c-accent)' : 'var(--c-text-2)',
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                      style={{ backgroundColor: sel ? 'var(--c-accent)' : 'var(--c-text-4)' }}
                    >
                      {s.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p style={{ color: 'var(--c-text-4)' }}>{s.class}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {form.sibling_ids.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--c-success)' }}>
              {form.sibling_ids.length} sibling{form.sibling_ids.length > 1 ? 's' : ''} linked
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page (top-level component) ─────────────────────────────────────────

export default function NewAdmissionPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = profile?.role === 'admin'
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>(() => {
    const inquiry = location.state?.inquiry
    if (inquiry) {
      return {
        ...initForm(),
        name: inquiry.name ?? '',
        parent_name: inquiry.parent_name ?? '',
        parent_phone: inquiry.parent_phone ?? '',
        studentClass: inquiry.studentClass ?? '',
      }
    }
    return initForm()
  })
  const [existingStudents, setExistingStudents] = useState<Student[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState(profile?.school_id ?? '')
  const [sibSearch, setSibSearch] = useState('')
  const [sibClass, setSibClass] = useState('')
  const fromInquiry = location.state?.inquiry ?? null

  const schoolId = isAdmin ? selectedSchoolId : (profile?.school_id ?? '')
  const classFees = isAdmin
    ? schools.find((s) => s.id === schoolId)?.class_fees
    : profile?.schools?.class_fees

  const backPath = isAdmin ? '/admin/students' : '/school/students'

  // Stable setField callback — updates one key without touching others
  function setField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  useEffect(() => {
    if (isAdmin) {
      supabase.from('schools').select('*').order('name').then(({ data }) => {
        setSchools(data ?? [])
        if (!selectedSchoolId && data?.length) setSelectedSchoolId(data[0].id)
      })
    }
  }, [isAdmin])

  useEffect(() => {
    if (schoolId) loadStudents()
  }, [schoolId])

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, name, class, sibling_ids')
      .eq('school_id', schoolId)
      .order('name')
    setExistingStudents((data as Student[]) ?? [])
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateStep1() {
    if (!form.name.trim()) { toast.error('Student name is required'); return false }
    if (!form.dobDay || !form.dobMonth || !form.dobYear) { toast.error('Date of birth is required'); return false }
    if (!form.gender) { toast.error('Gender is required'); return false }
    if (!form.studentClass) { toast.error('Class is required'); return false }
    if (isAdmin && !selectedSchoolId) { toast.error('Select a school first'); return false }
    return true
  }

  function validateStep2() {
    if (!form.parent_name.trim()) { toast.error('Parent name is required'); return false }
    if (!form.parent_cnic.trim()) { toast.error('Parent CNIC is required'); return false }
    if (!form.parent_phone.trim()) { toast.error('Parent phone is required'); return false }
    if (!form.address.trim()) { toast.error('Address is required'); return false }
    return true
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => Math.min(s + 1, 3))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true)
    try {
      const date_of_birth = `${form.dobYear}-${form.dobMonth}-${form.dobDay}`
      const payload = {
        school_id: schoolId,
        name: form.name.trim(),
        class: form.studentClass,
        fee_amount: parseFloat(form.fee_amount) || 0,
        exam_fee_amount: parseFloat(form.exam_fee_amount) || 0,
        date_of_birth,
        gender: form.gender || null,
        admission_date: form.admission_date || null,
        parent_name: form.parent_name.trim() || null,
        parent_cnic: form.parent_cnic.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        parent_whatsapp: form.parent_whatsapp.trim() || null,
        address: form.address.trim() || null,
        blood_group: form.blood_group || null,
        religion: form.religion.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        special_needs: form.special_needs.trim() || null,
        previous_school: form.previous_school.trim() || null,
        sibling_ids: form.sibling_ids,
      }

      const { data: newStudent, error } = await supabase
        .from('students').insert(payload).select('id').single()
      if (error) throw error

      // Update sibling records bidirectionally
      if (form.sibling_ids.length > 0 && newStudent?.id) {
        for (const sibId of form.sibling_ids) {
          const sib = existingStudents.find((s) => s.id === sibId)
          if (sib) {
            const ids = [...(sib.sibling_ids ?? []).filter((x) => x !== newStudent.id), newStudent.id]
            await supabase.from('students').update({ sibling_ids: ids }).eq('id', sibId)
          }
        }
      }

      // If converted from an inquiry, mark it as converted
      if (fromInquiry?.inquiry_id) {
        await supabase
          .from('inquiries')
          .update({ status: 'converted' })
          .eq('id', fromInquiry.inquiry_id)
      }

      toast.success(`${form.name} admitted successfully!`)
      navigate(backPath)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save admission')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const stepLabels = ['Student Info', 'Parent Info', 'Optional Details']

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(backPath)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--c-text-3)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Student Admission</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Step {step} of 3 — {stepLabels[step - 1]}
          </p>
        </div>
      </div>

      {fromInquiry && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: 'rgba(5,150,105,0.1)', color: '#059669' }}
        >
          <CheckCircle2 size={16} />
          <span>
            Pre-filled from inquiry for <strong>{fromInquiry.name}</strong>. Complete remaining fields to admit.
          </span>
        </div>
      )}

      <StepIndicator step={step} />

      {/* Step content — each step is a stable top-level component, no focus loss */}
      {step === 1 && (
        <Step1
          form={form}
          setField={setField}
          isAdmin={isAdmin}
          schools={schools}
          selectedSchoolId={selectedSchoolId}
          setSelectedSchoolId={setSelectedSchoolId}
          classFees={classFees}
        />
      )}
      {step === 2 && (
        <Step2
          form={form}
          setField={setField}
        />
      )}
      {step === 3 && (
        <Step3
          form={form}
          setField={setField}
          existingStudents={existingStudents}
          sibSearch={sibSearch}
          setSibSearch={setSibSearch}
          sibClass={sibClass}
          setSibClass={setSibClass}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={step === 1 ? () => navigate(backPath) : prevStep}
          className="btn-secondary text-sm px-5 flex items-center gap-2"
        >
          <ChevronLeft size={15} />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={nextStep}
            className="btn-primary text-sm px-8 flex items-center gap-2"
          >
            Next <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary text-sm px-8 flex items-center gap-2"
          >
            {saving ? (
              <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
            ) : (
              <><Check size={15} /> Submit Admission</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
