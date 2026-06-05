import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'
import { GraduationCap, TrendingUp, AlertCircle, DollarSign, Users, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface DashboardStats {
  totalStudents: number
  totalExpected: number
  totalCollected: number
  totalPending: number
  paidCount: number
  unpaidCount: number
}

interface RecentStudent {
  id: string
  name: string
  class: string
  fee_amount: number
  paid: boolean
}

export default function SchoolDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (profile?.school_id) loadData()
  }, [profile])

  async function loadData() {
    if (!profile?.school_id) return
    try {
      const { data: students, error: studentsErr } = await supabase
        .from('students')
        .select('id, fee_amount, name, class')
        .eq('school_id', profile.school_id)

      if (studentsErr) throw studentsErr

      const studentIds = (students ?? []).map((s) => s.id)
      const totalExpected = (students ?? []).reduce((s, st) => s + Number(st.fee_amount), 0)

      let totalCollected = 0
      let paidIds = new Set<string>()

      if (studentIds.length > 0) {
        const { data: feeData } = await supabase
          .from('fee_records')
          .select('student_id, status, paid_amount')
          .eq('school_id', profile.school_id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .in('student_id', studentIds)

        totalCollected = (feeData ?? []).reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0)
        paidIds = new Set((feeData ?? []).filter((r) => r.status === 'paid').map((r) => r.student_id))
      }

      setStats({
        totalStudents: students?.length ?? 0,
        totalExpected,
        totalCollected,
        totalPending: totalExpected - totalCollected,
        paidCount: paidIds.size,
        unpaidCount: (students?.length ?? 0) - paidIds.size,
      })

      // Show latest 5 students with fee status
      const recent = (students ?? []).slice(0, 5).map((s) => ({
        id: s.id,
        name: s.name,
        class: s.class,
        fee_amount: Number(s.fee_amount),
        paid: paidIds.has(s.id),
      }))
      setRecentStudents(recent)
    } catch (err) {
      toast.error('Failed to load dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner fullPage text="Loading dashboard..." />

  if (!profile?.school_id) {
    return (
      <div className="text-center py-16 px-4">
        <AlertCircle size={48} className="text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No School Assigned</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Your account has not been assigned to a school yet. Please contact the admin to assign you to a school.
        </p>
      </div>
    )
  }

  const collectionRate = stats && stats.totalExpected > 0
    ? Math.round((stats.totalCollected / stats.totalExpected) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.schools?.name} · {monthName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="stat-card col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Students</p>
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-indigo-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.totalStudents ?? 0}</p>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-green-600 font-medium">{stats?.paidCount ?? 0} paid</span>
            <span className="text-red-500 font-medium">{stats?.unpaidCount ?? 0} unpaid</span>
          </div>
        </div>

        <div className="stat-card col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collection Rate</p>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{collectionRate}%</p>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected</p>
            <DollarSign size={16} className="text-gray-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {(stats?.totalExpected ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</p>
            <TrendingUp size={16} className="text-green-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {(stats?.totalCollected ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>
      </div>

      {/* Pending Alert */}
      {(stats?.totalPending ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {stats?.unpaidCount} student{(stats?.unpaidCount ?? 0) !== 1 ? 's' : ''} have unpaid fees
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Pending amount: <strong>{(stats?.totalPending ?? 0).toLocaleString()}</strong>
            </p>
          </div>
          <Link to="/school/fees" className="ml-auto text-xs text-amber-700 font-medium hover:underline flex-shrink-0">
            View →
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/school/students" className="card hover:shadow-md transition-shadow flex items-center gap-3 group">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={18} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Students</p>
            <p className="text-xs text-gray-500">Manage enrollment</p>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
        </Link>

        <Link to="/school/fees" className="card hover:shadow-md transition-shadow flex items-center gap-3 group">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <DollarSign size={18} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Fee Collection</p>
            <p className="text-xs text-gray-500">Mark payments</p>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-green-600 transition-colors" />
        </Link>

        <Link to="/school/fees" state={{ download: true }} className="card hover:shadow-md transition-shadow flex items-center gap-3 group">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Reports</p>
            <p className="text-xs text-gray-500">Download PDF</p>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
        </Link>
      </div>

      {/* Recent Students */}
      {recentStudents.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Students</h2>
            <Link to="/school/students" className="text-sm text-indigo-600 hover:underline font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentStudents.map((student) => (
              <div key={student.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-600 text-xs font-semibold">
                    {student.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                  <p className="text-xs text-gray-500">Class {student.class}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{student.fee_amount.toLocaleString()}</p>
                  <span className={`text-xs font-medium ${student.paid ? 'text-green-600' : 'text-red-500'}`}>
                    {student.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
