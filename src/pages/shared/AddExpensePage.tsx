import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ExpenseCategory, School } from '../../types'
import { EXPENSE_CATEGORY_LABELS } from '../../types'
import { ArrowLeft, Receipt, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES: ExpenseCategory[] = ['teacher_salary', 'rent', 'utilities', 'supplies', 'other']

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  teacher_salary: '#4A90D9', rent: '#E67E22',
  utilities: '#9B59B6', supplies: '#2ECC71', other: '#95A5A6',
}

export default function AddExpensePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const [schools, setSchools] = useState<School[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    school_id: profile?.school_id ?? '',
    title: '',
    category: 'other' as ExpenseCategory,
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    note: '',
  })

  useEffect(() => {
    if (isAdmin) {
      supabase.from('schools').select('*').order('name').then(({ data }) => {
        setSchools(data ?? [])
        if (!form.school_id && data?.length) setForm((f) => ({ ...f, school_id: data[0].id }))
      })
    }
  }, [isAdmin])

  const backPath = isAdmin ? '/admin/expenses' : '/school/expenses'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.school_id) { toast.error('Select a school'); return }

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
      })
      if (error) throw error
      toast.success('Expense added!')
      navigate(backPath)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="max-w-xl mx-auto space-y-6">
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

          {isAdmin && schools.length > 0 && (
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>School <span className="text-red-400">*</span></label>
              <select className={inputCls} value={form.school_id} onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value }))}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Expense Title <span className="text-red-400">*</span></label>
            <input className={inputCls} placeholder="e.g. January Staff Salaries" autoFocus
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Category</label>
              <div className="grid grid-cols-1 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => setForm((f) => ({ ...f, category: cat }))}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-all"
                    style={{
                      borderColor: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--c-border)',
                      backgroundColor: form.category === cat ? CATEGORY_COLORS[cat] + '15' : 'var(--c-surface-2)',
                      color: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--c-text-2)',
                    }}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    <span className="font-medium">{EXPENSE_CATEGORY_LABELS[cat]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Amount (Rs) <span className="text-red-400">*</span></label>
                <input type="number" className={inputCls} placeholder="e.g. 50000"
                  value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Date</label>
                <input type="date" className={inputCls} value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Note (optional)</label>
                <textarea className={inputCls} rows={3} placeholder="Any additional notes..."
                  value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(backPath)} className="btn-secondary text-sm px-5">Cancel</button>
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
