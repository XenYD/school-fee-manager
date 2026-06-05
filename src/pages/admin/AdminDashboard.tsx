import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { School } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { School as SchoolIcon, Users, GraduationCap, TrendingUp, ArrowRight, Plus, RotateCcw, X, AlertTriangle } from 'lucide-react'
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
