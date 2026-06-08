import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Student, School } from '../../types'
import { CLASS_LIST } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { Plus, Search, GraduationCap, Phone, Trash2, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface StudentWithSchool extends Student { school_name?: string }

export default function AdminStudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentWithSchool[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSchool, setFilterSchool] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [{ data: sData }, { data: scData }] = await Promise.all([
        supabase.from('students').select('*, schools(name)').order('name'),
        supabase.from('schools').select('*').order('name'),
      ])
      const mapped: StudentWithSchool[] = (sData ?? []).map((s: Student & { schools?: { name: string } }) => ({
        ...s,
        school_name: s.schools?.name,
      }))
      setStudents(mapped)
      setSchools(scData ?? [])
    } catch {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(student: StudentWithSchool) {
    if (!confirm(`Remove "${student.name}"? This also deletes all their fee records.`)) return
    setDeleting(student.id)
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id)
      if (error) throw error
      toast.success(`${student.name} removed`)
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
    } catch {
      toast.error('Failed to remove student')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = useMemo(() => {
    let list = students
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.parent_phone ?? '').includes(q))
    }
    if (filterSchool) list = list.filter((s) => s.school_id === filterSchool)
    if (filterClass) list = list.filter((s) => s.class === filterClass)
    return list
  }, [students, search, filterSchool, filterClass])

  if (loading) return <LoadingSpinner fullPage text="Loading students..." />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} students across all schools</p>
        </div>
        <Link to="/admin/students/new" className="btn-primary text-sm">
          <Plus size={15} /> New Admission
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="input-field pl-8 text-sm" placeholder="Search by name or phone…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>
        <select className="input-field text-sm sm:w-48" value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
          <option value="">All Schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input-field text-sm sm:w-36" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {CLASS_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: students.length, color: 'var(--c-accent)' },
          { label: 'Filtered', value: filtered.length, color: 'var(--c-text-1)' },
          { label: 'Schools', value: schools.length, color: '#2ECC71' },
        ].map((s) => (
          <div key={s.label} className="stat-card text-center py-3">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{search || filterSchool || filterClass ? 'No students match your filters' : 'No students yet'}</p>
          <Link to="/admin/students/new" className="btn-primary mt-4 mx-auto text-sm inline-flex">
            <Plus size={14} /> New Admission
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
            {filtered.map((student) => (
              <div key={student.id} className="flex items-center gap-3 px-4 py-3 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--c-accent), #2C5F8A)' }}>
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--c-surface-3)', color: 'var(--c-text-2)' }}>
                      {student.class}
                    </span>
                    {student.school_name && (
                      <span className="text-xs" style={{ color: 'var(--c-text-4)' }}>{student.school_name}</span>
                    )}
                    {student.parent_phone && (
                      <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1 text-xs" style={{ color: 'var(--c-accent)' }}>
                        <Phone size={10} /> {student.parent_phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">Rs {Number(student.fee_amount).toLocaleString()}</p>
                </div>
                <Link to={`/admin/students/${student.id}`}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                  style={{ color: 'var(--c-text-4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--c-accent)'; e.currentTarget.style.backgroundColor = 'rgba(74,144,217,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-4)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                  title="View admission record">
                  <Eye size={14} />
                </Link>
                <button onClick={() => handleDelete(student)} disabled={deleting === student.id}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0 ml-1"
                  style={{ color: 'var(--c-text-4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#E74C3C'; e.currentTarget.style.backgroundColor = 'rgba(231,76,60,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-4)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
                  {deleting === student.id
                    ? <div className="h-4 w-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 text-xs border-t" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-4)', backgroundColor: 'var(--c-surface-2)' }}>
            Showing {filtered.length} of {students.length} students
          </div>
        </div>
      )}
    </div>
  )
}
