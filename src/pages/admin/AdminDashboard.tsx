import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { School } from '../../types'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import { School as SchoolIcon, Users, GraduationCap, TrendingUp, ArrowRight, Plus, RotateCcw, X, AlertTriangle, TrendingDown, Receipt } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import toast from 'react-hot-toast'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface SchoolWithStats extends School {
  student_count: number
  paid_count: number
  total_expected: number
  total_collected: number
}

interface TrendBar { month: string; collected: number; defaulters: number }

export default function AdminDashboard() {
  const { profile } = useAuth()
  const isDemo = profile?.role === 'demo'
  const [schools, setSchools] = useState<SchoolWithStats[]>([])
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [trendData, setTrendData] = useState<TrendBar[]>([])
  const [loading, setLoading] = useState(true)
  const [showReset, setShowReset] = useState(false)
  const [resetSchoolId, setResetSchoolId] = useState('')
  const [resetStep, setResetStep] = useState<'select' | 'confirm'>('select')
  const [resetting, setResetting] = useState(false)

  async function handleReset() {
    if (!resetSchoolId) { toast.error('Select a school first'); return }
    setResetting(true)
    try {
      // Delete all payment transactions for this school
      const { error: txErr } = await supabase
        .from('payment_transactions')
        .delete()
        .eq('school_id', resetSchoolId)
      if (txErr) throw new Error(txErr.message)

      // Reset all fee records to unpaid (paid_amount = 0, status = unpaid)
      const { error: recErr } = await supabase
        .from('fee_records')
        .update({ paid_amount: 0, status: 'unpaid', paid_by: null })
        .eq('school_id', resetSchoolId)
      if (recErr) throw new Error(recErr.message)

      const school = schools.find((s) => s.id === resetSchoolId)
      toast.success(`All fees reset to unpaid for ${school?.name ?? 'school'}`)
      setShowReset(false)
      setResetSchoolId('')
      setResetStep('select')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

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

      // Expenses total
      const { data: expData } = await supabase.from('expenses').select('amount')
      setTotalExpenses((expData ?? []).reduce((s, e) => s + Number(e.amount), 0))

      // Annual trends (all schools)
      const { data: yearFees } = await supabase
        .from('fee_records')
        .select('month, paid_amount, status')
        .eq('year', currentYear)
        .eq('fee_type', 'school_fee')
      const trend: TrendBar[] = MONTH_NAMES.map((m, idx) => {
        const mn = idx + 1
        const recs = (yearFees ?? []).filter((r) => r.month === mn)
        return {
          month: m,
          collected: recs.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
          defaulters: recs.filter((r) => r.status !== 'paid').length,
        }
      })
      setTrendData(trend)
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
        {!isDemo && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowReset(true); setResetStep('select'); setResetSchoolId('') }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset Fees</span>
            </button>
            <Link to="/admin/schools" className="btn-primary text-sm">
              <Plus size={16} />
              <span className="hidden sm:inline">Add School</span>
            </Link>
          </div>
        )}
      </div>

      {/* Collected / Expenses / P&L */}
      {(() => {
        const netPL = totalCollected - totalExpenses
        const isProfit = netPL >= 0
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</span>
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp size={16} className="text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">Rs {totalCollected.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">This month · all schools</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(231,76,60,0.12)' }}>
                  <TrendingDown size={16} style={{ color: '#E74C3C' }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#E74C3C' }}>Rs {totalExpenses.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">All time · all schools</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {isProfit ? 'Net Profit' : 'Net Loss'}
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isProfit ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)' }}>
                  <Receipt size={16} style={{ color: isProfit ? '#2ECC71' : '#E74C3C' }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: isProfit ? '#2ECC71' : '#E74C3C' }}>
                Rs {Math.abs(netPL).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">{isProfit ? 'Profit' : 'Loss'} this period</p>
            </div>
          </div>
        )
      })()}

      {/* Annual Trends Chart */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">{now.getFullYear()} — Monthly Collection Trend (All Schools)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--c-text-3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--c-text-4)' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--c-text-1)', fontWeight: 600 }}
              formatter={(value, name) => [
                name === 'collected' ? `Rs ${Number(value).toLocaleString()}` : value,
                name === 'collected' ? 'Collected' : 'Defaulters',
              ] as [string | number, string]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="collected" name="Collected" fill="#4A90D9" radius={[3, 3, 0, 0]} />
            <Bar dataKey="defaulters" name="Defaulters" fill="#E74C3C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reset Fees Modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <RotateCcw size={14} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Reset School Fees</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Reset all fees to unpaid for a school</p>
                </div>
              </div>
              <button
                onClick={() => { setShowReset(false); setResetStep('select') }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {resetStep === 'select' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Select School
                    </label>
                    <select
                      value={resetSchoolId}
                      onChange={(e) => setResetSchoolId(e.target.value)}
                      className="input-field"
                      autoFocus
                    >
                      <option value="">— Choose a school —</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                    This will reset ALL fee records for every student in the selected school back to unpaid and erase all payment history.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowReset(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { if (!resetSchoolId) { toast.error('Select a school first'); return } setResetStep('confirm') }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">This cannot be undone</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        All paid and partial fee records for <strong>{schools.find((s) => s.id === resetSchoolId)?.name}</strong> will be reset to unpaid and all payment transactions will be permanently deleted.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setResetStep('select')}
                      className="btn-secondary flex-1"
                      disabled={resetting}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={resetting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
                    >
                      {resetting ? (
                        <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Resetting...</>
                      ) : (
                        <><RotateCcw size={14} />Confirm Reset</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
