import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ExpenseCategory, School } from '../../types'
import { EXPENSE_CATEGORY_LABELS } from '../../types'
import { ArrowLeft, Receipt, Save, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES: ExpenseCategory[] = ['teacher_salary', 'rent', 'utilities', 'supplies', 'other']

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  teacher_salary: '#4A90D9', rent: '#E67E22',
  utilities: '#9B59B6', supplies: '#2ECC71', other: '#95A5A6',
}

interface StaffMember { id: string; full_name: string; role: string }

export default function AddExpensePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const [schools, setSchools] = useState<School[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    school_id: profile?.school_id ?? '',
    title: '',
    category: 'other' as ExpenseCategory,
    staff_member_id: '',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    note: '',
  })

  const backPath = isAdmin ? '/admin/expenses' : '/school/expenses'

  // Load schools for admin
  useEffect(() => {
    if (isAdmin) {
      supabase.from('schools').select('*').order('name').then(({ data }) => {
        setSchools(data ?? [])
        if (!form.school_id && data?.length) {
          setForm((f) => ({ ...f, school_id: data[0].id }))
        }
      })
    }
  }, [isAdmin])

  // Load staff whenever school changes
  useEffect(() => {
    if (form.school_id) loadStaff(form.school_id)
  }, [form.school_id])

  async function loadStaff(schoolId: string) {
    setLoadingStaff(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('school_id', schoolId)
        .in('role', ['school_owner', 'staff'])
        .order('full_name')
      setStaffMembers(data ?? [])
    } finally {
      setLoadingStaff(false)
    }
  }

  function handleCategoryChange(cat: ExpenseCategory) {
    setForm((f) => ({
      ...f,
      category: cat,
      // Clear staff member if switching away from teacher_salary
      staff_member_id: cat !== 'teacher_salary' ? '' : f.staff_member_id,
    }))
  }

  function handleStaffSelect(staffId: string) {
    const member = staffMembers.find((s) => s.id === staffId)
    setForm((f) => ({
      ...f,
      staff_member_id: staffId,
      // Auto-fill title only if it's still empty
      title: !f.title.trim() && member ? `${member.full_name} - Salary` : f.title,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.school_id) { toast.error('Select a school'); return }
    if (form.category === 'teacher_salary' && !form.staff_member_id) {
      toast.error('Please select a staff member for salary payment')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        school_id: form.school_id,
        title: form.title.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        note: form.note.trim() || null,
        created_by: profile?.id,
        staff_member_id: form.category === 'teacher_salary' && form.staff_member_id
          ? form.staff_member_id
          : null,
      })
      if (error) throw error
      toast.success('Expense saved!')
      navigate(backPath)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'
  const selectedStaff = staffMembers.find((s) => s.id === form.staff_member_id)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backPath)}
          className="p-2 rounded-lg transition-colors" style={{ color: 'var(--c-text-3)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add Expense</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record a new expense entry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Receipt size={16} style={{ color: 'var(--c-accent)' }} />
            <h2 className="font-semibold text-gray-900 text-sm">Expense Details</h2>
          </div>

          {/* School selector (admin only) */}
          {isAdmin && schools.length > 0 && (
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
                School <span className="text-red-400">*</span>
              </label>
              <select
                className={inputCls}
                value={form.school_id}
                onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value, staff_member_id: '' }))}
              >
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Expense title */}
          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
              Expense Title <span className="text-red-400">*</span>
            </label>
            <input
              className={inputCls}
              placeholder="e.g. January Staff Salaries"
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category picker */}
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Category</label>
              <div className="grid grid-cols-1 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-all"
                    style={{
                      borderColor: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--c-border)',
                      backgroundColor: form.category === cat ? CATEGORY_COLORS[cat] + '15' : 'var(--c-surface-2)',
                      color: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--c-text-2)',
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    <span className="font-medium">{EXPENSE_CATEGORY_LABELS[cat]}</span>
                    {cat === 'teacher_salary' && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: 'rgba(74,144,217,0.15)', color: '#4A90D9' }}>
                        Smart
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Staff Member dropdown — only for Teacher Salary ── */}
              {form.category === 'teacher_salary' && (
                <div className="mt-3 p-3 rounded-xl border-2 transition-all"
                  style={{ borderColor: '#4A90D9', backgroundColor: 'rgba(74,144,217,0.06)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} style={{ color: '#4A90D9' }} />
                    <label className="text-xs font-bold" style={{ color: '#4A90D9' }}>
                      Select Staff Member <span className="text-red-400">*</span>
                    </label>
                  </div>

                  {loadingStaff ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="h-3.5 w-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-xs" style={{ color: 'var(--c-text-4)' }}>Loading staff...</span>
                    </div>
                  ) : staffMembers.length === 0 ? (
                    <p className="text-xs py-1" style={{ color: 'var(--c-text-4)' }}>
                      No staff found for this school. Make sure staff accounts are linked to this school.
                    </p>
                  ) : (
                    <select
                      className={inputCls}
                      value={form.staff_member_id}
                      onChange={(e) => handleStaffSelect(e.target.value)}
                    >
                      <option value="">— Select staff member —</option>
                      {staffMembers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                          {s.role === 'school_owner' ? ' (Principal)' : ' (Staff)'}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Selected staff preview */}
                  {selectedStaff && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg"
                      style={{ backgroundColor: 'rgba(74,144,217,0.12)' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: '#4A90D9' }}>
                        {selectedStaff.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#4A90D9' }}>
                          {selectedStaff.full_name}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--c-text-4)' }}>
                          {selectedStaff.role === 'school_owner' ? 'Principal' : 'Staff'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right column: amount, date, note */}
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>
                  Amount (Rs) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="e.g. 50000"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Note (optional)</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  placeholder="Any additional notes..."
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(backPath)} className="btn-secondary text-sm px-5">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary text-sm px-8">
            {saving
              ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              : <><Save size={15} /> Save Expense</>}
          </button>
        </div>
      </form>
    </div>
  )
}
