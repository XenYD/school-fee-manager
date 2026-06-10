import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Inquiry, InquiryStatus } from '../../types'
import { CLASS_LIST, INQUIRY_STATUS_LABELS } from '../../types'
import {
  Plus, X, Search, MessageSquare, Phone, User,
  ChevronDown, ArrowRight, Clock, CheckCircle2, RefreshCw,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<InquiryStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  follow_up: 'bg-amber-50 text-amber-700',
  converted: 'bg-emerald-50 text-emerald-700',
}

const STATUS_ICONS: Record<InquiryStatus, React.ReactNode> = {
  new: <Clock size={11} />,
  follow_up: <RefreshCw size={11} />,
  converted: <CheckCircle2 size={11} />,
}

interface InquiryForm {
  student_name: string
  parent_name: string
  parent_phone: string
  class_interested: string
  notes: string
}

const emptyForm = (): InquiryForm => ({
  student_name: '',
  parent_name: '',
  parent_phone: '',
  class_interested: '',
  notes: '',
})

export default function InquiriesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<InquiryForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    loadInquiries()
  }, [])

  async function loadInquiries() {
    setLoading(true)
    try {
      let query = supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })

      if (profile?.role !== 'admin') {
        query = query.eq('school_id', profile!.school_id!)
      }

      const { data, error } = await query
      if (error) throw error
      setInquiries(data ?? [])
    } catch {
      toast.error('Failed to load inquiries')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!form.student_name.trim()) return toast.error('Student name is required')
    if (!form.parent_name.trim()) return toast.error('Parent name is required')
    if (!form.parent_phone.trim()) return toast.error('Parent phone is required')
    if (!form.class_interested) return toast.error('Class interested is required')

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('inquiries')
          .update({
            student_name: form.student_name.trim(),
            parent_name: form.parent_name.trim(),
            parent_phone: form.parent_phone.trim(),
            class_interested: form.class_interested,
            notes: form.notes.trim() || null,
          })
          .eq('id', editingId)
        if (error) throw error
        toast.success('Inquiry updated')
      } else {
        const { error } = await supabase.from('inquiries').insert({
          school_id: profile!.school_id!,
          student_name: form.student_name.trim(),
          parent_name: form.parent_name.trim(),
          parent_phone: form.parent_phone.trim(),
          class_interested: form.class_interested,
          notes: form.notes.trim() || null,
          status: 'new',
        })
        if (error) throw error
        toast.success('Inquiry added')
      }
      closeForm()
      loadInquiries()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save inquiry')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(inquiry: Inquiry) {
    setForm({
      student_name: inquiry.student_name,
      parent_name: inquiry.parent_name,
      parent_phone: inquiry.parent_phone,
      class_interested: inquiry.class_interested,
      notes: inquiry.notes ?? '',
    })
    setEditingId(inquiry.id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setForm(emptyForm())
    setEditingId(null)
  }

  async function updateStatus(id: string, status: InquiryStatus) {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('inquiries')
        .update({ status })
        .eq('id', id)
      if (error) throw error
      setInquiries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
      )
      toast.success(`Status updated to ${INQUIRY_STATUS_LABELS[status]}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  async function convertToAdmission(inquiry: Inquiry) {
    if (
      !confirm(
        `Convert ${inquiry.student_name}'s inquiry to admission?\n\nThe admission form will be pre-filled with their details.`
      )
    )
      return
    // Mark as converted first
    await supabase.from('inquiries').update({ status: 'converted' }).eq('id', inquiry.id)
    setInquiries((prev) =>
      prev.map((i) => (i.id === inquiry.id ? { ...i, status: 'converted' } : i))
    )
    navigate('/school/students/new', {
      state: {
        inquiry: {
          name: inquiry.student_name,
          parent_name: inquiry.parent_name,
          parent_phone: inquiry.parent_phone,
          studentClass: inquiry.class_interested,
          inquiry_id: inquiry.id,
        },
      },
    })
  }

  async function deleteInquiry(id: string) {
    if (!confirm('Delete this inquiry? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('inquiries').delete().eq('id', id)
      if (error) throw error
      setInquiries((prev) => prev.filter((i) => i.id !== id))
      toast.success('Inquiry deleted')
    } catch {
      toast.error('Failed to delete inquiry')
    }
  }

  const filtered = inquiries.filter((i) => {
    const matchSearch =
      !search ||
      i.student_name.toLowerCase().includes(search.toLowerCase()) ||
      i.parent_name.toLowerCase().includes(search.toLowerCase()) ||
      i.parent_phone.includes(search)
    const matchStatus = filterStatus === 'all' || i.status === filterStatus
    return matchSearch && matchStatus
  })

  const counts = {
    all: inquiries.length,
    new: inquiries.filter((i) => i.status === 'new').length,
    follow_up: inquiries.filter((i) => i.status === 'follow_up').length,
    converted: inquiries.filter((i) => i.status === 'converted').length,
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track prospective students before formal admission.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> New Inquiry
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="input-field pl-9 text-sm w-full"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as InquiryStatus | 'all')}
            className="input-field appearance-none pr-8 text-sm"
          >
            <option value="all">All ({counts.all})</option>
            <option value="new">New ({counts.new})</option>
            <option value="follow_up">Follow Up ({counts.follow_up})</option>
            <option value="converted">Converted ({counts.converted})</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner text="Loading inquiries..." />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <MessageSquare size={40} className="mx-auto mb-3" style={{ color: 'var(--c-text-4)' }} />
          <p className="font-medium text-gray-500">
            {search || filterStatus !== 'all' ? 'No matching inquiries' : 'No inquiries yet'}
          </p>
          {!search && filterStatus === 'all' && (
            <p className="text-xs text-gray-400 mt-1">
              Click "New Inquiry" to add a prospective student.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inquiry) => (
            <div key={inquiry.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #4A90D9, #2C5F8A)' }}
                  >
                    {inquiry.student_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{inquiry.student_name}</p>
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inquiry.status]}`}
                      >
                        {STATUS_ICONS[inquiry.status]}
                        {INQUIRY_STATUS_LABELS[inquiry.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User size={11} /> {inquiry.parent_name}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={11} /> {inquiry.parent_phone}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          color: 'var(--c-text-3)',
                        }}
                      >
                        {inquiry.class_interested}
                      </span>
                    </div>
                    {inquiry.notes && (
                      <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{inquiry.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Added{' '}
                      {new Date(inquiry.created_at).toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                  {inquiry.status !== 'converted' && (
                    <button
                      onClick={() => convertToAdmission(inquiry)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                      style={{ backgroundColor: '#059669' }}
                      title="Convert to admission"
                    >
                      <ArrowRight size={12} />
                      <span className="hidden sm:inline">Admit</span>
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(inquiry)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-3)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteInquiry(inquiry.id)}
                    className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="Delete"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Status change buttons */}
              {inquiry.status !== 'converted' && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--c-border)' }}>
                  <span className="text-xs text-gray-400">Change status:</span>
                  {(['new', 'follow_up'] as InquiryStatus[])
                    .filter((s) => s !== inquiry.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(inquiry.id, s)}
                        disabled={updatingId === inquiry.id}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${STATUS_COLORS[s]}`}
                      >
                        {INQUIRY_STATUS_LABELS[s]}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Edit Inquiry' : 'New Inquiry'}
              </h3>
              <button
                onClick={closeForm}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className={labelCls}>Student Name *</label>
                <input
                  type="text"
                  value={form.student_name}
                  onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                  placeholder="Enter student name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Parent / Guardian Name *</label>
                <input
                  type="text"
                  value={form.parent_name}
                  onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                  placeholder="Enter parent name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Parent Phone *</label>
                <input
                  type="tel"
                  value={form.parent_phone}
                  onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                  placeholder="03XX-XXXXXXX"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Class Interested In *</label>
                <div className="relative">
                  <select
                    value={form.class_interested}
                    onChange={(e) => setForm({ ...form, class_interested: e.target.value })}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    <option value="">— Select class —</option>
                    {CLASS_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={closeForm}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  'Update Inquiry'
                ) : (
                  'Add Inquiry'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
