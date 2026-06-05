import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { StudentWithFee, PaymentMethod } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import PaymentMethodModal, { PAYMENT_METHOD_CONFIG } from '../../components/PaymentMethodModal'
import { generateReceipt, generateSummaryReport } from '../../utils/pdf'
import {
  CheckCircle2, XCircle, Download, FileText, ChevronLeft, ChevronRight,
  Search, Filter, BadgeDollarSign, ListFilter, CheckCheck, Banknote, Smartphone,
} from 'lucide-react'
import toast from 'react-hot-toast'

type FilterType = 'all' | 'paid' | 'unpaid'

export default function FeesPage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<StudentWithFee[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingFee, setTogglingFee] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  // Payment modal state
  const [paymentStudent, setPaymentStudent] = useState<StudentWithFee | null>(null)
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    if (profile?.school_id) loadData()
  }, [profile, month, year])

  async function loadData() {
    if (!profile?.school_id) return
    try {
      const { data: studentsData, error: studentsErr } = await supabase
        .from('students').select('*').eq('school_id', profile.school_id).order('name')
      if (studentsErr) throw studentsErr

      const studentIds = (studentsData ?? []).map((s) => s.id)
      let feeMap: Record<string, import('../../types').FeeRecord> = {}

      if (studentIds.length > 0) {
        const { data: feeData } = await supabase
          .from('fee_records').select('*')
          .eq('school_id', profile.school_id)
          .eq('month', month).eq('year', year)
          .in('student_id', studentIds)
        feeMap = (feeData ?? []).reduce((m, r) => ({ ...m, [r.student_id]: r }), {})
      }

      setStudents((studentsData ?? []).map((s) => ({ ...s, fee_record: feeMap[s.id] ?? null })))
    } catch (err) {
      toast.error('Failed to load fees')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── Single student: initiate ──────────────────────────────────────────────
  function handleToggle(student: StudentWithFee) {
    if (student.fee_record?.paid) {
      // Marking unpaid — no modal needed
      markUnpaid(student)
    } else {
      // Marking paid — show payment modal
      setPaymentStudent(student)
    }
  }

  async function markUnpaid(student: StudentWithFee) {
    setTogglingFee(student.id)
    try {
      if (student.fee_record) {
        const { error } = await supabase
          .from('fee_records')
          .update({ paid: false, paid_date: null, payment_method: null })
          .eq('id', student.fee_record.id)
        if (error) throw error
      }
      toast.success('Marked as unpaid')
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fee')
    } finally {
      setTogglingFee(null)
    }
  }

  async function markPaid(student: StudentWithFee, method: PaymentMethod) {
    setPaymentStudent(null)
    setTogglingFee(student.id)
    try {
      const paidDate = new Date().toISOString()
      if (student.fee_record) {
        const { error } = await supabase
          .from('fee_records')
          .update({ paid: true, paid_date: paidDate, payment_method: method })
          .eq('id', student.fee_record.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fee_records').insert({
          student_id: student.id,
          school_id: profile?.school_id,
          month, year,
          paid: true,
          paid_date: paidDate,
          payment_method: method,
        })
        if (error) throw error
      }
      const label = PAYMENT_METHOD_CONFIG[method].label
      toast.success(`Fee collected · ${label} ✓`)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fee')
    } finally {
      setTogglingFee(null)
    }
  }

  // ── Bulk payment ──────────────────────────────────────────────────────────
  function handleMarkAllPaid() {
    const unpaid = classFilteredStudents.filter((s) => !s.fee_record?.paid)
    if (unpaid.length === 0) {
      toast('All students in this class are already paid!', { icon: '✓' })
      return
    }
    setBulkPaymentOpen(true)
  }

  async function executeBulkPaid(method: PaymentMethod) {
    setBulkPaymentOpen(false)
    const unpaid = classFilteredStudents.filter((s) => !s.fee_record?.paid)
    setMarkingAllPaid(true)
    try {
      const paidDate = new Date().toISOString()
      const toUpdate = unpaid.filter((s) => s.fee_record !== null)
      const toInsert = unpaid.filter((s) => s.fee_record === null)

      if (toUpdate.length > 0) {
        const { error } = await supabase.from('fee_records')
          .update({ paid: true, paid_date: paidDate, payment_method: method })
          .in('id', toUpdate.map((s) => s.fee_record!.id))
        if (error) throw error
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from('fee_records').insert(
          toInsert.map((s) => ({
            student_id: s.id, school_id: profile?.school_id,
            month, year, paid: true, paid_date: paidDate, payment_method: method,
          }))
        )
        if (error) throw error
      }

      const label = PAYMENT_METHOD_CONFIG[method].label
      toast.success(`${unpaid.length} student${unpaid.length !== 1 ? 's' : ''} marked as paid · ${label}`)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setMarkingAllPaid(false)
    }
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  async function handleDownloadReceipt(student: StudentWithFee) {
    if (!student.fee_record?.paid) { toast.error('Fee not paid yet'); return }
    setGeneratingPdf(student.id)
    try {
      await generateReceipt({ student, schoolName: profile?.schools?.name ?? 'School', month, year })
      toast.success('Receipt downloaded!')
    } catch { toast.error('Failed to generate receipt') }
    finally { setGeneratingPdf(null) }
  }

  async function handleDownloadSummary() {
    setGeneratingPdf('summary')
    try {
      await generateSummaryReport({ students, schoolName: profile?.schools?.name ?? 'School', month, year })
      toast.success('Summary report downloaded!')
    } catch { toast.error('Failed to generate report') }
    finally { setGeneratingPdf(null) }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function changeMonth(dir: number) {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y); setSelectedClass(''); setFilter('all')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const availableClasses = [...new Set(students.map((s) => s.class))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )
  const classFilteredStudents = selectedClass ? students.filter((s) => s.class === selectedClass) : students
  const paidStudents   = classFilteredStudents.filter((s) =>  s.fee_record?.paid)
  const unpaidStudents = classFilteredStudents.filter((s) => !s.fee_record?.paid)
  const totalExpected  = students.reduce((s, st) => s + Number(st.fee_amount), 0)
  const totalCollected = students.filter((s) => s.fee_record?.paid).reduce((s, st) => s + Number(st.fee_amount), 0)
  const classUnpaidCount = unpaidStudents.length
  const allClassPaid = classFilteredStudents.length > 0 && classUnpaidCount === 0
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const displayStudents = classFilteredStudents.filter((s) => {
    const q = search.toLowerCase()
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.class.toLowerCase().includes(q)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'paid'   && s.fee_record?.paid) ||
      (filter === 'unpaid' && !s.fee_record?.paid)
    return matchesSearch && matchesFilter
  })

  if (loading) return <LoadingSpinner fullPage text="Loading fee records..." />

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fee Collection</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profile?.schools?.name}</p>
        </div>
        <button
          onClick={handleDownloadSummary}
          disabled={generatingPdf === 'summary' || students.length === 0}
          className="btn-secondary text-xs sm:text-sm"
        >
          {generatingPdf === 'summary'
            ? <div className="h-4 w-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
            : <Download size={15} />}
          <span className="hidden sm:inline">Monthly Report</span>
          <span className="sm:hidden">Report</span>
        </button>
      </div>

      {/* Month Selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-900 text-lg">{monthName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{paidStudents.length}/{students.length} paid</p>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Collection progress</span>
            <span>{totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}%</span>
          </div>
          <div className="bg-gray-200 rounded-full h-2.5">
            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: totalExpected > 0 ? `${(totalCollected / totalExpected) * 100}%` : '0%' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">{totalExpected.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Expected</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-green-600">{totalCollected.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Collected</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-500">{(totalExpected - totalCollected).toLocaleString()}</p>
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
              onChange={(e) => { setSelectedClass(e.target.value); setFilter('all') }}
              className="input-field pl-9 text-sm appearance-none cursor-pointer"
            >
              <option value="">All Classes ({students.length} students)</option>
              {availableClasses.map((cls) => {
                const total = students.filter((s) => s.class === cls).length
                const paid  = students.filter((s) => s.class === cls && s.fee_record?.paid).length
                return <option key={cls} value={cls}>{cls} — {paid}/{total} paid</option>
              })}
            </select>
          </div>
          {selectedClass && (
            <button
              onClick={handleMarkAllPaid}
              disabled={markingAllPaid || allClassPaid}
              className={`btn-success text-sm flex-shrink-0 ${allClassPaid ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {markingAllPaid
                ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Marking...</>
                : allClassPaid
                ? <><CheckCheck size={15} /> All Paid</>
                : <><CheckCheck size={15} /> Mark All Paid ({classUnpaidCount})</>}
            </button>
          )}
        </div>
      )}

      {/* Search + Payment Filter */}
      {students.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={selectedClass ? `Search in ${selectedClass}...` : 'Search students...'}
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['all', 'paid', 'unpaid'] as FilterType[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all'    ? `All (${classFilteredStudents.length})`
                : f === 'paid'  ? `Paid (${paidStudents.length})`
                :                 `Unpaid (${unpaidStudents.length})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Student Fee Cards */}
      {students.length === 0 ? (
        <div className="card text-center py-12">
          <BadgeDollarSign size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No students enrolled</p>
          <p className="text-xs text-gray-400 mt-1">Add students first from the Students page</p>
        </div>
      ) : displayStudents.length === 0 ? (
        <div className="card text-center py-8">
          <Filter size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            {selectedClass && classFilteredStudents.length === 0 ? `No students in ${selectedClass}` : 'No students match your filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayStudents.map((student) => {
            const paid       = student.fee_record?.paid ?? false
            const isToggling = togglingFee === student.id
            const isGenerating = generatingPdf === student.id
            const paidDate   = student.fee_record?.paid_date
              ? new Date(student.fee_record.paid_date).toLocaleDateString() : null
            const payMethod  = student.fee_record?.payment_method ?? null

            return (
              <div
                key={student.id}
                className={`bg-white rounded-xl border transition-all p-4 ${paid ? 'border-green-200' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${paid ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <span className={`text-sm font-bold ${paid ? 'text-green-700' : 'text-gray-600'}`}>
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{student.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{student.class}</span>
                      {paid
                        ? <span className="badge-paid"><CheckCircle2 size={10} /> Paid</span>
                        : <span className="badge-unpaid"><XCircle size={10} /> Unpaid</span>}
                      {/* Payment method badge */}
                      {paid && payMethod && (
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                          payMethod === 'cash'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {payMethod === 'cash'
                            ? <><Banknote size={10} /> Cash</>
                            : <><Smartphone size={10} /> Online</>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-gray-900">{Number(student.fee_amount).toLocaleString()}</span>
                      {paidDate && <span className="text-xs text-green-600">• Paid {paidDate}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {paid && (
                      <button
                        onClick={() => handleDownloadReceipt(student)}
                        disabled={isGenerating}
                        className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Download receipt"
                      >
                        {isGenerating
                          ? <div className="h-4 w-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                          : <FileText size={16} />}
                      </button>
                    )}
                    <button
                      onClick={() => handleToggle(student)}
                      disabled={isToggling}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        paid ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {isToggling
                        ? <div className="h-3.5 w-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                        : paid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Single student payment modal */}
      {paymentStudent && (
        <PaymentMethodModal
          studentName={paymentStudent.name}
          feeAmount={Number(paymentStudent.fee_amount)}
          onConfirm={(method) => markPaid(paymentStudent, method)}
          onCancel={() => setPaymentStudent(null)}
        />
      )}

      {/* Bulk payment modal */}
      {bulkPaymentOpen && (
        <PaymentMethodModal
          isBulk
          bulkCount={classFilteredStudents.filter((s) => !s.fee_record?.paid).length}
          onConfirm={executeBulkPaid}
          onCancel={() => setBulkPaymentOpen(false)}
        />
      )}
    </div>
  )
}
