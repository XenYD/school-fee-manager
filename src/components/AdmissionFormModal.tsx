import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, Gender } from '../types'
import { CLASS_LIST } from '../types'
import { X, User, Phone, MapPin, Heart, BookOpen, ChevronDown, ChevronUp, AlertCircle, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdmissionFormModalProps {
  schoolId: string
  classFees?: Record<string, number>
  onClose: () => void
  onSaved: () => void
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function AdmissionFormModal({ schoolId, classFees, onClose, onSaved }: AdmissionFormModalProps) {
  const [saving, setSaving] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const [siblings, setSiblings] = useState<Student[]>([])

  const initForm = () => ({
    // Required
    name: '',
    date_of_birth: '',
    gender: '' as Gender | '',
    class: '',
    admission_date: new Date().toISOString().slice(0, 10),
    fee_amount: '',
    exam_fee_amount: '',
    parent_name: '',
    parent_cnic: '',
    parent_phone: '',
    parent_whatsapp: '',
    address: '',
    // Optional
    blood_group: '',
    religion: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    special_needs: '',
    previous_school: '',
    sibling_ids: [] as string[],
  })

  const [form, setForm] = useState(initForm())

  useEffect(() => {
    loadSiblings()
  }, [])

  async function loadSiblings() {
    const { data } = await supabase
      .from('students')
      .select('id, name, class')
      .eq('school_id', schoolId)
      .order('name')
    setSiblings((data as Student[]) ?? [])
  }

  function handleClassChange(cls: string) {
    const autoFee = classFees?.[cls]
    setForm((f) => ({ ...f, class: cls, fee_amount: autoFee ? String(autoFee) : f.fee_amount }))
  }

  function toggleSibling(id: string) {
    setForm((f) => ({
      ...f,
      sibling_ids: f.sibling_ids.includes(id)
        ? f.sibling_ids.filter((s) => s !== id)
        : [...f.sibling_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const required = ['name', 'date_of_birth', 'gender', 'class', 'admission_date', 'parent_name', 'parent_cnic', 'parent_phone', 'address'] as const
    for (const field of required) {
      if (!form[field]?.toString().trim()) {
        toast.error(`${field.replace(/_/g, ' ')} is required`)
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        school_id: schoolId,
        name: form.name.trim(),
        class: form.class,
        fee_amount: parseFloat(form.fee_amount) || 0,
        exam_fee_amount: parseFloat(form.exam_fee_amount) || 0,
        date_of_birth: form.date_of_birth || null,
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
        .from('students')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error

      // If siblings selected, also update those siblings to include this new student
      if (form.sibling_ids.length > 0 && newStudent?.id) {
        for (const sibId of form.sibling_ids) {
          const sib = siblings.find((s) => s.id === sibId)
          if (sib) {
            const updatedSiblingIds = [...(sib.sibling_ids ?? []).filter((id) => id !== newStudent.id), newStudent.id]
            await supabase
              .from('students')
              .update({ sibling_ids: updatedSiblingIds })
              .eq('id', sibId)
          }
        }
      }

      toast.success(`${form.name} admitted successfully!`)
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save admission')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1' 
  const sectionTitle = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 mb-3 pb-1.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
      <span style={{ color: 'var(--c-accent)' }}>{icon}</span>
      <h3 className="text-sm font-bold" style={{ color: 'var(--c-text-1)' }}>{title}</h3>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="modal-box w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--c-text-1)' }}>New Student Admission</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>Fill in the student details below</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--c-text-3)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Student Info */}
          {sectionTitle(<User size={15} />, 'Student Information')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Full Name <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="Student full name" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Date of Birth <span className="text-red-400">*</span></label>
              <input type="date" className={inputCls} value={form.date_of_birth}
                onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Gender <span className="text-red-400">*</span></label>
              <select className={inputCls} value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Class <span className="text-red-400">*</span></label>
              <select className={inputCls} value={form.class} onChange={(e) => handleClassChange(e.target.value)}>
                <option value="">Select class</option>
                {CLASS_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Admission Date <span className="text-red-400">*</span></label>
              <input type="date" className={inputCls} value={form.admission_date}
                onChange={(e) => setForm((f) => ({ ...f, admission_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Monthly Fee (Rs)</label>
              <input type="number" className={inputCls} placeholder="0" value={form.fee_amount}
                onChange={(e) => setForm((f) => ({ ...f, fee_amount: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Exam Fee (Rs)</label>
              <input type="number" className={inputCls} placeholder="0" value={form.exam_fee_amount}
                onChange={(e) => setForm((f) => ({ ...f, exam_fee_amount: e.target.value }))} />
            </div>
          </div>

          {/* Parent Info */}
          {sectionTitle(<Phone size={15} />, 'Parent / Guardian Information')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Parent / Guardian Name <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="Full name" value={form.parent_name}
                onChange={(e) => setForm((f) => ({ ...f, parent_name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Parent CNIC <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="42101-1234567-1" value={form.parent_cnic}
                onChange={(e) => setForm((f) => ({ ...f, parent_cnic: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Phone Number <span className="text-red-400">*</span></label>
              <input className={inputCls} placeholder="03XX-XXXXXXX" value={form.parent_phone}
                onChange={(e) => setForm((f) => ({ ...f, parent_phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>WhatsApp Number</label>
              <input className={inputCls} placeholder="03XX-XXXXXXX (if different)" value={form.parent_whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, parent_whatsapp: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Address <span className="text-red-400">*</span></label>
              <textarea className={inputCls} rows={2} placeholder="Home address" value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>

          {/* Optional Fields Toggle */}
          <button type="button" onClick={() => setShowOptional((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-2)', backgroundColor: 'var(--c-surface-2)' }}>
            <span className="flex items-center gap-2">
              <BookOpen size={15} style={{ color: 'var(--c-accent)' }} />
              Optional Information
            </span>
            {showOptional ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showOptional && (
            <div className="space-y-5">
              {/* Medical / Personal */}
              {sectionTitle(<Heart size={15} />, 'Medical & Personal')}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Blood Group</label>
                  <select className={inputCls} value={form.blood_group}
                    onChange={(e) => setForm((f) => ({ ...f, blood_group: e.target.value }))}>
                    <option value="">Unknown</option>
                    {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Religion</label>
                  <input className={inputCls} placeholder="e.g. Islam" value={form.religion}
                    onChange={(e) => setForm((f) => ({ ...f, religion: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Emergency Contact Name</label>
                  <input className={inputCls} placeholder="Name" value={form.emergency_contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Emergency Contact Phone</label>
                  <input className={inputCls} placeholder="03XX-XXXXXXX" value={form.emergency_contact_phone}
                    onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Disability / Special Needs Notes</label>
                  <textarea className={inputCls} rows={2} placeholder="Leave blank if none"
                    value={form.special_needs}
                    onChange={(e) => setForm((f) => ({ ...f, special_needs: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Previous School</label>
                  <input className={inputCls} placeholder="Name of previous school (if any)" value={form.previous_school}
                    onChange={(e) => setForm((f) => ({ ...f, previous_school: e.target.value }))} />
                </div>
              </div>

              {/* Siblings */}
              {siblings.length > 0 && (
                <>
                  {sectionTitle(<Users size={15} />, 'Link Siblings (enrolled in same school)')}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {siblings.map((s) => {
                      const selected = form.sibling_ids.includes(s.id)
                      return (
                        <button key={s.id} type="button" onClick={() => toggleSibling(s.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left"
                          style={{
                            borderColor: selected ? 'var(--c-accent)' : 'var(--c-border)',
                            backgroundColor: selected ? 'rgba(74,144,217,0.12)' : 'var(--c-surface-2)',
                            color: selected ? 'var(--c-accent)' : 'var(--c-text-2)',
                          }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                            style={{ backgroundColor: selected ? 'var(--c-accent)' : 'var(--c-text-4)' }}>
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
                </>
              )}
            </div>
          )}

          {/* Required fields note */}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--c-text-4)' }}>
            <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
            Fields marked with <span className="text-red-400 font-bold">*</span> are required
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">
              <X size={14} /> Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-5 flex-1">
              {saving ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                'Admit Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
