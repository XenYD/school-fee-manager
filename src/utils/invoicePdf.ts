import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface InvoicePdfOptions {
  invoiceNumber: string
  studentName: string
  studentClass: string
  schoolName: string
  schoolAddress?: string | null
  schoolPhone?: string | null
  month: number
  year: number
  feeAmount: number
  examFeeAmount: number
  totalAmount: number
  dueDate: string
  status: string
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export function generateInvoicePdf(opts: InvoicePdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  const W = 148
  const margin = 12

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 45, 82)
  doc.rect(0, 0, W, 32, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text(opts.schoolName, margin, 12)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  if (opts.schoolAddress) doc.text(opts.schoolAddress, margin, 18)
  if (opts.schoolPhone) doc.text(`Phone: ${opts.schoolPhone}`, margin, 23)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(74, 144, 217)
  doc.text('FEE INVOICE', W - margin, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 200, 220)
  doc.text(opts.invoiceNumber, W - margin, 18, { align: 'right' })
  doc.text(
    `${MONTHS[opts.month - 1]} ${opts.year}`,
    W - margin,
    23,
    { align: 'right' }
  )

  let y = 38

  // ── Invoice Info ──────────────────────────────────────────────────────────
  doc.setFillColor(248, 249, 250)
  doc.roundedRect(margin, y, W - margin * 2, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text(opts.studentName, margin + 4, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text(`Class: ${opts.studentClass}`, margin + 4, y + 15)
  doc.text(`Due Date: ${opts.dueDate}`, margin + 4, y + 21)

  // Status badge
  const statusColor = opts.status === 'paid'
    ? [5, 150, 105]
    : opts.status === 'cancelled'
    ? [239, 68, 68]
    : [245, 158, 11]
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.roundedRect(W - margin - 28, y + 6, 24, 8, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.text(opts.status.toUpperCase(), W - margin - 16, y + 11.5, { align: 'center' })

  y += 34

  // ── Fee Breakdown ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 45, 82)
  doc.text('FEE BREAKDOWN', margin, y)
  y += 4
  doc.setDrawColor(15, 45, 82)
  doc.setLineWidth(0.4)
  doc.line(margin, y, W - margin, y)
  y += 3

  const rows: [string, string][] = []
  if (opts.feeAmount > 0) rows.push(['School Fee', `Rs ${Number(opts.feeAmount).toLocaleString()}`])
  if (opts.examFeeAmount > 0) rows.push(['Exam Fee', `Rs ${Number(opts.examFeeAmount).toLocaleString()}`])

  autoTable(doc, {
    startY: y,
    head: [],
    body: rows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
    columnStyles: {
      0: { fontStyle: 'normal', textColor: [60, 60, 60] },
      1: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20] },
    },
    margin: { left: margin, right: margin },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2

  // Divider + Total
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, W - margin, y)
  y += 5

  doc.setFillColor(15, 45, 82)
  doc.roundedRect(margin, y, W - margin * 2, 10, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL DUE', margin + 4, y + 7)
  doc.text(`Rs ${Number(opts.totalAmount).toLocaleString()}`, W - margin - 4, y + 7, { align: 'right' })
  y += 16

  // ── Note ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Please pay before the due date to avoid late fees.', margin, y)

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 45, 82)
  doc.rect(0, 195, W, 15, 'F')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(180, 200, 220)
  doc.text(
    'Computer-generated invoice by FeeFlow. No signature required.',
    W / 2,
    204,
    { align: 'center' }
  )

  doc.save(`Invoice_${opts.invoiceNumber}_${opts.studentName.replace(/ /g, '_')}.pdf`)
}
