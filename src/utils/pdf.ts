import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { StudentWithFee } from '../types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface ReceiptOptions {
  student: StudentWithFee
  schoolName: string
  month: number
  year: number
}

interface SummaryOptions {
  students: StudentWithFee[]
  schoolName: string
  month: number
  year: number
}

export async function generateReceipt({ student, schoolName, month, year }: ReceiptOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })

  const pageW = doc.internal.pageSize.getWidth()
  const monthName = MONTHS[month - 1]
  const receiptNo = `REC-${year}${String(month).padStart(2, '0')}-${student.id.slice(0, 6).toUpperCase()}`

  // Header background
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 35, 'F')

  // School Name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(schoolName, pageW / 2, 14, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('FEE PAYMENT RECEIPT', pageW / 2, 22, { align: 'center' })

  doc.setFontSize(8)
  doc.text(`Receipt No: ${receiptNo}`, pageW / 2, 29, { align: 'center' })

  // PAID Stamp
  if (student.fee_record?.paid) {
    doc.setFillColor(34, 197, 94, 0.15)
    doc.setDrawColor(34, 197, 94)
    doc.setLineWidth(0.8)
    doc.roundedRect(pageW - 48, 37, 40, 14, 3, 3, 'FD')
    doc.setTextColor(22, 163, 74)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('✓ PAID', pageW - 28, 46, { align: 'center' })
  }

  // Student Details
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Student Details', 15, 45)

  doc.setLineWidth(0.3)
  doc.setDrawColor(229, 231, 235)
  doc.line(15, 47, pageW - 15, 47)

  const paymentMethod = student.fee_record?.payment_method
  const paymentMethodLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'online' ? 'Online Transfer' : '—'

  const details: [string, string][] = [
    ['Student Name', student.name],
    ['Class', student.class],
    ['Parent Phone', student.parent_phone ?? '—'],
    ['Month', `${monthName} ${year}`],
    ['Payment Method', paymentMethodLabel],
  ]

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let y = 53
  details.forEach(([label, value]) => {
    doc.setTextColor(107, 114, 128)
    doc.text(label, 15, y)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.text(value, 70, y)
    doc.setFont('helvetica', 'normal')
    y += 8
  })

  // Amount Box
  doc.setFillColor(243, 244, 246)
  doc.roundedRect(15, y + 2, pageW - 30, 22, 3, 3, 'F')
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'normal')
  doc.text('Amount Paid', pageW / 2, y + 11, { align: 'center' })
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(79, 70, 229)
  doc.text(Number(student.fee_amount).toLocaleString(), pageW / 2, y + 21, { align: 'center' })

  y += 32

  // Payment Date
  if (student.fee_record?.paid_date) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    const paidDate = new Date(student.fee_record.paid_date).toLocaleDateString('en-US', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    doc.text(`Payment Date: ${paidDate}`, pageW / 2, y, { align: 'center' })
    y += 7
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.setFont('helvetica', 'italic')
  doc.text('This is a computer-generated receipt. No signature required.', pageW / 2, y + 5, { align: 'center' })
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageW / 2, y + 11, { align: 'center' })

  doc.save(`Receipt_${student.name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`)
}

export async function generateSummaryReport({ students, schoolName, month, year }: SummaryOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const monthName = MONTHS[month - 1]
  const paid = students.filter((s) => s.fee_record?.paid)
  const unpaid = students.filter((s) => !s.fee_record?.paid)
  const totalExpected = students.reduce((s, st) => s + Number(st.fee_amount), 0)
  const totalCollected = paid.reduce((s, st) => s + Number(st.fee_amount), 0)
  const totalPending = totalExpected - totalCollected

  // Header
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 38, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(schoolName, pageW / 2, 15, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Monthly Fee Collection Report', pageW / 2, 24, { align: 'center' })

  doc.setFontSize(9)
  doc.text(`${monthName} ${year}`, pageW / 2, 32, { align: 'center' })

  // Summary Stats
  let y = 50
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 15, y)
  y += 5

  const summaryRows = [
    ['Total Students', students.length.toString(), ''],
    ['Total Expected', totalExpected.toLocaleString(), ''],
    ['Total Collected', totalCollected.toLocaleString(), `${Math.round((totalCollected / totalExpected) * 100) || 0}%`],
    ['Total Pending', totalPending.toLocaleString(), `${Math.round((totalPending / totalExpected) * 100) || 0}%`],
    ['Students Paid', paid.length.toString(), ''],
    ['Students Unpaid', unpaid.length.toString(), ''],
  ]

  autoTable(doc, {
    startY: y + 2,
    head: [['Metric', 'Value', 'Percentage']],
    body: summaryRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
    },
    margin: { left: 15, right: 15 },
  })

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Detailed Table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Student Details', 15, afterSummary)

  const tableRows = students.map((s, idx) => [
    (idx + 1).toString(),
    s.name,
    s.class,
    Number(s.fee_amount).toLocaleString(),
    s.fee_record?.paid ? 'PAID' : 'UNPAID',
    s.fee_record?.payment_method
      ? s.fee_record.payment_method === 'cash' ? 'Cash' : 'Online'
      : '—',
    s.fee_record?.paid_date
      ? new Date(s.fee_record.paid_date).toLocaleDateString()
      : '—',
  ])

  autoTable(doc, {
    startY: afterSummary + 5,
    head: [['#', 'Student Name', 'Class', 'Fee', 'Status', 'Method', 'Payment Date']],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: [51, 51, 51] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        if (data.cell.raw === 'PAID') {
          data.cell.styles.textColor = [22, 163, 74]
          data.cell.styles.fontStyle = 'bold'
        } else {
          data.cell.styles.textColor = [220, 38, 38]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
    margin: { left: 15, right: 15 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.setFont('helvetica', 'italic')
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }

  doc.save(`Fee_Report_${monthName}_${year}_${schoolName.replace(/\s+/g, '_')}.pdf`)
}
