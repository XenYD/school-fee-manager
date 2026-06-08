import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Expense, ExpenseCategory, School } from '../../types'
import { EXPENSE_CATEGORY_LABELS } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { Link } from 'react-router-dom'
import {
  Plus, Trash2, Receipt, TrendingDown,
  Search, CalendarDays, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES: ExpenseCategory[] = ['teacher_salary', 'rent', 'utilities', 'supplies', 'other']

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  teacher_salary: '#4A90D9',
  rent:           '#E67E22',
  utilities:      '#9B59B6',
  supplies:       '#2ECC71',
  other:          '#95A5A6',
}

interface SchoolOption extends School { }

export default function ExpensesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'demo'
  const isPrincipal = profile?.role === 'school_owner'
  const canManage = isPrincipal || profile?.role === 'admin'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(profile?.school_id ?? '')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | ''>('')

  const addPath = isAdmin ? '/admin/expenses/new' : '/school/expenses/new'

  useEffect(() => {
    if (isAdmin) loadSchools()
    else loadExpenses()
  }, [profile])

  useEffect(() => {
    if (selectedSchoolId) loadExpenses()
  }, [selectedSchoolId])

  async function loadSchools() {
    const { data } = await supabase.from('schools').select('*').order('name')
    const list = (data as SchoolOption[]) ?? []
    setSchools(list)
    if (list.length > 0 && !selectedSchoolId) setSelectedSchoolId(list[0].id)
    setLoading(false)
  }

  async function loadExpenses() {
    if (!selectedSchoolId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, profiles(full_name)')
        .eq('school_id', selectedSchoolId)
        .order('expense_date', { ascending: false })
      if (error) throw error
      setExpenses((data as Expense[]) ?? [])
    } catch {
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeleting(id)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      toast.success('Deleted')
      loadExpenses()
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = useMemo(() => {
    let list = expenses
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((e) => e.title.toLowerCase().includes(q))
    }
    if (filterCategory) list = list.filter((e) => e.category === filterCategory)
    return list
  }, [expenses, search, filterCategory])

  const totalExpenses = filtered.reduce((s, e) => s + Number(e.amount), 0)

  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {}
    expenses.forEach((e) => {
      totals[e.category] = (totals[e.category] ?? 0) + Number(e.amount)
    })
    return totals
  }, [expenses])

  if (loading) return <LoadingSpinner fullPage text="Loading expenses..." />

  const currentSchool = isAdmin
    ? schools.find((s) => s.id === selectedSchoolId)
    : profile?.schools

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {currentSchool?.name ?? 'All Schools'}
          </p>
        </div>
        {canManage && (
          <Link to={addPath} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus size={15} /> Add Expense
          </Link>
        )}
      </div>

      {/* Admin school selector */}
      {isAdmin && schools.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {schools.map((s) => (
            <button key={s.id} onClick={() => setSelectedSchoolId(s.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
              style={{
                borderColor: selectedSchoolId === s.id ? 'var(--c-accent)' : 'var(--c-border)',
                backgroundColor: selectedSchoolId === s.id ? 'rgba(74,144,217,0.12)' : 'var(--c-surface-2)',
                color: selectedSchoolId === s.id ? 'var(--c-accent)' : 'var(--c-text-2)',
              }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="stat-card col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} style={{ color: '#E74C3C' }} />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#E74C3C' }}>
            Rs {totalExpenses.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length} entries</p>
        </div>
        {CATEGORIES.map((cat) => (
          <div key={cat} className="stat-card">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">
                {EXPENSE_CATEGORY_LABELS[cat].split(' ')[0]}
              </span>
            </div>
            <p className="text-sm font-bold text-gray-800">
              Rs {(categoryTotals[cat] ?? 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="input-field pl-8 text-sm" placeholder="Search expenses..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field text-sm sm:w-44" value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | '')}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No expenses recorded</p>
          {canManage && (
            <Link to={addPath} className="btn-primary mt-4 mx-auto text-sm inline-flex items-center gap-1.5">
              <Plus size={14} /> Add First Expense
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
            {filtered.map((exp) => (
              <div key={exp.id} className="flex items-center gap-3 px-4 py-3 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                {/* Category dot */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[exp.category] + '20' }}>
                  <Tag size={15} style={{ color: CATEGORY_COLORS[exp.category] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{exp.title}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                      style={{ backgroundColor: CATEGORY_COLORS[exp.category] + '18', color: CATEGORY_COLORS[exp.category] }}>
                      {EXPENSE_CATEGORY_LABELS[exp.category]}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <CalendarDays size={11} />
                      {new Date(exp.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {exp.note && <span className="text-xs text-gray-400 truncate max-w-[120px]">{exp.note}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: '#E74C3C' }}>
                    Rs {Number(exp.amount).toLocaleString()}
                  </p>
                  {exp.profiles && (
                    <p className="text-xs text-gray-400 mt-0.5">{exp.profiles.full_name}</p>
                  )}
                </div>
                {canManage && (
                  <button onClick={() => handleDelete(exp.id)}
                    disabled={deleting === exp.id}
                    className="p-1.5 rounded-lg transition-colors ml-1 flex-shrink-0"
                    style={{ color: 'var(--c-text-4)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#E74C3C'; e.currentTarget.style.backgroundColor = 'rgba(231,76,60,0.1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-4)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
                    {deleting === exp.id
                      ? <div className="h-4 w-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-surface-2)' }}>
            <span className="text-xs text-gray-500">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-sm font-bold" style={{ color: '#E74C3C' }}>
              Total: Rs {totalExpenses.toLocaleString()}
            </span>
          </div>
        </div>
      )}

    </div>
  )
}
