export type UserRole = 'admin' | 'school_owner' | 'staff'

export interface School {
  id: string
  name: string
  address: string | null
  phone: string | null
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
  parent_phone: string | null
  created_at: string
  updated_at: string
  schools?: School
}

export type PaymentMethod = 'cash' | 'online'

export interface FeeRecord {
  id: string
  student_id: string
  school_id: string
  month: number
  year: number
  paid: boolean
  paid_date: string | null
  paid_by: string | null
  payment_method: PaymentMethod | null
  created_at: string
  updated_at: string
}

export interface StudentWithFee extends Student {
  fee_record?: FeeRecord | null
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
