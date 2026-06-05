import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FeeType, PaymentMethod, FeeStatus } from '../types'
import { FEE_TYPE_LABELS, getPeriodLabel } from '../types'

// ── Receipt ──────────────────────────────────────────────────────────────────

export interface ReceiptOptions {
  schoolName: string
  studentName: string
  studentClass: string
  parentPhone?: string | null
  feeType: FeeType
  dueAmount: number
  amountPaid: number
  totalPaidSoFar: number
  remaining: number
  paymentMethod: PaymentMethod
  month: number
  year: number
  periodLabel?: string
  resetType?: 'monthly' | 'term'
}

export function generateReceipt(opts: ReceiptOptions): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15

  const receiptNo = `RCT-${Date.now().toString(36).toUpperCase()}`
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const periodStr = opts.periodLabel ?? getPeriodLabel(opts.month, opts.year, opts.resetType ?? 'monthly')

  // Header
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.schoolName, pageW / 2, 11, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('FEE PAYMENT RECEIPT', pageW / 2, 18, { align: 'center' })
  doc.text(`Receipt No: ${receiptNo}`, pageW / 2, 24, { align: 'center' })

  doc.setTextColor(30, 30, 30)
  let y = 36

  // Student info box
  doc.setFillColor(245, 247, 255)
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Student', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(opts.studentName, margin + 4, y + 12)
  doc.text(opts.studentClass, margin + 4, y + 18)
  if (opts.parentPhone) {
    doc.setTextColor(99, 102, 241)
    doc.text(`Parent: ${opts.parentPhone}`, pageW / 2, y + 12)
    doc.setTextColor(30, 30, 30)
  }
  doc.text(`Period: ${periodStr}`, pageW / 2, y + 18)
  doc.text(`Date: ${dateStr}`, pageW - margin - 4, y + 12, { align: 'right' })

  y += 28

  // Fee details table — use only ASCII characters in all cell values
  const isPartial = opts.remaining > 0
  const methodLabel = opts.paymentMethod === 'cash' ? 'Cash' : 'Online Transfer'
  const feeTypeLabel = FEE_TYPE_LABELS[opts.feeType]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Description', 'Amount']],
    body: [
      [`${feeTypeLabel} - ${periodStr}`, `Rs ${opts.dueAmount.toLocaleString()}`],
      ['Paid This Transaction', `Rs ${opts.amountPaid.toLocaleString()}`],
      opts.totalPaidSoFar !== opts.amountPaid
        ? ['Total Paid So Far', `Rs ${opts.totalPaidSoFar.toLocaleString()}`]
        : null,
      isPartial ? ['Remaining Balance', `Rs ${opts.remaining.toLocaleString()}`] : null,
      ['Payment Method', methodLabel],
    ].filter(Boolean) as string[][],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', fontStyle: 'bold' } },
  })

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Status banner — plain ASCII only, no special characters
  const bannerColor = isPartial ? [245, 158, 11] : [22, 163, 74]
  doc.setFillColor(bannerColor[0], bannerColor[1], bannerColor[2])
  doc.rect(margin, finalY, pageW - margin * 2, 9, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(
    isPartial
      ? `PARTIAL PAYMENT - Rs ${opts.remaining.toLocaleString()} remaining`
      : 'FULLY PAID',
    pageW / 2,
    finalY + 5.5,
    { align: 'center' }
  )

  doc.setTextColor(150, 150, 150)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.text('This is a computer-generated receipt.', pageW / 2, finalY + 16, { align: 'center' })

  const filename = `Receipt_${opts.studentName.replace(/\s+/g, '_')}_${opts.month}-${opts.year}.pdf`
  doc.save(filename)
}

// ── Defaulters Report ─────────────────────────────────────────────────────────

export interface DefaulterEntry {
  name: string
  studentClass: string
  feeType: FeeType
  dueAmount: number
  paidAmount: number
  remaining: number
  daysOverdue: number
  parentPhone?: string | null
  status: FeeStatus
}

export interface DefaultersReportOptions {
  defaulters: DefaulterEntry[]
  schoolName: string
  month: number
  year: number
  periodLabel: string
}

export function generateDefaultersReport(opts: DefaultersReportOptions): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // Header
  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${opts.schoolName} - Defaulters Report`, pageW / 2, 10, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Period: ${opts.periodLabel}  |  Generated: ${new Date().toLocaleDateString('en-GB')}  |  ${opts.defaulters.length} defaulter(s)`,
    pageW / 2,
    17,
    { align: 'center' }
  )

  doc.setTextColor(30, 30, 30)

  autoTable(doc, {
    startY: 28,
    margin: { left: margin, right: margin },
    head: [
      ['#', 'Student Name', 'Class', 'Fee Type', 'Due (Rs)', 'Paid (Rs)', 'Remaining (Rs)', 'Days Overdue', 'Status', 'Parent Phone'],
    ],
    body: opts.defaulters.map((d, i) => [
      i + 1,
      d.name,
      d.studentClass,
      FEE_TYPE_LABELS[d.feeType],
      d.dueAmount.toLocaleString(),
      d.paidAmount.toLocaleString(),
      d.remaining.toLocaleString(),
      d.daysOverdue > 0 ? `${d.daysOverdue}d` : '-',
      d.status.charAt(0).toUpperCase() + d.status.slice(1),
      d.parentPhone ?? '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'center' },
      8: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val !== '-') data.cell.styles.textColor = [220, 38, 38]
      }
      if (data.section === 'body' && data.column.index === 8) {
        const val = String(data.cell.raw).toLowerCase()
        if (val === 'unpaid') data.cell.styles.textColor = [220, 38, 38]
        if (val === 'partial') data.cell.styles.textColor = [180, 90, 0]
      }
    },
  })

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  const totalDue = opts.defaulters.reduce((s, d) => s + d.dueAmount, 0)
  const totalPaid = opts.defaulters.reduce((s, d) => s + d.paidAmount, 0)
  const totalRemaining = opts.defaulters.reduce((s, d) => s + d.remaining, 0)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(220, 38, 38)
  doc.text(
    `Total Pending: Rs ${totalRemaining.toLocaleString()}   |   Total Due: Rs ${totalDue.toLocaleString()}   |   Total Partial Paid: Rs ${totalPaid.toLocaleString()}`,
    pageW / 2,
    finalY,
    { align: 'center' }
  )

  const filename = `Defaulters_${opts.schoolName.replace(/\s+/g, '_')}_${opts.month}-${opts.year}.pdf`
  doc.save(filename)
}

