import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FeeType, PaymentMethod, FeeStatus } from '../types'
import { FEE_TYPE_LABELS, getPeriodLabel } from '../types'

// ── Brand colours ─────────────────────────────────────────────────────────────
const NAVY  = [15, 45, 82]    as [number, number, number]   // #0F2D52
const BLUE  = [74, 144, 217]  as [number, number, number]   // #4A90D9
const GREEN = [46, 204, 113]  as [number, number, number]   // #2ECC71
const AMBER = [230, 126, 34]  as [number, number, number]   // #E67E22
const LIGHT = [248, 249, 250] as [number, number, number]   // #F8F9FA
const DARK  = [30, 30, 30]    as [number, number, number]
const GRAY  = [120, 120, 120] as [number, number, number]

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
  const doc  = new jsPDF({ unit: 'mm', format: 'a5' })
  const W    = doc.internal.pageSize.getWidth()   // 148 mm
  const H    = doc.internal.pageSize.getHeight()  // 210 mm
  const M    = 14                                  // margin

  const receiptNo  = `RCT-${Date.now().toString(36).toUpperCase()}`
  const dateStr    = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr    = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const periodStr  = opts.periodLabel ?? getPeriodLabel(opts.month, opts.year, opts.resetType ?? 'monthly')
  const methodLabel = opts.paymentMethod === 'cash' ? 'Cash' : 'Online Transfer'
  const feeTypeLabel = FEE_TYPE_LABELS[opts.feeType]
  const isPartial  = opts.remaining > 0

  // ── 1. Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 34, 'F')

  // School name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.schoolName.toUpperCase(), W / 2, 11, { align: 'center' })

  // Subtitle
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 215, 235)
  doc.text('FEE PAYMENT RECEIPT', W / 2, 18, { align: 'center' })

  // Thin white divider
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.25)
  doc.line(M, 22, W - M, 22)

  // Powered by FeeFlow
  doc.setTextColor(...BLUE)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Powered by FeeFlow', W / 2, 29, { align: 'center' })

  // ── 2. Receipt meta row ────────────────────────────────────────────────────
  let y = 40
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Receipt No: ${receiptNo}`, M, y)
  doc.text(`Date: ${dateStr}  ${timeStr}`, W - M, y, { align: 'right' })

  // Thin separator line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(M, y + 4, W - M, y + 4)

  // ── 3. Student info box ────────────────────────────────────────────────────
  y += 10
  const hasPhone = !!(opts.parentPhone)
  const boxH = hasPhone ? 28 : 22

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, y, W - M * 2, boxH, 2, 2, 'FD')

  // Left: BILL TO label + student name + class
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('BILL TO', M + 4, y + 5.5)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(opts.studentName, M + 4, y + 12)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(opts.studentClass, M + 4, y + 18)

  // Right: Period + Date
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('PERIOD', W - M - 4, y + 5.5, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(periodStr, W - M - 4, y + 12, { align: 'right' })

  // Parent phone (if present) — plain dark text, no blue
  if (hasPhone) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    doc.text(`Parent: ${opts.parentPhone}`, M + 4, y + 24.5)
  }

  // ── 4. Fee details table ───────────────────────────────────────────────────
  y += boxH + 6

  const tableBody: (string | number)[][] = [
    [`${feeTypeLabel}  -  ${periodStr}`, `Rs ${opts.dueAmount.toLocaleString()}`],
    ['Amount Paid (This Transaction)', `Rs ${opts.amountPaid.toLocaleString()}`],
  ]
  if (opts.totalPaidSoFar !== opts.amountPaid) {
    tableBody.push(['Total Paid So Far', `Rs ${opts.totalPaidSoFar.toLocaleString()}`])
  }
  if (isPartial) {
    tableBody.push(['Remaining Balance', `Rs ${opts.remaining.toLocaleString()}`])
  }
  tableBody.push(['Payment Method', methodLabel])

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Description', 'Amount (Rs)']],
    body: tableBody as string[][],
    theme: 'striped',
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: DARK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
    },
    alternateRowStyles: { fillColor: LIGHT },
    styles: { lineColor: [220, 220, 220], lineWidth: 0.25 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
    },
  })

  const afterTable = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // ── 5. Status badge (right-aligned, elegant) ───────────────────────────────
  const badgeY    = afterTable + 7
  const badgeH    = 9
  const badgeW    = isPartial ? 72 : 44
  const badgeX    = W - M - badgeW

  if (isPartial) {
    // Partial payment — amber badge
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...AMBER)
    doc.setLineWidth(0.7)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'FD')
    // Draw amber exclamation
    doc.setDrawColor(...AMBER)
    doc.setLineWidth(0.9)
    doc.line(badgeX + 5, badgeY + 2.5, badgeX + 5, badgeY + 5.5)
    doc.circle(badgeX + 5, badgeY + 7, 0.6, 'F')
    doc.setFillColor(...AMBER)
    // Text
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...AMBER)
    doc.text(
      `PARTIAL  -  Rs ${opts.remaining.toLocaleString()} remaining`,
      badgeX + badgeW / 2 + 2,
      badgeY + 5.8,
      { align: 'center' }
    )
  } else {
    // Fully paid — green badge with tick
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(0.7)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'FD')
    // Draw checkmark tick (manual lines)
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(1.1)
    const tx = badgeX + 5.5
    const ty = badgeY + 5.5
    doc.line(tx,       ty,       tx + 2.2, ty + 2.2)
    doc.line(tx + 2.2, ty + 2.2, tx + 5.5, ty - 1.8)
    // Text
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GREEN)
    doc.text('FULLY PAID', badgeX + badgeW / 2 + 3, badgeY + 5.9, { align: 'center' })
  }

  // ── 6. Footer ──────────────────────────────────────────────────────────────
  const footerY = H - 12
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.5)
  doc.line(M, footerY, W - M, footerY)

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...GRAY)
  doc.text(
    'This is a computer generated receipt by FeeFlow.',
    W / 2,
    footerY + 5,
    { align: 'center' }
  )

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
  const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const W    = doc.internal.pageSize.getWidth()
  const M    = 14

  // Header
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${opts.schoolName} — Defaulters Report`, W / 2, 10, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 215, 235)
  doc.text(
    `Period: ${opts.periodLabel}   |   Generated: ${new Date().toLocaleDateString('en-GB')}   |   ${opts.defaulters.length} defaulter(s)`,
    W / 2, 17, { align: 'center' }
  )
  doc.setTextColor(...BLUE)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Powered by FeeFlow', W / 2, 23, { align: 'center' })

  doc.setTextColor(...DARK)

  autoTable(doc, {
    startY: 30,
    margin: { left: M, right: M },
    head: [['#', 'Student Name', 'Class', 'Fee Type', 'Due (Rs)', 'Paid (Rs)', 'Remaining (Rs)', 'Overdue', 'Status', 'Parent Phone']],
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
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    styles: { lineColor: [220, 220, 220], lineWidth: 0.25 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      4: { halign: 'right' }, 5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'center' }, 8: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val !== '-') data.cell.styles.textColor = [192, 57, 43]
      }
      if (data.section === 'body' && data.column.index === 8) {
        const val = String(data.cell.raw).toLowerCase()
        if (val === 'unpaid') data.cell.styles.textColor = [192, 57, 43]
        if (val === 'partial') data.cell.styles.textColor = [174, 94, 0]
      }
    },
  })

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
  const totalDue       = opts.defaulters.reduce((s, d) => s + d.dueAmount, 0)
  const totalPaid      = opts.defaulters.reduce((s, d) => s + d.paidAmount, 0)
  const totalRemaining = opts.defaulters.reduce((s, d) => s + d.remaining, 0)

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, finalY, W - M * 2, 10, 2, 2, 'FD')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(
    `Total Pending: Rs ${totalRemaining.toLocaleString()}     Total Due: Rs ${totalDue.toLocaleString()}     Total Collected: Rs ${totalPaid.toLocaleString()}`,
    W / 2, finalY + 6.5, { align: 'center' }
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
  const W   = doc.internal.pageSize.getWidth()
  const M   = 14

  // Header
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${opts.schoolName} — Monthly Summary Report`, W / 2, 10, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 215, 235)
  doc.text(
    `Period: ${opts.periodLabel}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
    W / 2, 17, { align: 'center' }
  )
  doc.setTextColor(...BLUE)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Powered by FeeFlow', W / 2, 23, { align: 'center' })

  doc.setTextColor(...DARK)
  let y = 30

  // Summary stats box
  const stats = [
    { label: 'Total Students',  value: String(opts.totalStudents) },
    { label: 'Expected (Rs)',   value: opts.totalExpected.toLocaleString() },
    { label: 'Collected (Rs)',  value: opts.totalCollected.toLocaleString() },
    { label: 'Pending (Rs)',    value: opts.totalPending.toLocaleString() },
    {
      label: 'Collection Rate',
      value: opts.totalExpected > 0
        ? `${Math.round((opts.totalCollected / opts.totalExpected) * 100)}%`
        : '0%',
    },
  ]
  const colW = (W - M * 2) / stats.length

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, y, W - M * 2, 18, 2, 2, 'FD')

  stats.forEach((stat, i) => {
    const cx = M + i * colW + colW / 2
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(stat.value, cx, y + 9, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(stat.label, cx, y + 14.5, { align: 'center' })
    // Divider between cols
    if (i > 0) {
      doc.setDrawColor(210, 210, 210)
      doc.setLineWidth(0.2)
      doc.line(M + i * colW, y + 3, M + i * colW, y + 15)
    }
  })

  y += 24

  // Section title
  doc.setTextColor(...DARK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Class-wise Fee Breakdown', M, y)
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Class', 'Students', 'SF Expected', 'SF Collected', 'SF Pending', 'SF %', 'EF Expected', 'EF Collected', 'EF Pending']],
    body: opts.classSummary.map((row) => {
      const sfPending = row.schoolFeeExpected - row.schoolFeeCollected
      const sfPct     = row.schoolFeeExpected > 0
        ? `${Math.round((row.schoolFeeCollected / row.schoolFeeExpected) * 100)}%`
        : 'N/A'
      const efPending = row.examFeeExpected - row.examFeeCollected
      return [
        row.className, row.students,
        row.schoolFeeExpected.toLocaleString(),
        row.schoolFeeCollected.toLocaleString(),
        sfPending.toLocaleString(), sfPct,
        row.examFeeExpected > 0 ? row.examFeeExpected.toLocaleString() : 'N/A',
        row.examFeeCollected > 0 ? row.examFeeCollected.toLocaleString() : 'N/A',
        row.examFeeExpected > 0 ? efPending.toLocaleString() : 'N/A',
      ]
    }),
    foot: [[
      'TOTAL', opts.totalStudents,
      opts.classSummary.reduce((s, r) => s + r.schoolFeeExpected, 0).toLocaleString(),
      opts.classSummary.reduce((s, r) => s + r.schoolFeeCollected, 0).toLocaleString(),
      opts.classSummary.reduce((s, r) => s + (r.schoolFeeExpected - r.schoolFeeCollected), 0).toLocaleString(),
      '',
      opts.classSummary.reduce((s, r) => s + r.examFeeExpected, 0).toLocaleString(),
      opts.classSummary.reduce((s, r) => s + r.examFeeCollected, 0).toLocaleString(),
      opts.classSummary.reduce((s, r) => s + (r.examFeeExpected - r.examFeeCollected), 0).toLocaleString(),
    ]],
    theme: 'striped',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    footStyles: { fillColor: [230, 237, 247], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
    styles: { lineColor: [220, 220, 220], lineWidth: 0.25 },
    columnStyles: {
      0: { fontStyle: 'bold' }, 1: { halign: 'center' },
      2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
      5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' },
    },
  })

  const filename = `Summary_${opts.schoolName.replace(/\s+/g, '_')}_${opts.month}-${opts.year}.pdf`
  doc.save(filename)
}
