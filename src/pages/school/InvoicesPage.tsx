import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { FeeInvoice, Student, InvoiceStatus } from '../../types'
import { CLASS_LIST, INVOICE_STATUS_LABELS } from '../../types'
import {
  Plus, X, Search, FileText, Download, ChevronDown,
  CheckCircle2, XCircle, Clock, AlertCircle,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { generateInvoicePdf } from '../../utils/invoicePdf'

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-600',
}

const STATUS_ICONS: Record<InvoiceStatus, React.ReactNode> = {
  pending: <Clock size={11} />,
  paid: <CheckCircle2 size={11} />,
  cancelled: <XCircle size={11} />,
}

const MONTHS = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
  { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
  { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' },
]

interface School {
  id: string
  name: string
  address: string | null
  phone: string | null
  class_fees: Record<string, number>
}

export default function InvoicesPage() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<FeeInvoice[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  // Form state
  const now = new Date()
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1)
  const [formYear, setFormYear] = useState(now.getFullYear())
  const [formFee, setFormFee] = useState('')
  const [formExamFee, setFormExamFee] = useState('')
  const [formDueDate, setFormDueDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`
  )

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<FeeInvoice | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Cancel receipt
  const [cancelReceiptTarget, setCancelReceiptTarget] = useState<FeeInvoice | null>(null)
  const [receiptCancelReason, setReceiptCancelReason] = useState('')
  const [cancellingReceipt, setCancellingReceipt] = useState(false)

  const canCancel = profile?.role === 'admin' || profile?.role === 'school_owner'

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const schoolId = profile!.school_id!

      const [invRes, stuRes, schRes] = await Promise.all([
        supabase
          .from('fee_invoices')
          .select('*, students(name, class)')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase
          .from('students')
          .select('id, name, class, fee_amount, exam_fee_amount, status')
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('schools')
          .select('id, name, address, phone, class_fees')
          .eq('id', schoolId)
          .single(),
      ])

      if (invRes.error) throw invRes.error
      setInvoices(invRes.data ?? [])
      setStudents((stuRes.data ?? []) as Student[])
      if (schRes.data) setSchool(schRes.data as School)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function handleStudentChange(studentId: string) {
    setSelectedStudentId(studentId)
    const student = students.find((s) => s.id === studentId)
    if (student) {
      setFormFee(String(student.fee_amount))
      setFormExamFee(String(student.exam_fee_amount || 0))
    }
  }

  function generateInvoiceNumber(): string {
    const ts = Date.now().toString().slice(-6)
    return `INV-${formYear}${String(formMonth).padStart(2, '0')}-${ts}`
  }

  async function handleGenerateInvoice() {
    if (!selectedStudentId) return toast.error('Select a student')
    if (!formDueDate) return toast.error('Enter due date')

    const feeAmt = parseFloat(formFee) || 0
    const examAmt = parseFloat(formExamFee) || 0

    if (feeAmt <= 0 && examAmt <= 0) return toast.error('Enter at least one fee amount')

    setSaving(true)
    try {
      const invoiceNumber = generateInvoiceNumber()
      const { data, error } = await supabase
        .from('fee_invoices')
        .insert({
          school_id: profile!.school_id!,
          student_id: selectedStudentId,
          invoice_number: invoiceNumber,
          month: formMonth,
          year: formYear,
          fee_amount: feeAmt,
          exam_fee_amount: examAmt,
          total_amount: feeAmt + examAmt,
          due_date: formDueDate,
          status: 'pending',
          created_by: profile!.id,
        })
        .select('*, students(name, class)')
        .single()
      if (error) throw error
      setInvoices((prev) => [data, ...prev])
      setShowForm(false)
      resetForm()
      toast.success(`Invoice ${invoiceNumber} generated — use the PDF button to download`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate invoice')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setSelectedStudentId('')
    setFormMonth(new Date().getMonth() + 1)
    setFormYear(new Date().getFullYear())
    setFormFee('')
    setFormExamFee('')
    setFormDueDate(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-10`
    )
  }

  async function downloadInvoicePdf(invoice: FeeInvoice) {
    setGeneratingPdf(invoice.id)
    try {
      const student = invoice.students ?? students.find((s) => s.id === invoice.student_id)
      generateInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        studentName: student?.name ?? 'Unknown',
        studentClass: student?.class ?? '',
        schoolName: school?.name ?? 'School',
        schoolAddress: school?.address,
        schoolPhone: school?.phone,
        month: invoice.month,
        year: invoice.year,
        feeAmount: Number(invoice.fee_amount),
        examFeeAmount: Number(invoice.exam_fee_amount),
        totalAmount: Number(invoice.total_amount),
        dueDate: invoice.due_date,
        status: invoice.status,
      })
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(null)
    }
  }

  async function markAsPaid(invoice: FeeInvoice) {
    if (!confirm(`Mark invoice ${invoice.invoice_number} as Paid?`)) return
    try {
      const { error } = await supabase
        .from('fee_invoices')
        .update({ status: 'paid' })
        .eq('id', invoice.id)
      if (error) throw error
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoice.id ? { ...i, status: 'paid' } : i))
      )
      toast.success('Invoice marked as paid')
    } catch {
      toast.error('Failed to update invoice')
    }
  }

  async function handleCancelInvoice() {
    if (!cancelTarget) return
    if (!cancelReason.trim()) return toast.error('Please enter a reason for cancellation')
    setCancelling(true)
    try {
      const { error } = await supabase
        .from('fee_invoices')
        .update({
          status: 'cancelled',
          cancelled_reason: cancelReason.trim(),
          cancelled_by: profile!.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', cancelTarget.id)
      if (error) throw error
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === cancelTarget.id
            ? { ...i, status: 'cancelled', cancelled_reason: cancelReason.trim() }
            : i
        )
      )
      toast.success('Invoice cancelled')
      setCancelTarget(null)
      setCancelReason('')
    } catch {
      toast.error('Failed to cancel invoice')
    } finally {
      setCancelling(false)
    }
  }

  const filtered = invoices.filter((inv) => {
    const studentName =
      (inv.students as { name: string; class: string } | undefined)?.name ?? ''
    const matchSearch =
      !search ||
      studentName.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus
    return matchSearch && matchStatus
  })

  const counts = {
    all: invoices.length,
    pending: invoices.filter((i) => i.status === 'pending').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    cancelled: invoices.filter((i) => i.status === 'cancelled').length,
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and manage fee invoices before collecting payment.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Generate Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: 'Pending', count: counts.pending, color: '#F59E0B' },
            { label: 'Paid', count: counts.paid, color: '#059669' },
            { label: 'Cancelled', count: counts.cancelled, color: '#EF4444' },
          ] as { label: string; count: number; color: string }[]
        ).map((s) => (
          <div key={s.label} className="card text-center py-3">
            <p className="text-xl font-bold" style={{ color: s.color }}>
              {s.count}
            </p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name or invoice number..."
            className="input-field pl-9 text-sm w-full"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as InvoiceStatus | 'all')}
            className="input-field appearance-none pr-8 text-sm"
          >
            <option value="all">All ({counts.all})</option>
            <option value="pending">Pending ({counts.pending})</option>
            <option value="paid">Paid ({counts.paid})</option>
            <option value="cancelled">Cancelled ({counts.cancelled})</option>
          </select>
          <ChevronDown
            size={13}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
          />
        </div>
      </div>

      {/* Invoice List */}
      {loading ? (
        <LoadingSpinner text="Loading invoices..." />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <FileText size={40} className="mx-auto mb-3" style={{ color: 'var(--c-text-4)' }} />
          <p className="font-medium text-gray-500">
            {search || filterStatus !== 'all' ? 'No matching invoices' : 'No invoices yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Generate an invoice before collecting payment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice) => {
            const student = invoice.students as { name: string; class: string } | undefined
            const isPending = invoice.status === 'pending'
            const isCancelled = invoice.status === 'cancelled'

            return (
              <div
                key={invoice.id}
                className={`card p-4 ${isCancelled ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">
                        {student?.name ?? '—'}
                      </p>
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[invoice.status]}`}
                      >
                        {STATUS_ICONS[invoice.status]}
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {student?.class} &nbsp;·&nbsp; {MONTHS[invoice.month - 1]?.l} {invoice.year}
                      &nbsp;·&nbsp; Due: {invoice.due_date}
                    </p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">
                      {invoice.invoice_number}
                    </p>

                    {invoice.fee_amount > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        School Fee: Rs {Number(invoice.fee_amount).toLocaleString()}
                        {invoice.exam_fee_amount > 0 &&
                          ` · Exam: Rs ${Number(invoice.exam_fee_amount).toLocaleString()}`}
                      </p>
                    )}
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      Total: Rs {Number(invoice.total_amount).toLocaleString()}
                    </p>

                    {isCancelled && invoice.cancelled_reason && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        Cancelled: {invoice.cancelled_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => downloadInvoicePdf(invoice)}
                      disabled={generatingPdf === invoice.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-3)' }}
                      title="Download PDF"
                    >
                      {generatingPdf === invoice.id ? (
                        <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      PDF
                    </button>

                    {isPending && (
                      <button
                        onClick={() => markAsPaid(invoice)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: '#059669' }}
                        title="Mark as paid"
                      >
                        <CheckCircle2 size={12} /> Paid
                      </button>
                    )}

                    {canCancel && !isCancelled && (
                      <button
                        onClick={() => setCancelTarget(invoice)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        title="Cancel invoice"
                      >
                        <XCircle size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Generate Fee Invoice</h3>
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className={labelCls}>Student *</label>
                <div className="relative">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => handleStudentChange(e.target.value)}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    <option value="">— Select student —</option>
                    {CLASS_LIST.map((cls) => {
                      const classStudents = students.filter((s) => s.class === cls)
                      if (!classStudents.length) return null
                      return (
                        <optgroup key={cls} label={cls}>
                          {classStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Month *</label>
                  <div className="relative">
                    <select
                      value={formMonth}
                      onChange={(e) => setFormMonth(Number(e.target.value))}
                      className={`${inputCls} appearance-none pr-8`}
                    >
                      {MONTHS.map((m) => (
                        <option key={m.v} value={m.v}>{m.l}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Year *</label>
                  <div className="relative">
                    <select
                      value={formYear}
                      onChange={(e) => setFormYear(Number(e.target.value))}
                      className={`${inputCls} appearance-none pr-8`}
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>School Fee (Rs)</label>
                  <input
                    type="number"
                    value={formFee}
                    onChange={(e) => setFormFee(e.target.value)}
                    min={0}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Exam Fee (Rs)</label>
                  <input
                    type="number"
                    value={formExamFee}
                    onChange={(e) => setFormExamFee(e.target.value)}
                    min={0}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>

              {(parseFloat(formFee) || 0) + (parseFloat(formExamFee) || 0) > 0 && (
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ backgroundColor: 'var(--c-surface-2)' }}
                >
                  <span className="text-sm font-medium text-gray-600">Total Amount</span>
                  <span className="text-base font-bold text-gray-900">
                    Rs{' '}
                    {(
                      (parseFloat(formFee) || 0) + (parseFloat(formExamFee) || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <label className={labelCls}>Due Date *</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={saving}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText size={14} /> Generate Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Cancel Invoice</h3>
              <button
                onClick={() => { setCancelTarget(null); setCancelReason('') }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div
                className="flex items-start gap-2 text-sm p-3 rounded-xl"
                style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
              >
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Cancel invoice {cancelTarget.invoice_number}?
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Reason for Cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={3}
                  className="input-field text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setCancelTarget(null); setCancelReason('') }}
                className="btn-secondary flex-1 text-sm"
              >
                Keep Invoice
              </button>
              <button
                onClick={handleCancelInvoice}
                disabled={cancelling}
                className="flex-1 text-sm py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Cancel Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