// ── Monthly Summary Report ────────────────────────────────────────────────────

export interface ClassSummaryRow {
  className: string
  students: number
  schoolFeeExpected: number
  schoolFeeCollected: number
  examFeeExpected: number
  examFeeCollected: number
}

export interface SummaryReportOptions {
  schoolName: string
  month: number
  year: number
  periodLabel: string
  totalStudents: number
  totalExpected: number
  totalCollected: number
  totalPending: number
  classSummary: ClassSummaryRow[]
}

export function generateSummaryReport(opts: SummaryReportOptions): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // Header
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${opts.schoolName} - Monthly Summary Report`, pageW / 2, 10, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Period: ${opts.periodLabel}  |  Generated: ${new Date().toLocaleDateString('en-GB')}`,
    pageW / 2,
    17,
    { align: 'center' }
  )

  doc.setTextColor(30, 30, 30)
  let y = 28

  // Overall stats box
  doc.setFillColor(245, 247, 255)
  doc.roundedRect(margin, y, pageW - margin * 2, 18, 3, 3, 'F')
  const stats = [
    { label: 'Total Students', value: String(opts.totalStudents) },
    { label: 'Total Expected', value: `Rs ${opts.totalExpected.toLocaleString()}` },
    { label: 'Total Collected', value: `Rs ${opts.totalCollected.toLocaleString()}` },
    { label: 'Total Pending', value: `Rs ${opts.totalPending.toLocaleString()}` },
    {
      label: 'Collection %',
      value: opts.totalExpected > 0
        ? `${Math.round((opts.totalCollected / opts.totalExpected) * 100)}%`
        : '0%',
    },
  ]
  const colWidth = (pageW - margin * 2) / stats.length
  stats.forEach((stat, i) => {
    const x = margin + i * colWidth + colWidth / 2
    doc.setTextColor(99, 102, 241)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(stat.value, x, y + 8, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(stat.label, x, y + 14, { align: 'center' })
  })

  y += 24

  // Class breakdown
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Class-wise Breakdown', margin, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        'Class', 'Students',
        'SF Expected', 'SF Collected', 'SF Pending', 'SF %',
        'EF Expected', 'EF Collected', 'EF Pending',
      ],
    ],
    body: opts.classSummary.map((row) => {
      const sfPending = row.schoolFeeExpected - row.schoolFeeCollected
      const sfPct = row.schoolFeeExpected > 0
        ? `${Math.round((row.schoolFeeCollected / row.schoolFeeExpected) * 100)}%`
        : 'N/A'
      const efPending = row.examFeeExpected - row.examFeeCollected
      return [
        row.className,
        row.students,
        row.schoolFeeExpected.toLocaleString(),
        row.schoolFeeCollected.toLocaleString(),
        sfPending.toLocaleString(),
        sfPct,
        row.examFeeExpected > 0 ? row.examFeeExpected.toLocaleString() : 'N/A',
        row.examFeeCollected > 0 ? row.examFeeCollected.toLocaleString() : 'N/A',
        row.examFeeExpected > 0 ? efPending.toLocaleString() : 'N/A',
      ]
    }),
    foot: [
      [
        'TOTAL',
        opts.totalStudents,
        opts.classSummary.reduce((s, r) => s + r.schoolFeeExpected, 0).toLocaleString(),
        opts.classSummary.reduce((s, r) => s + r.schoolFeeCollected, 0).toLocaleString(),
        opts.classSummary.reduce((s, r) => s + (r.schoolFeeExpected - r.schoolFeeCollected), 0).toLocaleString(),
        '',
        opts.classSummary.reduce((s, r) => s + r.examFeeExpected, 0).toLocaleString(),
        opts.classSummary.reduce((s, r) => s + r.examFeeCollected, 0).toLocaleString(),
        opts.classSummary.reduce((s, r) => s + (r.examFeeExpected - r.examFeeCollected), 0).toLocaleString(),
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: [230, 234, 255], textColor: [30, 30, 100], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  })

  const filename = `Summary_${opts.schoolName.replace(/\s+/g, '_')}_${opts.month}-${opts.year}.pdf`
  doc.save(filename)
}
