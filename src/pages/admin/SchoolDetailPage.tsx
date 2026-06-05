import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { School, StudentWithFee, FeeRecord, FeeType, PaymentMethod, FeeStatus } from '../../types'
import {
  CLASS_LIST, FEE_TYPE_LABELS, getDaysOverdue, getPeriodDueDate,
  getPeriodLabel, getInitialPeriodMonth,
} from '../../types'
import PaymentModal from '../../components/PaymentModal'
import PaymentHistoryModal from '../../components/PaymentHistoryModal'
import LoadingSpinner from '../../components/LoadingSpinner'
import { generateReceipt, generateDefaultersReport, generateSummaryReport } from '../../utils/pdf'
import { exportDefaultersExcel, exportMonthlyReportExcel, parseExcel, downloadExcelTemplate } from '../../utils/excel'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Plus, Trash2, Upload, X, Search, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertCircle, FileText, Download, FileDown,
  Phone, Users, BookOpen, TrendingUp, LayoutList, LayoutGrid, BarChart3, Table2,
} from 'lucide-react'

type TabType = 'fees' | 'defaulters' | 'summary'
type FilterType = 'all' | 'paid' | 'partial' | 'unpaid'

interface StudentForm {
  name: string
  class: string
  fee_amount: string
  exam_fee_amount: string
  parent_phone: string
}

interface PaymentTarget {
  student: StudentWithFee
  feeType: FeeType
  record: FeeRecord | null
}

interface HistoryTarget {
  record: FeeRecord
  student: StudentWithFee
}

