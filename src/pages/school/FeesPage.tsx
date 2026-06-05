import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type {
  StudentWithFee, FeeRecord, FeeType, PaymentMethod, FeeStatus,
} from '../../types'
import {
  CLASS_LIST, FEE_TYPE_LABELS, getDaysOverdue, getPeriodDueDate,
  getPeriodLabel, getInitialPeriodMonth,
} from '../../types'
import PaymentModal from '../../components/PaymentModal'
import PaymentHistoryModal from '../../components/PaymentHistoryModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import { generateReceipt, generateDefaultersReport, generateSummaryReport } from '../../utils/pdf'
import { exportDefaultersExcel, exportMonthlyReportExcel } from '../../utils/excel'
import toast from 'react-hot-toast'
import {
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft, ChevronRight,
  Search, X, Phone, FileText, LayoutList, LayoutGrid, Download,
  TrendingUp, Users, BookOpen, FileDown, Table2, BarChart3,
} from 'lucide-react'

type TabType = 'fees' | 'defaulters' | 'summary'
type FilterType = 'all' | 'paid' | 'partial' | 'unpaid'

interface PaymentTarget {
  student: StudentWithFee
  feeType: FeeType
  record: FeeRecord | null
}

interface HistoryTarget {
  record: FeeRecord
  student: StudentWithFee
}

