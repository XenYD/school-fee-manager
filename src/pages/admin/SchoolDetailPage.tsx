import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { School, Student, StudentWithFee } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { parseExcel, downloadExcelTemplate } from '../../utils/excel'
import {
  ArrowLeft, Upload, CheckCircle2, XCircle, Plus, Trash2, X,
  FileSpreadsheet, GraduationCap, ChevronLeft, ChevronRight, Download,
  ListFilter, CheckCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [school, setSchool] = useState<School | null>(null)
  const [students, setStudents] = useState<StudentWithFee[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', class: '', fee_amount: '', parent_phone: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [togglingFee, setTogglingFee] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => { if (id) loadData() }, [id, month, year])

  async function loadData() {
    try {
      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools').select('*').eq('id', id).single()
      if (schoolErr) throw schoolErr
      setSchool(schoolData)

      const { data: studentsData, error: studentsErr } = await supabase
        .from('students').select('*').eq('school_id', id).order('name')
      if (studentsErr) throw studentsErr

      const studentIds = (studentsData ?? []).map((s) => s.id)
      let feeMap: Record<string, import('../../types').FeeRecord> = {}

      if (studentIds.length > 0) {
        const { data: feeData } = await supabase
          .from('fee_records')
          .select('*')
          .eq('school_id', id)
          .eq('month', month)
          .eq('year', year)
          .in('student_id', studentIds)

        feeMap = (feeData ?? []).reduce((m, r) => ({ ...m, [r.student_id]: r }), {})
      }

      setStudents((studentsData ?? []).map((s) => ({ ...s, fee_record: feeMap[s.id] ?? null })))
    } catch (err) {
      toast.error('Failed to load school data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleFee(student: StudentWithFee) {
    setTogglingFee(student.id)
    try {
      const isPaid = student.fee_record?.paid ?? false
      if (isPaid && student.fee_record) {
        const { error } = await supabase
          .from('fee_records')
          .update({ paid: false, paid_date: null })
          .eq('id', student.fee_record.id)
        if (error) throw error
      } else if (student.fee_record) {
        const { error } = await supabase
          .from('fee_records')
          .update({ paid: true, paid_date: new Date().toISOString() })
          .eq('id', student.fee_record.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fee_records').insert({
          student_id: student.id,
          school_id: id,
          month,
          year,
          paid: true,
          paid_date: new Date().toISOString(),
        })
        if (error) throw error
      }
      toast.success(isPaid ? 'Marked as unpaid' : 'Marked as paid')
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fee')
    } finally {
      setTogglingFee(null)
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.class.trim() || !addForm.fee_amount) {
      toast.error('Name, class and fee amount are required')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('students').insert({
        school_id: id,
        name: addForm.name.trim(),
        class: addForm.class.trim(),
        fee_amount: parseFloat(addForm.fee_amount),
        parent_phone: addForm.parent_phone.trim() || null,
      })
      if (error) throw error
      toast.success('Student added successfully')
      setShowAddModal(false)
      setAddForm({ name: '', class: '', fee_amount: '', parent_phone: '' })
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(student: Student) {
    if (!confirm(`Remove "${student.name}"? This will delete all fee records for this student.`)) return
    setDeleting(student.id)
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id)
      if (error) throw error
      toast.success(`${student.name} removed`)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove student')
    } finally {
      setDeleting(null)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseExcel(file)
      if (rows.length === 0) { toast.error('No valid rows found in file'); return }

      const inserts = rows.map((r) => ({
        school_id: id,
        name: r.name,
        class: r.class,
        fee_amount: r.fee_amount,
        parent_phone: r.parent_phone || null,
      }))

      const { error } = await supabase.from('students').insert(inserts)
      if (error) throw error
      toast.success(`${rows.length} students imported successfully`)
      setShowImportModal(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function changeMonth(dir: number) {
    let m = month + dir
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setMonth(m)
    setYear(y)
    setSelectedClass('')
  }

  async function markAllPaid() {
    const unpaid = displayStudents.filter((s) => !s.fee_record?.paid)
    if (unpaid.length === 0) {
      toast('All students in this class are already paid!', { icon: '✓' })
      return
    }
    if (!confirm(`Mark all ${unpaid.length} unpaid student${unpaid.length !== 1 ? 's' : ''} in "${selectedClass}" as paid for ${monthName}?`)) return

    setMarkingAllPaid(true)
    try {
      const now = new Date().toISOString()

      const toUpdate = unpaid.filter((s) => s.fee_record !== null)
      const toInsert = unpaid.filter((s) => s.fee_record === null)

      if (toUpdate.length > 0) {
        const { error } = await supabase
          .from('fee_records')
          .update({ paid: true, paid_date: now })
          .in('id', toUpdate.map((s) => s.fee_record!.id))
        if (error) throw error
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('fee_records').insert(
          toInsert.map((s) => ({
            student_id: s.id,
            school_id: id,
            month,
            year,
            paid: true,
            paid_date: now,
          }))
        )
        if (error) throw error
      }

      toast.success(`${unpaid.length} student${unpaid.length !== 1 ? 's' : ''} marked as paid!`)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setMarkingAllPaid(false)
    }
  }

  const availableClasses = [...new Set(students.map((s) => s.class))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )

  const displayStudents = selectedClass
    ? students.filter((s) => s.class === selectedClass)
    : students

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const paidCount = students.filter((s) => s.fee_record?.paid).length
  const totalExpected = students.reduce((s, st) => s + Number(st.fee_amount), 0)
  const totalCollected = students.filter((s) => s.fee_record?.paid).reduce((s, st) => s + Number(st.fee_amount), 0)

  const classUnpaidCount = displayStudents.filter((s) => !s.fee_record?.paid).length
  const allClassPaid = displayStudents.length > 0 && classUnpaidCount === 0

  if (loading) return <LoadingSpinner fullPage text="Loading..." />
  if (!school) return <div className="text-center py-12 text-gray-500">School not found</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link to="/admin/schools" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-3">
          <ArrowLeft size={14} /> Back to Schools
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{school.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{students.length} students enrolled</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImportModal(true)} className="btn-secondary text-xs sm:text-sm">
              <FileSpreadsheet size={15} />
              <span className="hidden sm:inline">Import Excel</span>
              <span className="sm:hidden">Import</span>
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs sm:text-sm">
              <Plus size={15} />
              <span className="hidden sm:inline">Add Student</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Month Selector + Stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{monthName}</p>
            <p className="text-xs text-gray-500">{paidCount}/{students.length} paid</p>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{totalExpected.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Expected</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{totalCollected.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Collected</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-red-500">{(totalExpected - totalCollected).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>
      </div>

      {/* Class Filter + Bulk Action */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <ListFilter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input-field pl-9 text-sm appearance-none cursor-pointer"
            >
              <option value="">All Classes ({students.length} students)</option>
              {availableClasses.map((cls) => {
                const total = students.filter((s) => s.class === cls).length
                const paid = students.filter((s) => s.class === cls && s.fee_record?.paid).length
                return (
                  <option key={cls} value={cls}>
                    {cls} — {paid}/{total} paid
                  </option>
                )
              })}
            </select>
          </div>
          {selectedClass && (
            <button
              onClick={markAllPaid}
              disabled={markingAllPaid || allClassPaid}
              className={`btn-success text-sm flex-shrink-0 ${allClassPaid ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {markingAllPaid ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Marking...</>
              ) : allClassPaid ? (
                <><CheckCheck size={15} /> All Paid</>
              ) : (
                <><CheckCheck size={15} /> Mark All Paid ({classUnpaidCount})</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Students Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">
            {selectedClass ? `${selectedClass} Students` : 'Students & Fees'}
          </h2>
          <span className="text-xs text-gray-500">
            {displayStudents.length}{selectedClass && students.length !== displayStudents.length ? ` of ${students.length}` : ''} total
          </span>
        </div>
        {students.length === 0 ? (
          <div className="text-center py-10 px-4">
            <GraduationCap size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No students enrolled</p>
            <p className="text-sm text-gray-400 mt-1">Add students manually or import from Excel</p>
          </div>
        ) : displayStudents.length === 0 ? (
          <div className="text-center py-8 px-4">
            <ListFilter size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No students in this class</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayStudents.map((student) => {
                  const paid = student.fee_record?.paid ?? false
                  return (
                    <tr key={student.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{student.name}</p>
                          {student.parent_phone && (
                            <p className="text-xs text-gray-400">{student.parent_phone}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                          {student.class}
                        </span>
                      </td>
                      <td className="font-medium text-sm">{Number(student.fee_amount).toLocaleString()}</td>
                      <td>
                        {paid ? (
                          <span className="badge-paid">
                            <CheckCircle2 size={11} /> Paid
                          </span>
                        ) : (
                          <span className="badge-unpaid">
                            <XCircle size={11} /> Unpaid
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => toggleFee(student)}
                            disabled={togglingFee === student.id}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                              paid
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}
                          >
                            {togglingFee === student.id
                              ? <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                              : paid ? 'Unpaid' : 'Paid'}
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            disabled={deleting === student.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            {deleting === student.id
                              ? <div className="h-3.5 w-3.5 border border-gray-400 border-t-red-500 rounded-full animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg">Add Student</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Name *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Full name" className="input-field" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Class *</label>
                  <input type="text" value={addForm.class} onChange={(e) => setAddForm({ ...addForm, class: e.target.value })}
                    placeholder="e.g. 5A" className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fee Amount *</label>
                  <input type="number" value={addForm.fee_amount} onChange={(e) => setAddForm({ ...addForm, fee_amount: e.target.value })}
                    placeholder="0" className="input-field" min="0" step="0.01" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Phone</label>
                <input type="tel" value={addForm.parent_phone} onChange={(e) => setAddForm({ ...addForm, parent_phone: e.target.value })}
                  placeholder="Optional" className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg">Import from Excel</h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">Excel File Format</p>
                <p className="text-xs mb-2">Your file must have these columns (in any order):</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="bg-white rounded px-2 py-1 border border-blue-200">Student Name</span>
                  <span className="bg-white rounded px-2 py-1 border border-blue-200">Class</span>
                  <span className="bg-white rounded px-2 py-1 border border-blue-200">Fee Amount</span>
                  <span className="bg-white rounded px-2 py-1 border border-blue-200">Parent Phone</span>
                </div>
              </div>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={28} className="text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Click to select Excel file</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx or .xls files only</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
              </div>
              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm text-indigo-600 font-medium hover:underline"
              >
                <Download size={14} /> Download sample template
              </button>
              <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary w-full">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
