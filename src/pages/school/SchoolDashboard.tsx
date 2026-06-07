import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  GraduationCap, TrendingUp, AlertCircle, DollarSign, Users, ArrowRight,
  TrendingDown, Receipt, Phone,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import toast from 'react-hot-toast'

interface DashboardStats {
  totalStudents: number
  totalExpected: number
  totalCollected: number
  totalPending: number
  paidCount: number
  unpaidCount: number
  totalExpenses: number
}

interface MonthBar { month: string; collected: number; defaulters: number }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function SchoolDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trendData, setTrendData] = useState<MonthBar[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  useEffect(() => { if (profile?.school_id) loadData() }, [profile])

  async function loadData() {
    if (!profile?.school_id) return
    try {
      const sid = profile.school_id

      const [{ data: students, error: sErr }, { data: expenses }] = await Promise.all([
        supabase.from('students').select('id, fee_amount, name, class').eq('school_id', sid),
        supabase.from('expenses').select('amount').eq('school_id', sid),
      ])
      if (sErr) throw sErr

      const studentIds = (students ?? []).map((s) => s.id)
      const totalExpected = (students ?? []).reduce((s, st) => s + Number(st.fee_amount), 0)
      const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)

      let totalCollected = 0
      let paidIds = new Set<string>()
      let yearFeeData: { student_id: string; month: number; paid_amount: number; status: string }[] = []

      if (studentIds.length > 0) {
        const [{ data: feeData }, { data: yearData }] = await Promise.all([
          supabase.from('fee_records')
            .select('student_id, status, paid_amount')
            .eq('school_id', sid)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .eq('fee_type', 'school_fee')
            .in('student_id', studentIds),
          supabase.from('fee_records')
            .select('student_id, month, paid_amount, status')
            .eq('school_id', sid)
            .eq('year', currentYear)
            .eq('fee_type', 'school_fee'),
        ])

        totalCollected = (feeData ?? []).reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0)
        paidIds = new Set((feeData ?? []).filter((r) => r.status === 'paid').map((r) => r.student_id))
        yearFeeData = yearData ?? []
      }

      setStats({
        totalStudents: students?.length ?? 0,
        totalExpected, totalCollected,
        totalPending: totalExpected - totalCollected,
        paidCount: paidIds.size,
        unpaidCount: (students?.length ?? 0) - paidIds.size,
        totalExpenses,
      })

      // Build monthly trend for current year
      const trend: MonthBar[] = MONTH_NAMES.map((m, idx) => {
        const mn = idx + 1
        const monthRecords = yearFeeData.filter((r) => r.month === mn)
        const collected = monthRecords.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0)
        const defaulters = monthRecords.filter((r) => r.status !== 'paid').length
        return { month: m, collected, defaulters }
      })
      setTrendData(trend)
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
          Your account has not been assigned to a school yet. Please contact the admin.
        </p>
      </div>
    )
  }

  const netPL = (stats?.totalCollected ?? 0) - (stats?.totalExpenses ?? 0)
  const isProfit = netPL >= 0
  const collectionRate = stats && stats.totalExpected > 0
    ? Math.round((stats.totalCollected / stats.totalExpected) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{profile?.schools?.name} · {monthName}</p>
      </div>

      {/* Fee Stats */}
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
          <div className="mt-2 rounded-full h-2 progress-track">
            <div className="h-2 rounded-full transition-all" style={{ width: `${collectionRate}%`, backgroundColor: 'var(--c-accent)' }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</p>
            <TrendingUp size={16} className="text-green-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            Rs {(stats?.totalCollected ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected</p>
            <DollarSign size={16} className="text-gray-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            Rs {(stats?.totalExpected ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>
      </div>

      {/* P/L Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</p>
          </div>
          <p className="text-lg font-bold text-green-600">Rs {(stats?.totalCollected ?? 0).toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} style={{ color: '#E74C3C' }} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</p>
          </div>
          <p className="text-lg font-bold" style={{ color: '#E74C3C' }}>
            Rs {(stats?.totalExpenses ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt size={14} style={{ color: isProfit ? '#2ECC71' : '#E74C3C' }} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{isProfit ? 'Profit' : 'Loss'}</p>
          </div>
          <p className="text-lg font-bold" style={{ color: isProfit ? '#2ECC71' : '#E74C3C' }}>
            Rs {Math.abs(netPL).toLocaleString()}
          </p>
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
              Pending: <strong>Rs {(stats?.totalPending ?? 0).toLocaleString()}</strong>
            </p>
          </div>
          <Link to="/school/fees" className="ml-auto text-xs text-amber-700 font-medium hover:underline flex-shrink-0">View →</Link>
        </div>
      )}

      {/* Annual Trends Chart */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">{currentYear} — Monthly Collection Trend</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--c-text-3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--c-text-4)' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--c-text-1)', fontWeight: 600 }}
              formatter={(value: number, name: string) => [
                name === 'collected' ? `Rs ${value.toLocaleString()}` : value,
                name === 'collected' ? 'Collected' : 'Defaulters',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="collected" name="Collected" fill="#4A90D9" radius={[3, 3, 0, 0]} />
            <Bar dataKey="defaulters" name="Defaulters" fill="#E74C3C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/school/students', icon: <GraduationCap size={18} />, label: 'Students', sub: 'Manage enrollment', color: 'bg-indigo-100 text-indigo-600', hover: 'text-indigo-600' },
          { to: '/school/fees', icon: <DollarSign size={18} />, label: 'Fees', sub: 'Mark payments', color: 'bg-green-100 text-green-600', hover: 'text-green-600' },
          { to: '/school/expenses', icon: <Receipt size={18} />, label: 'Expenses', sub: 'Track spending', color: 'bg-red-100 text-red-500', hover: 'text-red-500' },
          { to: '/school/contacts', icon: <Phone size={18} />, label: 'Contacts', sub: 'Parent directory', color: 'bg-purple-100 text-purple-600', hover: 'text-purple-600' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="card hover:shadow-md transition-shadow flex items-center gap-3 group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0 hidden sm:block">
              <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
              <p className="text-xs text-gray-500">{item.sub}</p>
            </div>
            <p className="font-semibold text-gray-900 text-sm sm:hidden">{item.label}</p>
            <ArrowRight size={16} className={`text-gray-400 group-hover:${item.hover} transition-colors hidden sm:block`} />
          </Link>
        ))}
      </div>
    </div>
  )
}