export default function FeesPage() {
  const { profile } = useAuth()
  const resetType = profile?.schools?.fee_reset_type ?? 'monthly'

  const [students, setStudents] = useState<StudentWithFee[]>([])
  const [loading, setLoading] = useState(true)
  const [periodMonth, setPeriodMonth] = useState(() => getInitialPeriodMonth(profile?.schools?.fee_reset_type ?? 'monthly'))
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear())

  const [activeTab, setActiveTab] = useState<TabType>('fees')
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null)
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null)
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  const schoolId = profile?.school_id
  const schoolName = profile?.schools?.name ?? 'School'

  const loadData = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    try {
      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .order('name')
      if (sErr) throw sErr

      const ids = (studentsData ?? []).map((s) => s.id)
      let feeRecords: FeeRecord[] = []
      if (ids.length > 0) {
        const { data: frData, error: frErr } = await supabase
          .from('fee_records')
          .select('*')
          .eq('school_id', schoolId)
          .eq('month', periodMonth)
          .eq('year', periodYear)
          .in('student_id', ids)
        if (frErr) throw frErr
        feeRecords = frData ?? []
      }

      const feeMap: Record<string, FeeRecord> = {}
      for (const fr of feeRecords) {
        feeMap[`${fr.student_id}_${fr.fee_type}`] = fr
      }

      setStudents(
        (studentsData ?? []).map((s) => ({
          ...s,
          school_fee_record: feeMap[`${s.id}_school_fee`] ?? null,
          exam_fee_record: feeMap[`${s.id}_exam_fee`] ?? null,
        }))
      )
    } catch {
      toast.error('Failed to load fee data')
    } finally {
      setLoading(false)
    }
  }, [schoolId, periodMonth, periodYear])

  useEffect(() => { loadData() }, [loadData])

  function changePeriod(dir: number) {
    const step = resetType === 'term' ? 3 : 1
    let m = periodMonth + dir * step
    let y = periodYear
    while (m > 12) { m -= 12; y++ }
    while (m < 1)  { m += 12; y-- }
    setPeriodMonth(m)
    setPeriodYear(y)
    setSelectedClass('')
    setFilter('all')
  }

  async function handlePayment(amount: number, method: PaymentMethod) {
    if (!paymentTarget) return
    const { student, feeType, record } = paymentTarget
    setPaymentTarget(null)

    const key = `${student.id}_${feeType}`
    setProcessingId(key)

    try {
      let recordId = record?.id
      let currentDue = record?.due_amount ?? (feeType === 'school_fee' ? Number(student.fee_amount) : Number(student.exam_fee_amount))
      let currentPaid = record?.paid_amount ?? 0

      if (!record) {
        const { data: newRec, error } = await supabase
          .from('fee_records')
          .insert({
            student_id: student.id,
            school_id: schoolId,
            month: periodMonth, year: periodYear,
            fee_type: feeType,
            due_amount: currentDue,
            paid_amount: 0,
            status: 'unpaid',
            due_date: getPeriodDueDate(periodMonth, periodYear),
            paid_by: profile?.id,
          })
          .select()
          .single()
        if (error) throw error
        recordId = newRec.id
      }

      const { error: txErr } = await supabase.from('payment_transactions').insert({
        fee_record_id: recordId,
        student_id: student.id,
        school_id: schoolId,
        amount,
        payment_method: method,
        paid_by: profile?.id,
      })
      if (txErr) throw txErr

      const newPaid = currentPaid + amount
      const newStatus: FeeStatus = newPaid >= currentDue ? 'paid' : 'partial'

      const { error: upErr } = await supabase
        .from('fee_records')
        .update({ paid_amount: newPaid, status: newStatus, paid_by: profile?.id })
        .eq('id', recordId)
      if (upErr) throw upErr

      toast.success(newStatus === 'paid' ? `Fully paid · ${method === 'cash' ? 'Cash' : 'Online'}` : `Partial recorded · ${method === 'cash' ? 'Cash' : 'Online'}`)

      // Auto-generate receipt
      generateReceipt({
        schoolName,
        studentName: student.name,
        studentClass: student.class,
        parentPhone: student.parent_phone,
        feeType,
        dueAmount: currentDue,
        amountPaid: amount,
        totalPaidSoFar: newPaid,
        remaining: currentDue - newPaid,
        paymentMethod: method,
        month: periodMonth,
        year: periodYear,
        periodLabel: getPeriodLabel(periodMonth, periodYear, resetType),
        resetType,
      })

      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessingId(null)
    }
  }

  async function executeBulkPaid(method: PaymentMethod) {
    setBulkPaymentOpen(false)
    const targets = classFilteredStudents.filter(
      (s) => (s.school_fee_record?.status ?? 'unpaid') !== 'paid' && Number(s.fee_amount) > 0
    )
    if (targets.length === 0) { toast('No unpaid students'); return }

    setMarkingAllPaid(true)
    try {
      for (const student of targets) {
        const record = student.school_fee_record
        const dueAmount = record?.due_amount ?? Number(student.fee_amount)
        const paidAlready = record?.paid_amount ?? 0
        const payAmount = dueAmount - paidAlready
        if (payAmount <= 0) continue

        let recordId = record?.id
        if (!record) {
          const { data: nr, error } = await supabase
            .from('fee_records')
            .insert({
              student_id: student.id, school_id: schoolId,
              month: periodMonth, year: periodYear,
              fee_type: 'school_fee', due_amount: dueAmount, paid_amount: 0,
              status: 'unpaid', due_date: getPeriodDueDate(periodMonth, periodYear),
              paid_by: profile?.id,
            })
            .select().single()
          if (error) throw error
          recordId = nr.id
        }

        await supabase.from('payment_transactions').insert({
          fee_record_id: recordId, student_id: student.id, school_id: schoolId,
          amount: payAmount, payment_method: method, paid_by: profile?.id,
        })
        await supabase.from('fee_records')
          .update({ paid_amount: dueAmount, status: 'paid', paid_by: profile?.id })
          .eq('id', recordId)
      }
      toast.success(`${targets.length} student${targets.length !== 1 ? 's' : ''} marked paid · ${method === 'cash' ? 'Cash' : 'Online'}`)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk payment failed')
    } finally {
      setMarkingAllPaid(false)
    }
  }

  async function handleMarkUnpaid(student: StudentWithFee, feeType: FeeType) {
    const record = feeType === 'school_fee' ? student.school_fee_record : student.exam_fee_record
    if (!record || record.status === 'unpaid') return
    if (!confirm(`Reset ${student.name}'s ${FEE_TYPE_LABELS[feeType]} to unpaid? This deletes all payment records.`)) return
    const key = `${student.id}_${feeType}`
    setProcessingId(key)
    try {
      await supabase.from('payment_transactions').delete().eq('fee_record_id', record.id)
      await supabase.from('fee_records').update({ paid_amount: 0, status: 'unpaid' }).eq('id', record.id)
      toast.success('Reset to unpaid')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleDownloadReceipt(student: StudentWithFee, feeType: FeeType) {
    const record = feeType === 'school_fee' ? student.school_fee_record : student.exam_fee_record
    if (!record) return
    const key = `${student.id}_${feeType}_receipt`
    setGeneratingPdf(key)
    try {
      generateReceipt({
        schoolName, studentName: student.name, studentClass: student.class,
        parentPhone: student.parent_phone, feeType,
        dueAmount: Number(record.due_amount), amountPaid: Number(record.paid_amount),
        totalPaidSoFar: Number(record.paid_amount),
        remaining: Number(record.due_amount) - Number(record.paid_amount),
        paymentMethod: 'cash',
        month: periodMonth, year: periodYear,
        periodLabel: getPeriodLabel(periodMonth, periodYear, resetType), resetType,
      })
    } finally {
      setGeneratingPdf(null)
    }
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const availableClasses = Array.from(new Set(students.map((s) => s.class)))
    .sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, ''), 10)
      const bNum = parseInt(b.replace(/\D/g, ''), 10)
      return (isNaN(aNum) || isNaN(bNum)) ? a.localeCompare(b) : aNum - bNum
    })

  const classFilteredStudents = selectedClass
    ? students.filter((s) => s.class === selectedClass)
    : students

  const displayStudents = classFilteredStudents.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'all') return true
    const sfStatus = s.school_fee_record?.status ?? 'unpaid'
    const efStatus = s.exam_fee_record?.status ?? 'unpaid'
    if (filter === 'paid') return sfStatus === 'paid' && (Number(s.exam_fee_amount) === 0 || efStatus === 'paid')
    if (filter === 'partial') return sfStatus === 'partial' || efStatus === 'partial'
    if (filter === 'unpaid') return sfStatus === 'unpaid' || (Number(s.exam_fee_amount) > 0 && efStatus === 'unpaid')
    return true
  })

  const defaulters = students.filter((s) => {
    const sfUnpaid = Number(s.fee_amount) > 0 && (s.school_fee_record?.status ?? 'unpaid') !== 'paid'
    const efUnpaid = Number(s.exam_fee_amount) > 0 && (s.exam_fee_record?.status ?? 'unpaid') !== 'paid'
    return sfUnpaid || efUnpaid
  })

  const classSummary = availableClasses.map((cls) => {
    const cs = students.filter((s) => s.class === cls)
    return {
      className: cls,
      students: cs.length,
      schoolFeeExpected: cs.reduce((sum, s) => sum + Number(s.fee_amount), 0),
      schoolFeeCollected: cs.reduce((sum, s) => sum + Number(s.school_fee_record?.paid_amount ?? 0), 0),
      examFeeExpected: cs.reduce((sum, s) => sum + Number(s.exam_fee_amount), 0),
      examFeeCollected: cs.reduce((sum, s) => sum + Number(s.exam_fee_record?.paid_amount ?? 0), 0),
    }
  })

  const totalExpected =
    students.reduce((s, st) => s + Number(st.fee_amount), 0) +
    students.reduce((s, st) => s + Number(st.exam_fee_amount), 0)
  const totalCollected =
    students.reduce((s, st) => s + Number(st.school_fee_record?.paid_amount ?? 0), 0) +
    students.reduce((s, st) => s + Number(st.exam_fee_record?.paid_amount ?? 0), 0)
  const totalPending = totalExpected - totalCollected
  const collectionPct = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0

  const unpaidForClass = selectedClass
    ? classFilteredStudents.filter((s) => (s.school_fee_record?.status ?? 'unpaid') !== 'paid' && Number(s.fee_amount) > 0).length
    : 0

  const periodStr = getPeriodLabel(periodMonth, periodYear, resetType)

  // ─── Export handlers ───────────────────────────────────────────────────────

  function buildDefaulterEntries() {
    const entries: Parameters<typeof exportDefaultersExcel>[0] = []
    for (const s of defaulters) {
      if (Number(s.fee_amount) > 0 && (s.school_fee_record?.status ?? 'unpaid') !== 'paid') {
        const rec = s.school_fee_record
        const due = rec?.due_amount ?? Number(s.fee_amount)
        const paid = rec?.paid_amount ?? 0
        entries.push({
          name: s.name, studentClass: s.class, feeType: 'school_fee',
          dueAmount: due, paidAmount: paid, remaining: due - paid,
          daysOverdue: getDaysOverdue(rec, periodMonth, periodYear),
          status: rec?.status ?? 'unpaid', parentPhone: s.parent_phone,
        })
      }
      if (Number(s.exam_fee_amount) > 0 && (s.exam_fee_record?.status ?? 'unpaid') !== 'paid') {
        const rec = s.exam_fee_record
        const due = rec?.due_amount ?? Number(s.exam_fee_amount)
        const paid = rec?.paid_amount ?? 0
        entries.push({
          name: s.name, studentClass: s.class, feeType: 'exam_fee',
          dueAmount: due, paidAmount: paid, remaining: due - paid,
          daysOverdue: getDaysOverdue(rec, periodMonth, periodYear),
          status: rec?.status ?? 'unpaid', parentPhone: s.parent_phone,
        })
      }
    }
    return entries
  }

  function handleExportDefaultersPdf() {
    const entries = buildDefaulterEntries()
    if (entries.length === 0) { toast('No defaulters to export'); return }
    generateDefaultersReport({ defaulters: entries, schoolName, month: periodMonth, year: periodYear, periodLabel: periodStr })
  }

  function handleExportDefaultersExcel() {
    const entries = buildDefaulterEntries()
    if (entries.length === 0) { toast('No defaulters to export'); return }
    exportDefaultersExcel(entries, schoolName, periodMonth, periodYear, periodStr)
    toast.success('Excel downloaded')
  }

  function handleExportMonthlyPdf() {
    generateSummaryReport({
      schoolName, month: periodMonth, year: periodYear, periodLabel: periodStr,
      totalStudents: students.length, totalExpected, totalCollected, totalPending,
      classSummary,
    })
  }

  function handleExportMonthlyExcel() {
    exportMonthlyReportExcel({
      schoolName, month: periodMonth, year: periodYear, periodLabel: periodStr,
      totalStudents: students.length, totalExpected, totalCollected, totalPending,
      classSummary, defaulters: buildDefaulterEntries(),
    })
    toast.success('Excel downloaded')
  }

  if (loading) return <LoadingSpinner fullPage text="Loading fees..." />

  if (!schoolId) {
    return (
      <div className="card text-center py-16">
        <AlertCircle size={48} className="text-amber-400 mx-auto mb-4" />
        <p className="text-gray-700 font-semibold text-lg">No school assigned</p>
        <p className="text-gray-400 text-sm mt-1">Ask your admin to assign a school to your account.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fee Collection</h1>
          <p className="text-sm text-gray-500 mt-0.5">{schoolName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExportMonthlyPdf}
            className="btn-secondary text-xs py-2 hidden sm:flex"
            title="Export PDF Report"
          >
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={handleExportMonthlyExcel}
            className="btn-secondary text-xs py-2 hidden sm:flex"
            title="Export Excel Report"
          >
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Period Navigator */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => changePeriod(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-900">{periodStr}</p>
          <p className="text-xs text-gray-400">
            {resetType === 'term' ? 'Term-based' : 'Monthly'} cycle
          </p>
        </div>
        <button
          onClick={() => changePeriod(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Students', value: students.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Expected', value: `Rs ${totalExpected.toLocaleString()}`, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Collected', value: `Rs ${totalCollected.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending', value: `Rs ${totalPending.toLocaleString()}`, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon size={15} className={color} />
            </div>
            <p className="font-bold text-gray-900 text-base leading-tight">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Collection Progress</span>
          <span className="font-semibold text-gray-700">{collectionPct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${collectionPct >= 80 ? 'bg-green-500' : collectionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${collectionPct}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(
            [
              { id: 'fees', label: 'Fees', icon: BookOpen, count: null },
              { id: 'defaulters', label: 'Defaulters', icon: AlertCircle, count: defaulters.length },
              { id: 'summary', label: 'Class Summary', icon: BarChart3, count: null },
            ] as const
          ).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              <span className="hidden xs:inline">{label}</span>
              {count !== null && count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-600'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Fees Tab ── */}
        {activeTab === 'fees' && (
          <div className="p-4 space-y-4">
            {/* Controls row */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Class filter */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input-field py-2 text-sm flex-1 min-w-[130px] max-w-[180px]"
              >
                <option value="">All Classes</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Mark All Paid button */}
              {selectedClass && unpaidForClass > 0 && (
                <button
                  onClick={() => setBulkPaymentOpen(true)}
                  disabled={markingAllPaid}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {markingAllPaid ? (
                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Mark All Paid ({unpaidForClass})
                </button>
              )}

              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student..."
                  className="input-field pl-8 py-2 text-sm w-full"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="List view"
                >
                  <LayoutList size={15} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>

            {/* Status filter pills */}
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'paid', label: 'Paid' },
                  { id: 'partial', label: 'Partial' },
                  { id: 'unpaid', label: 'Unpaid' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    filter === id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Student list */}
            {students.length === 0 ? (
              <div className="text-center py-12">
                <Users size={36} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No students added yet</p>
              </div>
            ) : displayStudents.length === 0 ? (
              <div className="text-center py-10">
                <Search size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No students match your filters</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {displayStudents.map((student) => (
                  <StudentFeeCard
                    key={student.id}
                    student={student}
                    periodMonth={periodMonth}
                    periodYear={periodYear}
                    processingId={processingId}
                    generatingPdf={generatingPdf}
                    onPay={(s, ft, rec) => setPaymentTarget({ student: s, feeType: ft, record: rec })}
                    onMarkUnpaid={handleMarkUnpaid}
                    onHistory={(rec, s) => setHistoryTarget({ record: rec, student: s })}
                    onReceipt={handleDownloadReceipt}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayStudents.map((student) => (
                  <StudentFeeGridCard
                    key={student.id}
                    student={student}
                    periodMonth={periodMonth}
                    periodYear={periodYear}
                    processingId={processingId}
                    onPay={(s, ft, rec) => setPaymentTarget({ student: s, feeType: ft, record: rec })}
                    onMarkUnpaid={handleMarkUnpaid}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Defaulters Tab ── */}
        {activeTab === 'defaulters' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-600">
                <span className="font-bold text-red-600">{defaulters.length}</span> student{defaulters.length !== 1 ? 's' : ''} with outstanding fees
              </p>
              <div className="flex gap-2">
                <button onClick={handleExportDefaultersPdf} className="btn-secondary text-xs py-2">
                  <FileText size={13} /> PDF
                </button>
                <button onClick={handleExportDefaultersExcel} className="btn-secondary text-xs py-2">
                  <Download size={13} /> Excel
                </button>
              </div>
            </div>

            {defaulters.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" />
                <p className="text-green-700 font-semibold">No defaulters! All fees collected.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Student', 'Class', 'Fee Type', 'Due', 'Paid', 'Remaining', 'Overdue', 'Phone'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider first:pl-0 last:pr-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defaulters.flatMap((student) => {
                      const rows: React.ReactNode[] = []
                      if (Number(student.fee_amount) > 0 && (student.school_fee_record?.status ?? 'unpaid') !== 'paid') {
                        const rec = student.school_fee_record
                        const due = rec?.due_amount ?? Number(student.fee_amount)
                        const paid = rec?.paid_amount ?? 0
                        const days = getDaysOverdue(rec, periodMonth, periodYear)
                        rows.push(
                          <DefaulterRow
                            key={`${student.id}_sf`}
                            name={student.name}
                            cls={student.class}
                            feeType="school_fee"
                            dueAmount={due}
                            paidAmount={paid}
                            remaining={due - paid}
                            daysOverdue={days}
                            status={rec?.status ?? 'unpaid'}
                            parentPhone={student.parent_phone}
                          />
                        )
                      }
                      if (Number(student.exam_fee_amount) > 0 && (student.exam_fee_record?.status ?? 'unpaid') !== 'paid') {
                        const rec = student.exam_fee_record
                        const due = rec?.due_amount ?? Number(student.exam_fee_amount)
                        const paid = rec?.paid_amount ?? 0
                        const days = getDaysOverdue(rec, periodMonth, periodYear)
                        rows.push(
                          <DefaulterRow
                            key={`${student.id}_ef`}
                            name={student.name}
                            cls={student.class}
                            feeType="exam_fee"
                            dueAmount={due}
                            paidAmount={paid}
                            remaining={due - paid}
                            daysOverdue={days}
                            status={rec?.status ?? 'unpaid'}
                            parentPhone={student.parent_phone}
                          />
                        )
                      }
                      return rows
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={3} className="py-2.5 px-2 text-xs font-bold text-gray-700 pl-0">
                        Total
                      </td>
                      <td className="py-2.5 px-2 text-xs font-bold">
                        {buildDefaulterEntries().reduce((s, d) => s + d.dueAmount, 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-xs font-bold text-green-600">
                        {buildDefaulterEntries().reduce((s, d) => s + d.paidAmount, 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-xs font-bold text-red-600">
                        {buildDefaulterEntries().reduce((s, d) => s + d.remaining, 0).toLocaleString()}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Class Summary Tab ── */}
        {activeTab === 'summary' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-600">Fee breakdown by class for <span className="font-semibold">{periodStr}</span></p>
              <div className="flex gap-2">
                <button onClick={handleExportMonthlyPdf} className="btn-secondary text-xs py-2">
                  <FileText size={13} /> PDF
                </button>
                <button onClick={handleExportMonthlyExcel} className="btn-secondary text-xs py-2">
                  <Download size={13} /> Excel
                </button>
              </div>
            </div>

            {classSummary.length === 0 ? (
              <div className="text-center py-10">
                <Table2 size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No class data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Class', 'Students', 'SF Expected', 'SF Collected', 'SF Pending', 'SF %', 'EF Expected', 'EF Collected'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider first:pl-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classSummary.map((row) => {
                      const sfPending = row.schoolFeeExpected - row.schoolFeeCollected
                      const sfPct = row.schoolFeeExpected > 0 ? Math.round((row.schoolFeeCollected / row.schoolFeeExpected) * 100) : 0
                      return (
                        <tr key={row.className} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2.5 px-2 font-semibold text-gray-900 pl-0">{row.className}</td>
                          <td className="py-2.5 px-2 text-center text-gray-600">{row.students}</td>
                          <td className="py-2.5 px-2 text-right">{row.schoolFeeExpected.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-right text-green-600 font-medium">{row.schoolFeeCollected.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-right text-red-500">{sfPending.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sfPct >= 80 ? 'bg-green-100 text-green-700' : sfPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                              {sfPct}%
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-gray-500">
                            {row.examFeeExpected > 0 ? row.examFeeExpected.toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-green-600">
                            {row.examFeeCollected > 0 ? row.examFeeCollected.toLocaleString() : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-indigo-50/50">
                      <td className="py-2.5 px-2 font-bold text-indigo-700 pl-0" colSpan={2}>
                        Total ({students.length} students)
                      </td>
                      <td className="py-2.5 px-2 font-bold text-right">{classSummary.reduce((s, r) => s + r.schoolFeeExpected, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-bold text-right text-green-600">{classSummary.reduce((s, r) => s + r.schoolFeeCollected, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-bold text-right text-red-500">
                        {classSummary.reduce((s, r) => s + (r.schoolFeeExpected - r.schoolFeeCollected), 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-xs font-bold">{collectionPct}%</span>
                      </td>
                      <td className="py-2.5 px-2 font-bold text-right">{classSummary.reduce((s, r) => s + r.examFeeExpected, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-bold text-right text-green-600">{classSummary.reduce((s, r) => s + r.examFeeCollected, 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile export buttons */}
      <div className="flex gap-2 sm:hidden">
        <button onClick={handleExportMonthlyPdf} className="btn-secondary text-xs py-2 flex-1">
          <FileDown size={14} /> PDF Report
        </button>
        <button onClick={handleExportMonthlyExcel} className="btn-secondary text-xs py-2 flex-1">
          <Download size={14} /> Excel Report
        </button>
      </div>

      {/* Payment Modal */}
      {paymentTarget && (
        <PaymentModal
          studentName={paymentTarget.student.name}
          feeType={paymentTarget.feeType}
          dueAmount={paymentTarget.record?.due_amount ?? (paymentTarget.feeType === 'school_fee' ? Number(paymentTarget.student.fee_amount) : Number(paymentTarget.student.exam_fee_amount))}
          paidSoFar={paymentTarget.record?.paid_amount ?? 0}
          onConfirm={handlePayment}
          onCancel={() => setPaymentTarget(null)}
        />
      )}

      {/* Bulk Payment Modal */}
      {bulkPaymentOpen && (
        <PaymentModal
          isBulk
          bulkCount={unpaidForClass}
          onConfirm={(_, method) => executeBulkPaid(method)}
          onCancel={() => setBulkPaymentOpen(false)}
        />
      )}

      {/* History Modal */}
      {historyTarget && (
        <PaymentHistoryModal
          feeRecord={historyTarget.record}
          studentName={historyTarget.student.name}
          onClose={() => setHistoryTarget(null)}
          onReset={() => { setHistoryTarget(null); loadData() }}
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface FeeCardProps {
  student: StudentWithFee
  periodMonth: number
  periodYear: number
  processingId: string | null
  generatingPdf: string | null
  onPay: (s: StudentWithFee, ft: FeeType, rec: FeeRecord | null) => void
  onMarkUnpaid: (s: StudentWithFee, ft: FeeType) => void
  onHistory: (rec: FeeRecord, s: StudentWithFee) => void
  onReceipt: (s: StudentWithFee, ft: FeeType) => void
}

function StudentFeeCard({
  student, periodMonth, periodYear, processingId, generatingPdf,
  onPay, onMarkUnpaid, onHistory, onReceipt,
}: FeeCardProps) {
  const hasSf = Number(student.fee_amount) > 0
  const hasEf = Number(student.exam_fee_amount) > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Student header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-indigo-600 font-bold text-sm">{student.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{student.class}</span>
            {student.parent_phone && (
              <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
                <Phone size={10} /> {student.parent_phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {hasSf && (
        <FeeRowItem
          label="School Fee"
          feeRecord={student.school_fee_record}
          dueAmount={student.school_fee_record?.due_amount ?? Number(student.fee_amount)}
          periodMonth={periodMonth} periodYear={periodYear}
          isProcessing={processingId === `${student.id}_school_fee`}
          isGenerating={generatingPdf === `${student.id}_school_fee_receipt`}
          onPay={() => onPay(student, 'school_fee', student.school_fee_record)}
          onMarkUnpaid={() => onMarkUnpaid(student, 'school_fee')}
          onHistory={() => student.school_fee_record && onHistory(student.school_fee_record, student)}
          onReceipt={() => onReceipt(student, 'school_fee')}
        />
      )}

      {hasEf && (
        <FeeRowItem
          label="Exam Fee"
          feeRecord={student.exam_fee_record}
          dueAmount={student.exam_fee_record?.due_amount ?? Number(student.exam_fee_amount)}
          periodMonth={periodMonth} periodYear={periodYear}
          isProcessing={processingId === `${student.id}_exam_fee`}
          isGenerating={generatingPdf === `${student.id}_exam_fee_receipt`}
          onPay={() => onPay(student, 'exam_fee', student.exam_fee_record)}
          onMarkUnpaid={() => onMarkUnpaid(student, 'exam_fee')}
          onHistory={() => student.exam_fee_record && onHistory(student.exam_fee_record, student)}
          onReceipt={() => onReceipt(student, 'exam_fee')}
        />
      )}
    </div>
  )
}

interface FeeRowItemProps {
  label: string
  feeRecord: FeeRecord | null
  dueAmount: number
  periodMonth: number
  periodYear: number
  isProcessing: boolean
  isGenerating: boolean
  onPay: () => void
  onMarkUnpaid: () => void
  onHistory: () => void
  onReceipt: () => void
}

function FeeRowItem({
  label, feeRecord, dueAmount, periodMonth, periodYear,
  isProcessing, isGenerating, onPay, onMarkUnpaid, onHistory, onReceipt,
}: FeeRowItemProps) {
  const status = feeRecord?.status ?? 'unpaid'
  const paidAmount = Number(feeRecord?.paid_amount ?? 0)
  const remaining = dueAmount - paidAmount
  const daysOverdue = getDaysOverdue(feeRecord, periodMonth, periodYear)

  return (
    <div className={`rounded-lg border p-3 ${
      status === 'paid' ? 'border-green-200 bg-green-50/50' :
      status === 'partial' ? 'border-amber-200 bg-amber-50/40' :
      'border-gray-200 bg-gray-50/50'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            <StatusBadge status={status} />
            {daysOverdue > 0 && status !== 'paid' && (
              <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                <AlertCircle size={10} /> {daysOverdue}d overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>Due: <strong className="text-gray-800">{dueAmount.toLocaleString()}</strong></span>
            {paidAmount > 0 && <span>Paid: <strong className="text-green-600">{paidAmount.toLocaleString()}</strong></span>}
            {remaining > 0 && <span>Left: <strong className="text-red-500">{remaining.toLocaleString()}</strong></span>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {feeRecord && (
            <button onClick={onHistory} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg" title="View history">
              <Clock size={13} />
            </button>
          )}
          {status === 'paid' && (
            <>
              <button onClick={onReceipt} disabled={isGenerating} className="p-1.5 text-indigo-400 hover:bg-indigo-100 rounded-lg" title="Download receipt">
                {isGenerating ? <div className="h-3 w-3 border border-indigo-400 border-t-indigo-600 rounded-full animate-spin" /> : <FileText size={13} />}
              </button>
              <button onClick={onMarkUnpaid} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Mark unpaid">
                <XCircle size={13} />
              </button>
            </>
          )}
          {status !== 'paid' && (
            <button
              onClick={onPay}
              disabled={isProcessing}
              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {isProcessing ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Pay'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Grid card variant
interface GridCardProps {
  student: StudentWithFee
  periodMonth: number
  periodYear: number
  processingId: string | null
  onPay: (s: StudentWithFee, ft: FeeType, rec: FeeRecord | null) => void
  onMarkUnpaid: (s: StudentWithFee, ft: FeeType) => void
}

function StudentFeeGridCard({ student, periodMonth, periodYear, processingId, onPay, onMarkUnpaid }: GridCardProps) {
  const sfStatus = student.school_fee_record?.status ?? 'unpaid'
  const efStatus = student.exam_fee_record?.status ?? 'unpaid'
  const sfOverdue = getDaysOverdue(student.school_fee_record, periodMonth, periodYear)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-indigo-600 font-bold text-sm">{student.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{student.class}</span>
        </div>
      </div>

      {student.parent_phone && (
        <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
          <Phone size={10} /> {student.parent_phone}
        </a>
      )}

      {Number(student.fee_amount) > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">School Fee</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusBadge status={sfStatus} />
              {sfOverdue > 0 && sfStatus !== 'paid' && (
                <span className="text-xs text-red-600 font-medium">{sfOverdue}d</span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {sfStatus !== 'paid' ? (
              <button
                onClick={() => onPay(student, 'school_fee', student.school_fee_record)}
                disabled={processingId === `${student.id}_school_fee`}
                className="px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg"
              >
                Pay
              </button>
            ) : (
              <button
                onClick={() => onMarkUnpaid(student, 'school_fee')}
                className="px-2 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {Number(student.exam_fee_amount) > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
          <div>
            <p className="text-xs text-gray-400">Exam Fee</p>
            <StatusBadge status={efStatus} />
          </div>
          <div className="flex gap-1">
            {efStatus !== 'paid' ? (
              <button
                onClick={() => onPay(student, 'exam_fee', student.exam_fee_record)}
                disabled={processingId === `${student.id}_exam_fee`}
                className="px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg"
              >
                Pay
              </button>
            ) : (
              <button
                onClick={() => onMarkUnpaid(student, 'exam_fee')}
                className="px-2 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: FeeStatus }) {
  if (status === 'paid')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 size={9} /> Paid
      </span>
    )
  if (status === 'partial')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Clock size={9} /> Partial
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
      <XCircle size={9} /> Unpaid
    </span>
  )
}

interface DefaulterRowProps {
  name: string
  cls: string
  feeType: FeeType
  dueAmount: number
  paidAmount: number
  remaining: number
  daysOverdue: number
  status: FeeStatus | string
  parentPhone?: string | null
}

function DefaulterRow({ name, cls, feeType, dueAmount, paidAmount, remaining, daysOverdue, status, parentPhone }: DefaulterRowProps) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2.5 px-2 font-medium text-gray-900 pl-0">
        <div>{name}</div>
      </td>
      <td className="py-2.5 px-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{cls}</span>
      </td>
      <td className="py-2.5 px-2 text-xs text-gray-600">{FEE_TYPE_LABELS[feeType]}</td>
      <td className="py-2.5 px-2 text-right text-sm">{dueAmount.toLocaleString()}</td>
      <td className="py-2.5 px-2 text-right text-sm text-green-600">{paidAmount > 0 ? paidAmount.toLocaleString() : '—'}</td>
      <td className="py-2.5 px-2 text-right text-sm font-semibold text-red-600">{remaining.toLocaleString()}</td>
      <td className="py-2.5 px-2 text-center">
        {daysOverdue > 0 ? (
          <span className="text-xs text-red-600 font-bold">{daysOverdue}d</span>
        ) : '—'}
      </td>
      <td className="py-2.5 px-2 text-xs text-gray-500 pr-0">
        {parentPhone ? (
          <a href={`tel:${parentPhone}`} className="text-indigo-500 hover:underline">{parentPhone}</a>
        ) : '—'}
      </td>
    </tr>
  )
}