export default function SchoolDetailPage() {
  const { id: schoolId } = useParams<{ id: string }>()
  const { profile } = useAuth()

  const [school, setSchool] = useState<School | null>(null)
  const [students, setStudents] = useState<StudentWithFee[]>([])
  const [loading, setLoading] = useState(true)
  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1)
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear())

  const [activeTab, setActiveTab] = useState<TabType>('fees')
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<StudentForm>({ name: '', class: '', fee_amount: '', exam_fee_amount: '', parent_phone: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null)
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null)
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!schoolId) return
    try {
      const [{ data: schoolData }, { data: studentsData }] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      ])

      const sch = schoolData as School | null
      setSchool(sch)

      // Sync period to school reset type on first load
      if (sch && loading) {
        setPeriodMonth(getInitialPeriodMonth(sch.fee_reset_type))
      }

      const ids = (studentsData ?? []).map((s) => s.id)
      let feeRecords: FeeRecord[] = []
      if (ids.length > 0) {
        const { data: frData } = await supabase
          .from('fee_records').select('*').eq('school_id', schoolId)
          .eq('month', periodMonth).eq('year', periodYear).in('student_id', ids)
        feeRecords = frData ?? []
      }

      const feeMap: Record<string, FeeRecord> = {}
      for (const fr of feeRecords) feeMap[`${fr.student_id}_${fr.fee_type}`] = fr

      setStudents(
        (studentsData ?? []).map((s) => ({
          ...s,
          school_fee_record: feeMap[`${s.id}_school_fee`] ?? null,
          exam_fee_record: feeMap[`${s.id}_exam_fee`] ?? null,
        }))
      )
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [schoolId, periodMonth, periodYear])

  useEffect(() => { loadData() }, [loadData])

  // Auto-fill fee when class changes (from school class_fees config)
  function handleClassChange(cls: string) {
    const autoFee = school?.class_fees?.[cls]
    setForm((f) => ({
      ...f,
      class: cls,
      fee_amount: autoFee ? String(autoFee) : f.fee_amount,
    }))
  }

  function changePeriod(dir: number) {
    const step = school?.fee_reset_type === 'term' ? 3 : 1
    let m = periodMonth + dir * step
    let y = periodYear
    while (m > 12) { m -= 12; y++ }
    while (m < 1)  { m += 12; y-- }
    setPeriodMonth(m)
    setPeriodYear(y)
    setSelectedClass('')
    setFilter('all')
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.class.trim()) { toast.error('Name and class are required'); return }
    const feeAmount = parseFloat(form.fee_amount) || 0
    const examFeeAmount = parseFloat(form.exam_fee_amount) || 0
    setSaving(true)
    try {
      const { error } = await supabase.from('students').insert({
        school_id: schoolId,
        name: form.name.trim(),
        class: form.class.trim(),
        fee_amount: feeAmount,
        exam_fee_amount: examFeeAmount,
        parent_phone: form.parent_phone.trim() || null,
      })
      if (error) throw error
      toast.success(`${form.name} added`)
      setShowAddModal(false)
      setForm({ name: '', class: '', fee_amount: '', exam_fee_amount: '', parent_phone: '' })
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteStudent(student: StudentWithFee) {
    if (!confirm(`Delete "${student.name}"? All their fee records will also be deleted.`)) return
    setDeleting(student.id)
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id)
      if (error) throw error
      toast.success(`${student.name} deleted`)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const rows = await parseExcel(file)
      const inserts = rows.map((r) => ({
        school_id: schoolId,
        name: r.name,
        class: r.class,
        fee_amount: r.fee_amount,
        exam_fee_amount: 0,
        parent_phone: r.parent_phone || null,
      }))
      const { error } = await supabase.from('students').insert(inserts)
      if (error) throw error
      toast.success(`${rows.length} students imported`)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handlePayment(amount: number, method: PaymentMethod) {
    if (!paymentTarget) return
    const { student, feeType, record } = paymentTarget
    setPaymentTarget(null)

    const key = `${student.id}_${feeType}`
    setProcessingId(key)
    try {
      let recordId = record?.id
      const currentDue = record?.due_amount ?? (feeType === 'school_fee' ? Number(student.fee_amount) : Number(student.exam_fee_amount))
      const currentPaid = record?.paid_amount ?? 0

      if (!record) {
        const { data: nr, error } = await supabase.from('fee_records').insert({
          student_id: student.id, school_id: schoolId,
          month: periodMonth, year: periodYear, fee_type: feeType,
          due_amount: currentDue, paid_amount: 0, status: 'unpaid',
          due_date: getPeriodDueDate(periodMonth, periodYear), paid_by: profile?.id,
        }).select().single()
        if (error) throw error
        recordId = nr.id
      }

      const { error: txErr } = await supabase.from('payment_transactions').insert({
        fee_record_id: recordId, student_id: student.id, school_id: schoolId,
        amount, payment_method: method, paid_by: profile?.id,
      })
      if (txErr) throw txErr

      const newPaid = currentPaid + amount
      const newStatus: FeeStatus = newPaid >= currentDue ? 'paid' : 'partial'
      await supabase.from('fee_records').update({ paid_amount: newPaid, status: newStatus, paid_by: profile?.id }).eq('id', recordId)

      toast.success(newStatus === 'paid' ? `Fully paid · ${method === 'cash' ? 'Cash' : 'Online'}` : `Partial recorded`)

      const resetType = school?.fee_reset_type ?? 'monthly'
      generateReceipt({
        schoolName: school?.name ?? 'School', studentName: student.name, studentClass: student.class,
        parentPhone: student.parent_phone, feeType, dueAmount: currentDue,
        amountPaid: amount, totalPaidSoFar: newPaid, remaining: currentDue - newPaid,
        paymentMethod: method, month: periodMonth, year: periodYear,
        periodLabel: getPeriodLabel(periodMonth, periodYear, resetType), resetType,
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
    if (targets.length === 0) return
    setMarkingAllPaid(true)
    try {
      for (const student of targets) {
        const record = student.school_fee_record
        const due = record?.due_amount ?? Number(student.fee_amount)
        const paid = record?.paid_amount ?? 0
        const payAmt = due - paid
        if (payAmt <= 0) continue
        let recordId = record?.id
        if (!record) {
          const { data: nr, error } = await supabase.from('fee_records').insert({
            student_id: student.id, school_id: schoolId,
            month: periodMonth, year: periodYear, fee_type: 'school_fee',
            due_amount: due, paid_amount: 0, status: 'unpaid',
            due_date: getPeriodDueDate(periodMonth, periodYear), paid_by: profile?.id,
          }).select().single()
          if (error) throw error
          recordId = nr.id
        }
        await supabase.from('payment_transactions').insert({
          fee_record_id: recordId, student_id: student.id, school_id: schoolId,
          amount: payAmt, payment_method: method, paid_by: profile?.id,
        })
        await supabase.from('fee_records').update({ paid_amount: due, status: 'paid', paid_by: profile?.id }).eq('id', recordId)
      }
      toast.success(`${targets.length} students marked paid`)
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
    if (!confirm(`Reset ${student.name}'s ${FEE_TYPE_LABELS[feeType]} to unpaid? This deletes payment records.`)) return
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

  function handleDownloadReceipt(student: StudentWithFee, feeType: FeeType) {
    const record = feeType === 'school_fee' ? student.school_fee_record : student.exam_fee_record
    if (!record) return
    const resetType = school?.fee_reset_type ?? 'monthly'
    generateReceipt({
      schoolName: school?.name ?? 'School', studentName: student.name, studentClass: student.class,
      parentPhone: student.parent_phone, feeType, dueAmount: Number(record.due_amount),
      amountPaid: Number(record.paid_amount), totalPaidSoFar: Number(record.paid_amount),
      remaining: Number(record.due_amount) - Number(record.paid_amount),
      paymentMethod: 'cash', month: periodMonth, year: periodYear,
      periodLabel: getPeriodLabel(periodMonth, periodYear, resetType), resetType,
    })
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const availableClasses = Array.from(new Set(students.map((s) => s.class)))
    .sort((a, b) => {
      const an = parseInt(a.replace(/\D/g, ''), 10), bn = parseInt(b.replace(/\D/g, ''), 10)
      return (isNaN(an) || isNaN(bn)) ? a.localeCompare(b) : an - bn
    })

  const classFilteredStudents = selectedClass ? students.filter((s) => s.class === selectedClass) : students

  const displayStudents = classFilteredStudents.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'all') return true
    const sfS = s.school_fee_record?.status ?? 'unpaid'
    const efS = s.exam_fee_record?.status ?? 'unpaid'
    if (filter === 'paid') return sfS === 'paid' && (Number(s.exam_fee_amount) === 0 || efS === 'paid')
    if (filter === 'partial') return sfS === 'partial' || efS === 'partial'
    if (filter === 'unpaid') return sfS === 'unpaid' || (Number(s.exam_fee_amount) > 0 && efS === 'unpaid')
    return true
  })

  const defaulters = students.filter((s) => {
    const sfU = Number(s.fee_amount) > 0 && (s.school_fee_record?.status ?? 'unpaid') !== 'paid'
    const efU = Number(s.exam_fee_amount) > 0 && (s.exam_fee_record?.status ?? 'unpaid') !== 'paid'
    return sfU || efU
  })

  const classSummary = availableClasses.map((cls) => {
    const cs = students.filter((s) => s.class === cls)
    return {
      className: cls, students: cs.length,
      schoolFeeExpected: cs.reduce((sum, s) => sum + Number(s.fee_amount), 0),
      schoolFeeCollected: cs.reduce((sum, s) => sum + Number(s.school_fee_record?.paid_amount ?? 0), 0),
      examFeeExpected: cs.reduce((sum, s) => sum + Number(s.exam_fee_amount), 0),
      examFeeCollected: cs.reduce((sum, s) => sum + Number(s.exam_fee_record?.paid_amount ?? 0), 0),
    }
  })

  const totalExpected = students.reduce((s, st) => s + Number(st.fee_amount) + Number(st.exam_fee_amount), 0)
  const totalCollected = students.reduce((s, st) => s + Number(st.school_fee_record?.paid_amount ?? 0) + Number(st.exam_fee_record?.paid_amount ?? 0), 0)
  const totalPending = totalExpected - totalCollected
  const collectionPct = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
  const unpaidForClass = selectedClass
    ? classFilteredStudents.filter((s) => (s.school_fee_record?.status ?? 'unpaid') !== 'paid' && Number(s.fee_amount) > 0).length
    : 0

  const resetType = school?.fee_reset_type ?? 'monthly'
  const periodStr = getPeriodLabel(periodMonth, periodYear, resetType)
  const schoolName = school?.name ?? 'School'

  function buildDefaulterEntries() {
    const entries: Parameters<typeof exportDefaultersExcel>[0] = []
    for (const s of defaulters) {
      if (Number(s.fee_amount) > 0 && (s.school_fee_record?.status ?? 'unpaid') !== 'paid') {
        const rec = s.school_fee_record
        const due = rec?.due_amount ?? Number(s.fee_amount)
        const paid = rec?.paid_amount ?? 0
        entries.push({ name: s.name, studentClass: s.class, feeType: 'school_fee', dueAmount: due, paidAmount: paid, remaining: due - paid, daysOverdue: getDaysOverdue(rec, periodMonth, periodYear), status: rec?.status ?? 'unpaid', parentPhone: s.parent_phone })
      }
      if (Number(s.exam_fee_amount) > 0 && (s.exam_fee_record?.status ?? 'unpaid') !== 'paid') {
        const rec = s.exam_fee_record
        const due = rec?.due_amount ?? Number(s.exam_fee_amount)
        const paid = rec?.paid_amount ?? 0
        entries.push({ name: s.name, studentClass: s.class, feeType: 'exam_fee', dueAmount: due, paidAmount: paid, remaining: due - paid, daysOverdue: getDaysOverdue(rec, periodMonth, periodYear), status: rec?.status ?? 'unpaid', parentPhone: s.parent_phone })
      }
    }
    return entries
  }

  if (loading) return <LoadingSpinner fullPage text="Loading school..." />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/schools" className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{schoolName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{students.length} students · {resetType === 'term' ? 'Term-based' : 'Monthly'} reset</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <label className={`btn-secondary text-xs py-2 cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`} title="Import from Excel">
            {importing ? <div className="h-3 w-3 border border-gray-400 border-t-gray-700 rounded-full animate-spin" /> : <Upload size={13} />}
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => downloadExcelTemplate()} className="btn-secondary text-xs py-2" title="Download template">
            <Download size={13} />
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs py-2">
            <Plus size={14} />
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Period Navigator */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-900">{periodStr}</p>
          <p className="text-xs text-gray-400">{resetType === 'term' ? 'Term-based' : 'Monthly'} cycle</p>
        </div>
        <button onClick={() => changePeriod(1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
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
        <div className="flex justify-between text-xs text-gray-500 mb-2">
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
              { id: 'fees' as TabType, label: 'Fees', icon: BookOpen, count: undefined as number | undefined },
              { id: 'defaulters' as TabType, label: 'Defaulters', icon: AlertCircle, count: defaulters.length as number | undefined },
              { id: 'summary' as TabType, label: 'Summary', icon: BarChart3, count: undefined as number | undefined },
            ]
          ).map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === id ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-600'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Fees Tab */}
        {activeTab === 'fees' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field py-2 text-sm flex-1 min-w-[130px] max-w-[180px]">
                <option value="">All Classes</option>
                {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {selectedClass && unpaidForClass > 0 && (
                <button onClick={() => setBulkPaymentOpen(true)} disabled={markingAllPaid}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  {markingAllPaid ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                  Mark All Paid ({unpaidForClass})
                </button>
              )}

              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student..." className="input-field pl-8 py-2 text-sm w-full" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
              </div>

              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
                {(['list', 'grid'] as const).map((v) => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === v ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}>
                    {v === 'list' ? <LayoutList size={15} /> : <LayoutGrid size={15} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(['all', 'paid', 'partial', 'unpaid'] as FilterType[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors capitalize ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f}
                </button>
              ))}
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12">
                <Users size={36} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No students yet</p>
                <p className="text-gray-400 text-sm">Add students or import from Excel</p>
              </div>
            ) : displayStudents.length === 0 ? (
              <div className="text-center py-10">
                <Search size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No students match your filters</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {displayStudents.map((student) => (
                  <AdminStudentCard
                    key={student.id}
                    student={student}
                    periodMonth={periodMonth} periodYear={periodYear}
                    processingId={processingId} generatingPdf={generatingPdf}
                    deleting={deleting}
                    onPay={(s, ft, rec) => setPaymentTarget({ student: s, feeType: ft, record: rec })}
                    onMarkUnpaid={handleMarkUnpaid}
                    onHistory={(rec, s) => setHistoryTarget({ record: rec, student: s })}
                    onReceipt={handleDownloadReceipt}
                    onDelete={handleDeleteStudent}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayStudents.map((student) => (
                  <AdminStudentGridCard
                    key={student.id}
                    student={student}
                    periodMonth={periodMonth} periodYear={periodYear}
                    processingId={processingId} deleting={deleting}
                    onPay={(s, ft, rec) => setPaymentTarget({ student: s, feeType: ft, record: rec })}
                    onMarkUnpaid={handleMarkUnpaid}
                    onDelete={handleDeleteStudent}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Defaulters Tab */}
        {activeTab === 'defaulters' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-600">
                <span className="font-bold text-red-600">{defaulters.length}</span> students with outstanding fees
              </p>
              <div className="flex gap-2">
                <button onClick={() => { const e = buildDefaulterEntries(); if (e.length) generateDefaultersReport({ defaulters: e, schoolName, month: periodMonth, year: periodYear, periodLabel: periodStr }); else toast('No defaulters') }} className="btn-secondary text-xs py-2"><FileText size={13} /> PDF</button>
                <button onClick={() => { const e = buildDefaulterEntries(); if (e.length) { exportDefaultersExcel(e, schoolName, periodMonth, periodYear, periodStr); toast.success('Excel downloaded') } else toast('No defaulters') }} className="btn-secondary text-xs py-2"><Download size={13} /> Excel</button>
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
                        <th key={h} className="text-left py-2.5 px-2 text-xs font-semibold text-gray-500 uppercase first:pl-0">{h}</th>
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
                        rows.push(<tr key={`${student.id}_sf`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium pl-0">{student.name}</td>
                          <td className="py-2 px-2"><span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{student.class}</span></td>
                          <td className="py-2 px-2 text-xs text-gray-600">{FEE_TYPE_LABELS['school_fee']}</td>
                          <td className="py-2 px-2 text-right">{due.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-green-600">{paid > 0 ? paid.toLocaleString() : '—'}</td>
                          <td className="py-2 px-2 text-right font-semibold text-red-600">{(due - paid).toLocaleString()}</td>
                          <td className="py-2 px-2 text-center">{getDaysOverdue(rec, periodMonth, periodYear) > 0 ? <span className="text-xs text-red-600 font-bold">{getDaysOverdue(rec, periodMonth, periodYear)}d</span> : '—'}</td>
                          <td className="py-2 px-2 text-xs">{student.parent_phone ? <a href={`tel:${student.parent_phone}`} className="text-indigo-500 hover:underline">{student.parent_phone}</a> : '—'}</td>
                        </tr>)
                      }
                      if (Number(student.exam_fee_amount) > 0 && (student.exam_fee_record?.status ?? 'unpaid') !== 'paid') {
                        const rec = student.exam_fee_record
                        const due = rec?.due_amount ?? Number(student.exam_fee_amount)
                        const paid = rec?.paid_amount ?? 0
                        rows.push(<tr key={`${student.id}_ef`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium pl-0">{student.name}</td>
                          <td className="py-2 px-2"><span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{student.class}</span></td>
                          <td className="py-2 px-2 text-xs text-gray-600">{FEE_TYPE_LABELS['exam_fee']}</td>
                          <td className="py-2 px-2 text-right">{due.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-green-600">{paid > 0 ? paid.toLocaleString() : '—'}</td>
                          <td className="py-2 px-2 text-right font-semibold text-red-600">{(due - paid).toLocaleString()}</td>
                          <td className="py-2 px-2 text-center">{getDaysOverdue(rec, periodMonth, periodYear) > 0 ? <span className="text-xs text-red-600 font-bold">{getDaysOverdue(rec, periodMonth, periodYear)}d</span> : '—'}</td>
                          <td className="py-2 px-2 text-xs">{student.parent_phone ? <a href={`tel:${student.parent_phone}`} className="text-indigo-500 hover:underline">{student.parent_phone}</a> : '—'}</td>
                        </tr>)
                      }
                      return rows
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-600">Class breakdown for <span className="font-semibold">{periodStr}</span></p>
              <div className="flex gap-2">
                <button onClick={() => generateSummaryReport({ schoolName, month: periodMonth, year: periodYear, periodLabel: periodStr, totalStudents: students.length, totalExpected, totalCollected, totalPending, classSummary })} className="btn-secondary text-xs py-2"><FileDown size={13} /> PDF</button>
                <button onClick={() => { exportMonthlyReportExcel({ schoolName, month: periodMonth, year: periodYear, periodLabel: periodStr, totalStudents: students.length, totalExpected, totalCollected, totalPending, classSummary, defaulters: buildDefaulterEntries() }); toast.success('Excel downloaded') }} className="btn-secondary text-xs py-2"><Download size={13} /> Excel</button>
              </div>
            </div>
            {classSummary.length === 0 ? (
              <div className="text-center py-10"><Table2 size={32} className="text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">No data</p></div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Class', 'Students', 'SF Expected', 'SF Collected', 'SF Pending', '%', 'EF Expected', 'EF Collected'].map((h) => (
                        <th key={h} className="text-left py-2.5 px-2 text-xs font-semibold text-gray-500 uppercase first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classSummary.map((row) => {
                      const sfP = row.schoolFeeExpected - row.schoolFeeCollected
                      const pct = row.schoolFeeExpected > 0 ? Math.round((row.schoolFeeCollected / row.schoolFeeExpected) * 100) : 0
                      return (
                        <tr key={row.className} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2.5 px-2 font-semibold pl-0">{row.className}</td>
                          <td className="py-2.5 px-2 text-center">{row.students}</td>
                          <td className="py-2.5 px-2 text-right">{row.schoolFeeExpected.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-right text-green-600 font-medium">{row.schoolFeeCollected.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-right text-red-500">{sfP.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{pct}%</span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-gray-500">{row.examFeeExpected > 0 ? row.examFeeExpected.toLocaleString() : '—'}</td>
                          <td className="py-2.5 px-2 text-right text-green-600">{row.examFeeCollected > 0 ? row.examFeeCollected.toLocaleString() : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-indigo-50/50">
                      <td className="py-2.5 px-2 font-bold text-indigo-700 pl-0" colSpan={2}>Total</td>
                      <td className="py-2.5 px-2 font-bold text-right">{classSummary.reduce((s, r) => s + r.schoolFeeExpected, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-bold text-right text-green-600">{classSummary.reduce((s, r) => s + r.schoolFeeCollected, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-bold text-right text-red-500">{classSummary.reduce((s, r) => s + (r.schoolFeeExpected - r.schoolFeeCollected), 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-center"><span className="text-xs font-bold">{collectionPct}%</span></td>
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

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Add Student</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddStudent} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Student name" className="input-field" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Class *</label>
                <select value={form.class} onChange={(e) => handleClassChange(e.target.value)} className="input-field" required>
                  <option value="">Select class</option>
                  {CLASS_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="other">Other</option>
                </select>
                {form.class === 'other' && (
                  <input type="text" onChange={(e) => setForm({ ...form, class: e.target.value })} placeholder="Enter class name" className="input-field mt-2" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">School Fee (Rs)</label>
                  <input type="number" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })} placeholder="0" className="input-field" min={0} step={1} />
                  {school?.class_fees?.[form.class] && (
                    <p className="text-xs text-indigo-500 mt-1">Auto-filled from class config</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Fee (Rs)</label>
                  <input type="number" value={form.exam_fee_amount} onChange={(e) => setForm({ ...form, exam_fee_amount: e.target.value })} placeholder="0" className="input-field" min={0} step={1} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Phone</label>
                <input type="tel" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} placeholder="03001234567" className="input-field" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
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

      {bulkPaymentOpen && (
        <PaymentModal isBulk bulkCount={unpaidForClass}
          onConfirm={(_, method) => executeBulkPaid(method)}
          onCancel={() => setBulkPaymentOpen(false)}
        />
      )}

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

interface AdminCardProps {
  student: StudentWithFee
  periodMonth: number
  periodYear: number
  processingId: string | null
  generatingPdf: string | null
  deleting: string | null
  onPay: (s: StudentWithFee, ft: FeeType, rec: FeeRecord | null) => void
  onMarkUnpaid: (s: StudentWithFee, ft: FeeType) => void
  onHistory: (rec: FeeRecord, s: StudentWithFee) => void
  onReceipt: (s: StudentWithFee, ft: FeeType) => void
  onDelete: (s: StudentWithFee) => void
}

function AdminStudentCard({ student, periodMonth, periodYear, processingId, generatingPdf, deleting, onPay, onMarkUnpaid, onHistory, onReceipt, onDelete }: AdminCardProps) {
  const hasSf = Number(student.fee_amount) > 0
  const hasEf = Number(student.exam_fee_amount) > 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
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
        <button onClick={() => onDelete(student)} disabled={deleting === student.id}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0">
          {deleting === student.id ? <div className="h-4 w-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      {hasSf && <AdminFeeRow label="School Fee" feeRecord={student.school_fee_record} dueAmount={student.school_fee_record?.due_amount ?? Number(student.fee_amount)} periodMonth={periodMonth} periodYear={periodYear}
        isProcessing={processingId === `${student.id}_school_fee`} isGenerating={generatingPdf === `${student.id}_school_fee_receipt`}
        onPay={() => onPay(student, 'school_fee', student.school_fee_record)} onMarkUnpaid={() => onMarkUnpaid(student, 'school_fee')}
        onHistory={() => student.school_fee_record && onHistory(student.school_fee_record, student)} onReceipt={() => onReceipt(student, 'school_fee')} />}
      {hasEf && <AdminFeeRow label="Exam Fee" feeRecord={student.exam_fee_record} dueAmount={student.exam_fee_record?.due_amount ?? Number(student.exam_fee_amount)} periodMonth={periodMonth} periodYear={periodYear}
        isProcessing={processingId === `${student.id}_exam_fee`} isGenerating={generatingPdf === `${student.id}_exam_fee_receipt`}
        onPay={() => onPay(student, 'exam_fee', student.exam_fee_record)} onMarkUnpaid={() => onMarkUnpaid(student, 'exam_fee')}
        onHistory={() => student.exam_fee_record && onHistory(student.exam_fee_record, student)} onReceipt={() => onReceipt(student, 'exam_fee')} />}
    </div>
  )
}

interface AdminFeeRowProps {
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

function AdminFeeRow({ label, feeRecord, dueAmount, periodMonth, periodYear, isProcessing, onPay, onMarkUnpaid, onHistory, onReceipt }: AdminFeeRowProps) {
  const status = feeRecord?.status ?? 'unpaid'
  const paid = Number(feeRecord?.paid_amount ?? 0)
  const remaining = dueAmount - paid
  const daysOverdue = getDaysOverdue(feeRecord, periodMonth, periodYear)
  return (
    <div className={`rounded-lg border p-3 ${status === 'paid' ? 'border-green-200 bg-green-50/50' : status === 'partial' ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            {status === 'paid' && <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 size={9} /> Paid</span>}
            {status === 'partial' && <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={9} /> Partial</span>}
            {status === 'unpaid' && <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={9} /> Unpaid</span>}
            {daysOverdue > 0 && status !== 'paid' && <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium"><AlertCircle size={10} /> {daysOverdue}d overdue</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>Due: <strong className="text-gray-800">{dueAmount.toLocaleString()}</strong></span>
            {paid > 0 && <span>Paid: <strong className="text-green-600">{paid.toLocaleString()}</strong></span>}
            {remaining > 0 && <span>Left: <strong className="text-red-500">{remaining.toLocaleString()}</strong></span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {feeRecord && <button onClick={onHistory} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg" title="History"><Clock size={13} /></button>}
          {status === 'paid' && <><button onClick={onReceipt} className="p-1.5 text-indigo-400 hover:bg-indigo-100 rounded-lg" title="Receipt"><FileText size={13} /></button><button onClick={onMarkUnpaid} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Reset"><XCircle size={13} /></button></>}
          {status !== 'paid' && <button onClick={onPay} disabled={isProcessing} className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">{isProcessing ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Pay'}</button>}
        </div>
      </div>
    </div>
  )
}

interface AdminGridCardProps {
  student: StudentWithFee
  periodMonth: number
  periodYear: number
  processingId: string | null
  deleting: string | null
  onPay: (s: StudentWithFee, ft: FeeType, rec: FeeRecord | null) => void
  onMarkUnpaid: (s: StudentWithFee, ft: FeeType) => void
  onDelete: (s: StudentWithFee) => void
}

function AdminStudentGridCard({ student, periodMonth, periodYear, processingId, deleting, onPay, onMarkUnpaid, onDelete }: AdminGridCardProps) {
  const sfS = student.school_fee_record?.status ?? 'unpaid'
  const efS = student.exam_fee_record?.status ?? 'unpaid'
  const sfOv = getDaysOverdue(student.school_fee_record, periodMonth, periodYear)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-indigo-600 font-bold text-sm">{student.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{student.class}</span>
        </div>
        <button onClick={() => onDelete(student)} disabled={deleting === student.id} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
          {deleting === student.id ? <div className="h-3 w-3 border border-gray-300 border-t-red-500 rounded-full animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
      {student.parent_phone && <a href={`tel:${student.parent_phone}`} className="flex items-center gap-1 text-xs text-indigo-500 hover:underline"><Phone size={10} />{student.parent_phone}</a>}
      {Number(student.fee_amount) > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">School Fee</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {sfS === 'paid' ? <span className="text-xs font-semibold text-green-700">Paid</span> : sfS === 'partial' ? <span className="text-xs font-semibold text-amber-700">Partial</span> : <span className="text-xs font-semibold text-red-700">Unpaid</span>}
              {sfOv > 0 && sfS !== 'paid' && <span className="text-xs text-red-600">{sfOv}d</span>}
            </div>
          </div>
          {sfS !== 'paid' ? <button onClick={() => onPay(student, 'school_fee', student.school_fee_record)} disabled={processingId === `${student.id}_school_fee`} className="px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg">Pay</button>
            : <button onClick={() => onMarkUnpaid(student, 'school_fee')} className="px-2 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Reset</button>}
        </div>
      )}
      {Number(student.exam_fee_amount) > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
          <div>
            <p className="text-xs text-gray-400">Exam Fee</p>
            {efS === 'paid' ? <span className="text-xs font-semibold text-green-700">Paid</span> : efS === 'partial' ? <span className="text-xs font-semibold text-amber-700">Partial</span> : <span className="text-xs font-semibold text-red-700">Unpaid</span>}
          </div>
          {efS !== 'paid' ? <button onClick={() => onPay(student, 'exam_fee', student.exam_fee_record)} disabled={processingId === `${student.id}_exam_fee`} className="px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg">Pay</button>
            : <button onClick={() => onMarkUnpaid(student, 'exam_fee')} className="px-2 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Reset</button>}
        </div>
      )}
    </div>
  )
}
