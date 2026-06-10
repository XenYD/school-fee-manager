import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Student, School } from '../../types'
import { CLASS_LIST } from '../../types'
import { TrendingUp, TrendingDown, GraduationCap, Users, ChevronDown, ArrowRight } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

function getNextClass(cls: string): string | null {
  const idx = CLASS_LIST.indexOf(cls)
  if (idx === -1) return null
  if (idx === CLASS_LIST.length - 1) return 'Graduated'
  return CLASS_LIST[idx + 1]
}

function getPrevClass(cls: string): string | null {
  const idx = CLASS_LIST.indexOf(cls)
  if (idx <= 0) return null
  return CLASS_LIST[idx - 1]
}

export default function PromoteStudentsPage() {
  const { profile } = useAuth()
  const [school, setSchool] = useState<School | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [demoting, setDemoting] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const canManage = profile?.role === 'admin' || profile?.role === 'school_owner'

  useEffect(() => {
    if (profile?.school_id) loadSchool()
  }, [profile])

  async function loadSchool() {
    const { data } = await supabase
      .from('schools')
      .select('*')
      .eq('id', profile!.school_id!)
      .single()
    if (data) setSchool(data as School)
  }

  useEffect(() => {
    if (selectedClass) loadStudents()
    else setStudents([])
  }, [selectedClass])

  async function loadStudents() {
    setLoading(true)
    try {
      let query = supabase
        .from('students')
        .select('*')
        .eq('class', selectedClass)
        .eq('status', 'active')
        .order('name')

      if (profile?.role !== 'admin') {
        query = query.eq('school_id', profile!.school_id!)
      }

      const { data, error } = await query
      if (error) throw error
      setStudents(data ?? [])
    } catch {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  async function promoteStudent(student: Student) {
    const nextClass = getNextClass(student.class)
    if (!nextClass) return
    setPromoting(student.id)
    try {
      const isGraduating = nextClass === 'Graduated'
      const newFee =
        !isGraduating && school?.class_fees?.[nextClass]
          ? Number(school.class_fees[nextClass])
          : Number(student.fee_amount)

      const payload = isGraduating
        ? { status: 'graduated' }
        : { class: nextClass, fee_amount: newFee }

      const { error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', student.id)
      if (error) throw error

      toast.success(
        isGraduating
          ? `${student.name} has graduated!`
          : `${student.name} promoted to ${nextClass}`
      )
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
    } catch {
      toast.error('Failed to promote student')
    } finally {
      setPromoting(null)
    }
  }

  async function demoteStudent(student: Student) {
    const prevClass = getPrevClass(student.class)
    if (!prevClass) return toast.error('Cannot demote below Class 1')
    if (
      !confirm(
        `Demote ${student.name} from ${student.class} to ${prevClass}?\n\nFee will update to the ${prevClass} class fee.`
      )
    )
      return
    setDemoting(student.id)
    try {
      const newFee =
        school?.class_fees?.[prevClass]
          ? Number(school.class_fees[prevClass])
          : Number(student.fee_amount)

      const { error } = await supabase
        .from('students')
        .update({ class: prevClass, fee_amount: newFee })
        .eq('id', student.id)
      if (error) throw error

      toast.success(`${student.name} demoted to ${prevClass}`)
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
    } catch {
      toast.error('Failed to demote student')
    } finally {
      setDemoting(null)
    }
  }

  async function bulkPromote() {
    if (!students.length) return
    const nextClass = getNextClass(selectedClass)
    if (!nextClass) return
    const isGraduating = nextClass === 'Graduated'
    const action = isGraduating
      ? `graduate all ${students.length} students in ${selectedClass}`
      : `promote all ${students.length} students to ${nextClass}`

    if (!confirm(`Are you sure you want to ${action}? This cannot be undone.`)) return

    setBulkBusy(true)
    try {
      for (const student of students) {
        const newFee =
          !isGraduating && school?.class_fees?.[nextClass]
            ? Number(school.class_fees[nextClass])
            : Number(student.fee_amount)
        const payload = isGraduating
          ? { status: 'graduated' }
          : { class: nextClass, fee_amount: newFee }
        await supabase.from('students').update(payload).eq('id', student.id)
      }
      toast.success(
        isGraduating
          ? `${students.length} students graduated!`
          : `${students.length} students promoted to ${nextClass}!`
      )
      setStudents([])
    } catch {
      toast.error('Bulk promotion failed. Some students may not have been updated.')
    } finally {
      setBulkBusy(false)
    }
  }

  if (!canManage) {
    return (
      <div className="card text-center py-16">
        <GraduationCap size={40} className="mx-auto mb-3" style={{ color: 'var(--c-text-4)' }} />
        <p className="font-medium text-gray-500">
          Only Admin and Principal can promote or demote students.
        </p>
      </div>
    )
  }

  const nextClass = selectedClass ? getNextClass(selectedClass) : null
  const isGraduationClass = selectedClass === 'Class 10'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Promote Students</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a class, then promote or demote students individually or promote the entire class at once.
        </p>
      </div>

      {/* Class selector */}
      <div className="card">
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--c-text-4)' }}>
          Select Class
        </label>
        <div className="relative">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-field appearance-none pr-8"
          >
            <option value="">— Choose a class —</option>
            {CLASS_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--c-text-4)' }}
          />
        </div>

        {selectedClass && nextClass && (
          <div
            className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text-3)' }}
          >
            <span className="font-semibold">{selectedClass}</span>
            <ArrowRight size={12} />
            <span
              className="font-semibold"
              style={{ color: isGraduationClass ? '#059669' : 'var(--c-accent)' }}
            >
              {nextClass}
            </span>
            {isGraduationClass && (
              <span className="ml-1 text-emerald-600">(students will be marked as Graduated)</span>
            )}
          </div>
        )}
      </div>

      {selectedClass && (
        <>
          {/* Stats + Bulk action */}
          {!loading && (
            <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #4A90D9, #2C5F8A)' }}
                >
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active students in {selectedClass}</p>
                  <p className="text-xl font-bold text-gray-900">{students.length}</p>
                </div>
              </div>

              {nextClass && students.length > 0 && (
                <button
                  onClick={bulkPromote}
                  disabled={bulkBusy}
                  className={`btn-primary flex items-center gap-2 text-sm ${
                    isGraduationClass ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                  }`}
                >
                  {bulkBusy ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : isGraduationClass ? (
                    <>
                      <GraduationCap size={15} /> Graduate All ({students.length})
                    </>
                  ) : (
                    <>
                      <TrendingUp size={15} /> Promote All to {nextClass}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Students list */}
          {loading ? (
            <LoadingSpinner text="Loading students..." />
          ) : students.length === 0 ? (
            <div className="card text-center py-14">
              <GraduationCap
                size={40}
                className="mx-auto mb-3"
                style={{ color: 'var(--c-text-4)' }}
              />
              <p className="font-medium text-gray-500">No active students in {selectedClass}</p>
              <p className="text-xs text-gray-400 mt-1">
                All students may have already been promoted or graduated.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const prev = getPrevClass(student.class)
                const next = getNextClass(student.class)
                const graduating = next === 'Graduated'
                const isStudentBusy =
                  promoting === student.id ||
                  demoting === student.id ||
                  bulkBusy

                return (
                  <div
                    key={student.id}
                    className="card flex items-center gap-3 py-3 px-4"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #4A90D9, #2C5F8A)' }}
                    >
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {student.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Fee: Rs {Number(student.fee_amount).toLocaleString()}
                        {student.parent_phone && ` · ${student.parent_phone}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {prev && (
                        <button
                          onClick={() => demoteStudent(student)}
                          disabled={isStudentBusy}
                          title={`Demote to ${prev}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                          style={{
                            borderColor: 'var(--c-border)',
                            color: 'var(--c-text-3)',
                          }}
                        >
                          {demoting === student.id ? (
                            <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TrendingDown size={12} />
                          )}
                          <span className="hidden sm:inline">{prev}</span>
                        </button>
                      )}
                      {next && (
                        <button
                          onClick={() => promoteStudent(student)}
                          disabled={isStudentBusy}
                          title={graduating ? 'Graduate' : `Promote to ${next}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40"
                          style={{
                            backgroundColor: graduating ? '#059669' : 'var(--c-accent)',
                          }}
                        >
                          {promoting === student.id ? (
                            <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                          ) : graduating ? (
                            <GraduationCap size={12} />
                          ) : (
                            <TrendingUp size={12} />
                          )}
                          <span className="hidden sm:inline">
                            {graduating ? 'Graduate' : next}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
