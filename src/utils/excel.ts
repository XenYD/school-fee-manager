import * as XLSX from 'xlsx'
import { ImportRow } from '../types'

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
