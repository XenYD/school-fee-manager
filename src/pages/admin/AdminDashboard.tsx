import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { School } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { School as SchoolIcon, Users, GraduationCap, TrendingUp, ArrowRight, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface SchoolWithStats extends School {
  student_count: number
  paid_count: number
  total_expected: number
  total_collected: number
}

export default function AdminDashboard() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: schoolsData, error: schoolsErr } = await supabase
        .from('schools')
        .select('*')
        .order('name')

      if (schoolsErr) throw schoolsErr

      const enriched: SchoolWithStats[] = await Promise.all(
        (schoolsData ?? []).map(async (school) => {
          const { data: students } = await supabase
            .from('students')
            .select('id, fee_amount')
            .eq('school_id', school.id)

          const studentIds = (students ?? []).map((s) => s.id)
          const totalExpected = (students ?? []).reduce((s, st) => s + Number(st.fee_amount), 0)

          let paidCount = 0
          let totalCollected = 0

          if (studentIds.length > 0) {
            const { data: feeRecords } = await supabase
              .from('fee_records')
              .select('student_id, status, paid_amount')
              .eq('school_id', school.id)
              .eq('month', currentMonth)
              .eq('year', currentYear)

            const paidRecords = (feeRecords ?? []).filter((r) => r.status === 'paid')
            paidCount = paidRecords.length
            totalCollected = (feeRecords ?? []).reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0)
          }

          return {
            ...school,
            student_count: students?.length ?? 0,
            paid_count: paidCount,
            total_expected: totalExpected,
            total_collected: totalCollected,
          }
        })
      )

      setSchools(enriched)
    } catch (err) {
      toast.error('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalStudents = schools.reduce((s, sc) => s + sc.student_count, 0)
  const totalExpected = schools.reduce((s, sc) => s + sc.total_expected, 0)
  const totalCollected = schools.reduce((s, sc) => s + sc.total_collected, 0)
  const totalPending = totalExpected - totalCollected

  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  if (loading) return <LoadingSpinner fullPage text="Loading dashboard..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{monthName} overview</p>
        </div>
        <Link to="/admin/schools" className="btn-primary text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Add School</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schools</span>
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <SchoolIcon size={16} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{schools.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total schools</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Students</span>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <GraduationCap size={16} className="text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
          <p className="text-xs text-gray-500 mt-0.5">All schools</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</span>
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {totalCollected.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">This month</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</span>
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {totalPending.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">This month</p>
        </div>
      </div>

      {/* Schools List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Schools Overview</h2>
          <Link to="/admin/schools" className="text-sm text-indigo-600 hover:underline font-medium">
            Manage
          </Link>
        </div>

        {schools.length === 0 ? (
          <div className="text-center py-10">
            <SchoolIcon size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No schools yet</p>
            <p className="text-sm text-gray-400 mt-1">Add your first school to get started</p>
            <Link to="/admin/schools" className="btn-primary mt-4 text-sm">
              <Plus size={16} /> Add School
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {schools.map((school) => {
              const pct = school.total_expected > 0
                ? Math.round((school.total_collected / school.total_expected) * 100)
                : 0
              return (
                <Link
                  key={school.id}
                  to={`/admin/schools/${school.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <SchoolIcon size={18} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{school.name}</p>
                      <ArrowRight size={14} className="text-gray-400 group-hover:text-indigo-600 flex-shrink-0 ml-2 transition-colors" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{school.student_count} students</span>
                      <span>•</span>
                      <span className="text-green-600 font-medium">{school.paid_count} paid</span>
                      <span>•</span>
                      <span className="text-red-500 font-medium">
                        {school.student_count - school.paid_count} pending
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{pct}%</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
