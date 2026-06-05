import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Student } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { GraduationCap, Plus, Trash2, X, Search, Phone, ListFilter, LayoutList, LayoutGrid } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StudentsPage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [form, setForm] = useState({ name: '', class: '', fee_amount: '', parent_phone: '' })

  useEffect(() => { if (profile?.school_id) loadStudents() }, [profile])

  async function loadStudents() {
    if (!profile?.school_id) return
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('name')
      if (error) throw error
      setStudents(data ?? [])
    } catch {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.class.trim() || !form.fee_amount) {
      toast.error('Name, class and fee are required')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('students').insert({
        school_id: profile?.school_id,
        name: form.name.trim(),
        class: form.class.trim(),
        fee_amount: parseFloat(form.fee_amount),
        parent_phone: form.parent_phone.trim() || null,
      })
      if (error) throw error
      toast.success('Student added!')
      setShowModal(false)
      setForm({ name: '', class: '', fee_amount: '', parent_phone: '' })
      loadStudents()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(student: Student) {
    if (!confirm(`Remove "${student.name}"? This also removes all their fee records.`)) return
    setDeleting(student.id)
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id)
      if (error) throw error
      toast.success(`${student.name} removed`)
      loadStudents()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove student')
    } finally {
      setDeleting(null)
    }
  }

  // Derived data — no useEffect needed
  const availableClasses = [...new Set(students.map((s) => s.class))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )

  const filtered = students.filter((s) => {
    const q = search.toLowerCase().trim()
    const matchesSearch = !q || s.name.toLowerCase().includes(q)
    const matchesClass = !selectedClass || s.class === selectedClass
    return matchesSearch && matchesClass
  })

  const totalMonthlyRevenue = students.reduce((sum, s) => sum + Number(s.fee_amount), 0)
  const classRevenue = selectedClass
    ? students.filter((s) => s.class === selectedClass).reduce((sum, s) => sum + Number(s.fee_amount), 0)
    : null

  if (loading) return <LoadingSpinner fullPage text="Loading students..." />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} enrolled</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Add Student</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Filters row — only when there are students */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={selectedClass ? `Search in ${selectedClass}...` : 'Search by name…'}
              className="input-field pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Class filter */}
          <div className="relative sm:w-56">
            <ListFilter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input-field pl-9 appearance-none cursor-pointer"
            >
              <option value="">All Classes</option>
              {availableClasses.map((cls) => {
                const count = students.filter((s) => s.class === cls).length
                return (
                  <option key={cls} value={cls}>
                    {cls} ({count} student{count !== 1 ? 's' : ''})
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {(search || selectedClass) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Filters:</span>
          {selectedClass && (
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
              Class: {selectedClass}
              <button onClick={() => setSelectedClass('')} className="ml-0.5 hover:text-indigo-900">
                <X size={11} />
              </button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
              "{search}"
              <button onClick={() => setSearch('')} className="ml-0.5 hover:text-gray-900">
                <X size={11} />
              </button>
            </span>
          )}
          <span className="text-xs text-gray-400 ml-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Student List */}
      {students.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium text-lg">No students yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first student to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-5 mx-auto">
            <Plus size={16} /> Add First Student
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <Search size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">No students found</p>
          <p className="text-xs text-gray-400 mt-1">
            {selectedClass && search
              ? `No students named "${search}" in ${selectedClass}`
              : selectedClass
              ? `No students in ${selectedClass}`
              : `No students match "${search}"`}
          </p>
          <button
            onClick={() => { setSearch(''); setSelectedClass('') }}
            className="text-xs text-indigo-600 hover:underline mt-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          {/* Card header with view toggle */}
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-gray-900 text-sm truncate">
                {selectedClass ? `${selectedClass} Students` : 'All Students'}
              </h2>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {filtered.length}{filtered.length !== students.length ? ` / ${students.length}` : ''}
              </span>
            </div>
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title="List view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutList size={15} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>

          {/* List view */}
          {viewMode === 'list' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Monthly Fee</th>
                    <th>Phone</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-600 text-xs font-semibold">
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900 text-sm">{student.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                          {student.class}
                        </span>
                      </td>
                      <td className="font-semibold text-gray-900 text-sm">
                        {Number(student.fee_amount).toLocaleString()}
                      </td>
                      <td>
                        {student.parent_phone ? (
                          <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                            <Phone size={11} /> {student.parent_phone}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDelete(student)}
                          disabled={deleting === student.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {deleting === student.id
                            ? <div className="h-4 w-4 border border-gray-400 border-t-red-500 rounded-full animate-spin" />
                            : <Trash2 size={15} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grid view */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
              {filtered.map((student) => (
                <div
                  key={student.id}
                  className="relative bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2.5 hover:border-indigo-200 hover:shadow-sm transition-all"
                >
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(student)}
                    disabled={deleting === student.id}
                    className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove student"
                  >
                    {deleting === student.id
                      ? <div className="h-3.5 w-3.5 border border-gray-300 border-t-red-500 rounded-full animate-spin" />
                      : <Trash2 size={13} />}
                  </button>

                  {/* Avatar */}
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                    <span className="text-indigo-600 text-xl font-bold">
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Name */}
                  <p className="font-semibold text-gray-900 text-sm text-center leading-tight line-clamp-2 w-full">
                    {student.name}
                  </p>

                  {/* Class badge */}
                  <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-medium">
                    {student.class}
                  </span>

                  {/* Fee amount */}
                  <p className="text-base font-bold text-gray-900">
                    {Number(student.fee_amount).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revenue Footer */}
      {students.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-indigo-700 font-medium">
            {selectedClass ? `${selectedClass} Monthly Revenue` : 'Total Monthly Revenue'}
          </span>
          <span className="text-lg font-bold text-indigo-700">
            {(classRevenue ?? totalMonthlyRevenue).toLocaleString()}
          </span>
        </div>
      )}

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg">Add New Student</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name" className="input-field" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Class *</label>
                  <input type="text" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}
                    placeholder="e.g. Class 5" className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fee Amount *</label>
                  <input type="number" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
                    placeholder="Monthly fee" className="input-field" min="0" step="0.01" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Phone</label>
                <input type="tel" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                  placeholder="Optional contact number" className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving
                    ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                    : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
