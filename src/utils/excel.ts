import * as XLSX from 'xlsx'
import type { ImportRow, FeeType } from '../types'
import { FEE_TYPE_LABELS, getPeriodLabel } from '../types'

const COLUMN_ALIASES: Record<string, keyof ImportRow> = {
  'student name': 'name',
  'name': 'name',
  'student': 'name',
  'full name': 'name',
  'class': 'class',
  'grade': 'class',
  'section': 'class',
  'fee amount': 'fee_amount',
  'fee': 'fee_amount',
  'amount': 'fee_amount',
  'monthly fee': 'fee_amount',
  'fees': 'fee_amount',
  'parent phone': 'parent_phone',
  'phone': 'parent_phone',
  'phone number': 'parent_phone',
  'mobile': 'parent_phone',
  'contact': 'parent_phone',
  'parent contact': 'parent_phone',
  'parent mobile': 'parent_phone',
}

export function parseExcel(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: '',
        })

        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'))
          return
        }

        // Map column headers
        const headers = Object.keys(jsonData[0])
        const columnMap: Record<string, keyof ImportRow> = {}

        headers.forEach((header) => {
          const normalized = header.toLowerCase().trim()
          const mapped = COLUMN_ALIASES[normalized]
          if (mapped) columnMap[header] = mapped
        })

        const required: (keyof ImportRow)[] = ['name', 'class', 'fee_amount']
        const missing = required.filter((r) => !Object.values(columnMap).includes(r))

        if (missing.length > 0) {
          reject(new Error(
            `Missing required columns: ${missing.join(', ')}. ` +
            `Expected columns: "Student Name", "Class", "Fee Amount", "Parent Phone"`
          ))
          return
        }

        const rows: ImportRow[] = []
        const errors: string[] = []

        jsonData.forEach((row, idx) => {
          const lineNum = idx + 2

          const name = String(row[Object.keys(columnMap).find((k) => columnMap[k] === 'name') ?? ''] ?? '').trim()
          const cls = String(row[Object.keys(columnMap).find((k) => columnMap[k] === 'class') ?? ''] ?? '').trim()
          const feeRaw = row[Object.keys(columnMap).find((k) => columnMap[k] === 'fee_amount') ?? '']
          const phoneKey = Object.keys(columnMap).find((k) => columnMap[k] === 'parent_phone')
          const phone = phoneKey ? String(row[phoneKey] ?? '').trim() : ''

          if (!name) { errors.push(`Row ${lineNum}: Student name is required`); return }
          if (!cls) { errors.push(`Row ${lineNum}: Class is required`); return }

          const feeAmount = parseFloat(String(feeRaw).replace(/[,\s]/g, ''))
          if (isNaN(feeAmount) || feeAmount < 0) {
            errors.push(`Row ${lineNum}: Invalid fee amount "${feeRaw}"`)
            return
          }

          rows.push({ name, class: cls, fee_amount: feeAmount, parent_phone: phone })
        })

        if (errors.length > 0 && rows.length === 0) {
          reject(new Error(`Import errors:\n${errors.slice(0, 5).join('\n')}`))
          return
        }

        if (errors.length > 0) {
          console.warn('Some rows skipped:', errors)
        }

        resolve(rows)
      } catch (err) {
        reject(new Error('Failed to parse Excel file: ' + (err instanceof Error ? err.message : 'Unknown error')))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Defaulters Excel Export ─────────────────────────────────────────────────

import type { FeeStatus } from '../types'

export interface DefaulterExcelEntry {
  name: string
  studentClass: string
  feeType: FeeType
  dueAmount: number
  paidAmount: number
  remaining: number
  daysOverdue: number
  status: FeeStatus
  parentPhone?: string | null
}

export function exportDefaultersExcel(
  defaulters: DefaulterExcelEntry[],
  schoolName: string,
  month: number,
  year: number,
  periodLabel?: string
): void {
  const label = periodLabel ?? getPeriodLabel(month, year)
  const rows = defaulters.map((d, i) => ({
    '#': i + 1,
    'Student Name': d.name,
    'Class': d.studentClass,
    'Fee Type': FEE_TYPE_LABELS[d.feeType],
    'Due Amount (Rs)': d.dueAmount,
    'Paid Amount (Rs)': d.paidAmount,
    'Remaining (Rs)': d.remaining,
    'Days Overdue': d.daysOverdue > 0 ? d.daysOverdue : 0,
    'Status': d.status.charAt(0).toUpperCase() + d.status.slice(1),
    'Parent Phone': d.parentPhone ?? '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 10 }, { wch: 15 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Defaulters')

  // Summary sheet
  const totalDue = defaulters.reduce((s, d) => s + d.dueAmount, 0)
  const totalPaid = defaulters.reduce((s, d) => s + d.paidAmount, 0)
  const totalRemaining = defaulters.reduce((s, d) => s + d.remaining, 0)
  const summaryRows = [
    { Info: 'School', Value: schoolName },
    { Info: 'Period', Value: label },
    { Info: 'Generated', Value: new Date().toLocaleDateString('en-GB') },
    { Info: 'Total Defaulters', Value: defaulters.length },
    { Info: 'Total Due (Rs)', Value: totalDue },
    { Info: 'Total Paid (Rs)', Value: totalPaid },
    { Info: 'Total Remaining (Rs)', Value: totalRemaining },
  ]
  const sumWs = XLSX.utils.json_to_sheet(summaryRows)
  sumWs['!cols'] = [{ wch: 22 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, sumWs, 'Summary')

  XLSX.writeFile(wb, `Defaulters_${schoolName.replace(/\s+/g, '_')}_${month}-${year}.xlsx`)
}

// ─── Monthly Report Excel Export ─────────────────────────────────────────────

export interface MonthlyReportOptions {
  schoolName: string
  month: number
  year: number
  periodLabel?: string
  totalStudents: number
  totalExpected: number
  totalCollected: number
  totalPending: number
  classSummary: Array<{
    className: string
    students: number
    schoolFeeExpected: number
    schoolFeeCollected: number
    examFeeExpected: number
    examFeeCollected: number
  }>
  defaulters: DefaulterExcelEntry[]
}

export function exportMonthlyReportExcel(opts: MonthlyReportOptions): void {
  const label = opts.periodLabel ?? getPeriodLabel(opts.month, opts.year)
  const wb = XLSX.utils.book_new()

  // Overview sheet
  const overviewRows = [
    { Metric: 'School', Value: opts.schoolName },
    { Metric: 'Period', Value: label },
    { Metric: 'Report Date', Value: new Date().toLocaleDateString('en-GB') },
    { Metric: 'Total Students', Value: opts.totalStudents },
    { Metric: 'Total Expected (Rs)', Value: opts.totalExpected },
    { Metric: 'Total Collected (Rs)', Value: opts.totalCollected },
    { Metric: 'Total Pending (Rs)', Value: opts.totalPending },
    {
      Metric: 'Collection Rate',
      Value:
        opts.totalExpected > 0
          ? `${Math.round((opts.totalCollected / opts.totalExpected) * 100)}%`
          : '0%',
    },
  ]
  const overviewWs = XLSX.utils.json_to_sheet(overviewRows)
  overviewWs['!cols'] = [{ wch: 22 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview')

  // Class breakdown sheet
  const classRows = opts.classSummary.map((row) => ({
    'Class': row.className,
    'Students': row.students,
    'School Fee Expected (Rs)': row.schoolFeeExpected,
    'School Fee Collected (Rs)': row.schoolFeeCollected,
    'School Fee Pending (Rs)': row.schoolFeeExpected - row.schoolFeeCollected,
    'SF Collection %':
      row.schoolFeeExpected > 0
        ? `${Math.round((row.schoolFeeCollected / row.schoolFeeExpected) * 100)}%`
        : '—',
    'Exam Fee Expected (Rs)': row.examFeeExpected || '—',
    'Exam Fee Collected (Rs)': row.examFeeCollected || '—',
    'Exam Fee Pending (Rs)':
      row.examFeeExpected > 0 ? row.examFeeExpected - row.examFeeCollected : '—',
  }))
  const classWs = XLSX.utils.json_to_sheet(classRows)
  classWs['!cols'] = [
    { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
  ]
  XLSX.utils.book_append_sheet(wb, classWs, 'Class Breakdown')

  // Defaulters sheet
  if (opts.defaulters.length > 0) {
    const defRows = opts.defaulters.map((d, i) => ({
      '#': i + 1,
      'Student Name': d.name,
      'Class': d.studentClass,
      'Fee Type': FEE_TYPE_LABELS[d.feeType],
      'Due (Rs)': d.dueAmount,
      'Paid (Rs)': d.paidAmount,
      'Remaining (Rs)': d.remaining,
      'Days Overdue': d.daysOverdue,
      'Status': d.status,
      'Parent Phone': d.parentPhone ?? '',
    }))
    const defWs = XLSX.utils.json_to_sheet(defRows)
    defWs['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 15 },
    ]
    XLSX.utils.book_append_sheet(wb, defWs, 'Defaulters')
  }

  XLSX.writeFile(wb, `MonthlyReport_${opts.schoolName.replace(/\s+/g, '_')}_${opts.month}-${opts.year}.xlsx`)
}

export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new()
  const sampleData = [
    { 'Student Name': 'Ahmed Ali', 'Class': '5A', 'Fee Amount': 5000, 'Parent Phone': '03001234567' },
    { 'Student Name': 'Sara Khan', 'Class': '5B', 'Fee Amount': 5000, 'Parent Phone': '03009876543' },
    { 'Student Name': 'Usman Malik', 'Class': '6A', 'Fee Amount': 6000, 'Parent Phone': '' },
  ]
  const ws = XLSX.utils.json_to_sheet(sampleData)
  ws['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.writeFile(wb, 'students_import_template.xlsx')
}
