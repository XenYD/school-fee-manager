export type UserRole = 'admin' | 'school_owner' | 'staff'
export type PaymentMethod = 'cash' | 'online'
export type FeeResetType = 'monthly' | 'term'
export type FeeType = 'school_fee' | 'exam_fee'
export type FeeStatus = 'unpaid' | 'partial' | 'paid'

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  school_fee: 'School Fee',
  exam_fee: 'Exam Fee',
}

export const CLASS_LIST = [
  'Class 1','Class 2','Class 3','Class 4','Class 5',
  'Class 6','Class 7','Class 8','Class 9','Class 10',
]

export interface School {
  id: string
  name: string
  address: string | null
  phone: string | null
  fee_reset_type: FeeResetType
  class_fees: Record<string, number>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  full_name: string
  role: UserRole
  school_id: string | null
  created_at: string
  updated_at: string
  schools?: School
}

export interface Student {
  id: string
  school_id: string
  name: string
  class: string
  fee_amount: number
  exam_fee_amount: number
  parent_phone: string | null
  created_at: string
  updated_at: string
  schools?: School
}

export interface FeeRecord {
  id: string
  student_id: string
  school_id: string
  month: number
  year: number
  fee_type: FeeType
  due_amount: number
  paid_amount: number
  status: FeeStatus
  due_date: string | null
  paid_by: string | null
  created_at: string
  updated_at: string
}

export interface PaymentTransaction {
  id: string
  fee_record_id: string
  student_id: string
  school_id: string
  amount: number
  payment_method: PaymentMethod
  paid_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string }
}

export interface StudentWithFee extends Student {
  school_fee_record: FeeRecord | null
  exam_fee_record: FeeRecord | null
}

export interface SchoolStats {
  total_students: number
  total_expected: number
  total_collected: number
  total_pending: number
}

export interface ImportRow {
  name: string
  class: string
  fee_amount: number
  parent_phone: string
}

/** Helpers */

export function getPeriodDueDate(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function getDaysOverdue(record: FeeRecord | null | undefined, periodMonth: number, periodYear: number): number {
  if (record?.status === 'paid') return 0
  const dueDateStr = record?.due_date ?? getPeriodDueDate(periodMonth, periodYear)
  const due = new Date(dueDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
}

export function getPeriodLabel(month: number, year: number, resetType: FeeResetType = 'monthly'): string {
  if (resetType === 'term') {
    const names: Record<number, string> = {
      1: 'Q1 (Jan – Mar)', 4: 'Q2 (Apr – Jun)',
      7: 'Q3 (Jul – Sep)', 10: 'Q4 (Oct – Dec)',
    }
    return `${names[month] ?? '?'} ${year}`
  }
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

export function getInitialPeriodMonth(resetType: FeeResetType = 'monthly'): number {
  const m = new Date().getMonth() + 1
  if (resetType === 'monthly') return m
  if (m <= 3) return 1
  if (m <= 6) return 4
  if (m <= 9) return 7
  return 10
}
