import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Assessment, AssessmentType } from '../../types'
import { CLASS_LIST, ASSESSMENT_TYPE_LABELS, DEFAULT_SUBJECT_MARKS } from '../../types'
import {
  Plus, X, ClipboardList, ChevronDown, ChevronRight,
  BookOpen, Calendar, Users, Trash2,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

const TYPE_COLORS: Record<AssessmentType, string> = {
  monthly_test: 'bg-blue-50 text-blue-700',
  mid_term: 'bg-purple-50 text-purple-700',
  terminal: 'bg-emerald-50 text-emerald-700',
}

const TYPE_ACCENT: Record<AssessmentType, string> = {
  monthly_test: '#3B82F6',
  mid_term: '#8B5CF6',
  terminal: '#059669',
}

interface SubjectRow {
  name: string
  marks: string
}

function defaultSubjectRows(): SubjectRow[] {
  return Object.entries(DEFAULT_SUBJECT_MARKS).map(([name, marks]) => ({
    name,
    marks: String(marks),
  }))
}

export default function AssessmentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState<AssessmentType | 'all'>('all')

  // Form state
  const [formType, setFormType] = useState<AssessmentType>('monthly_test')
  const [formName, setFormName] = useState('')
  const [formClass, setFormClass] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>(defaultSubjectRows())

  useEffect(() => {
    loadAssessments()
  }, [])

  async function loadAssessments() {
    setLoading(true)
    try {
      let query = supabase
        .from('assessments')
        .select('*')
        .order('date', { ascending: false })

      if (profile?.role !== 'admin') {
        query = query.eq('school_id', profile!.school_id!)
      }

      const { data, error } = await query
      if (error) throw error
      setAssessments(data ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load assessments')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormType('monthly_test')
    setFormName('')
    setFormClass('')
    setFormDate(new Date().toISOString().slice(0, 10))
    setSubjectRows(defaultSubjectRows())
  }

  // ── Subject row helpers ──────────────────────────────────────────────────
  function updateSubjectName(idx: number, name: string) {
    setSubjectRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name } : r)))
  }

  function updateSubjectMarks(idx: number, marks: string) {
    setSubjectRows((prev) => prev.map((r, i) => (i === idx ? { ...r, marks } : r)))
  }

  function removeSubject(idx: number) {
    setSubjectRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function addSubject() {
    setSubjectRows((prev) => [...prev, { name: '', marks: '100' }])
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!formName.trim()) return toast.error('Assessment name is required')
    if (!formClass) return toast.error('Select a class')
    if (!formDate) return toast.error('Date is required')

    // Validate subject rows
    const validRows = subjectRows.filter((r) => r.name.trim())
    if (!validRows.length) return toast.error('Add at least one subject')

    for (const row of validRows) {
      const m = parseFloat(row.marks)
      if (!row.name.trim()) return toast.error('Subject name cannot be empty')
      if (isNaN(m) || m <= 0) return toast.error(`Invalid marks for "${row.name}"`)
    }

    // Check duplicate subject names
    const names = validRows.map((r) => r.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) {
      return toast.error('Duplicate subject names found')
    }

    // Build subject_marks object (preserving order via insertion order)
    const subject_marks: Record<string, number> = {}
    for (const row of validRows) {
      subject_marks[row.name.trim()] = parseFloat(row.marks)
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('assessments')
        .insert({
          school_id: profile!.school_id!,
          type: formType,
          name: formName.trim(),
          class: formClass,
          date: formDate,
          subject_marks,
          created_by: profile!.id,
        })
        .select()
        .single()

      if (error) throw error

      setAssessments((prev) => [data, ...prev])
      setShowForm(false)
      resetForm()
      toast.success('Assessment created')
      navigate(`/school/assessments/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create assessment')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAssessment(id: string) {
    if (!confirm('Delete this assessment and all its results? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('assessments').delete().eq('id', id)
      if (error) throw error
      setAssessments((prev) => prev.filter((a) => a.id !== id))
      toast.success('Assessment deleted')
    } catch {
      toast.error('Failed to delete assessment')
    }
  }

  const filtered =
    filterType === 'all' ? assessments : assessments.filter((a) => a.type === filterType)

  const grouped = (Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).reduce(
    (acc, type) => {
      acc[type] = filtered.filter((a) => a.type === type)
      return acc
    },
    {} as Record<AssessmentType, Assessment[]>
  )

  const canEdit = profile?.role !== 'demo'
  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage monthly tests, mid terms, and terminal exams.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> New Assessment
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...Object.keys(ASSESSMENT_TYPE_LABELS)] as (AssessmentType | 'all')[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={
                filterType === t
                  ? {
                      backgroundColor:
                        t === 'all' ? 'var(--c-accent)' : TYPE_ACCENT[t as AssessmentType],
                      color: '#fff',
                    }
                  : { backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text-3)' }
              }
            >
              {t === 'all' ? 'All' : ASSESSMENT_TYPE_LABELS[t as AssessmentType]}
              <span className="ml-1.5 opacity-70">
                (
                {t === 'all'
                  ? assessments.length
                  : assessments.filter((a) => a.type === t).length}
                )
              </span>
            </button>
          )
        )}
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner text="Loading assessments..." />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <ClipboardList size={40} className="mx-auto mb-3" style={{ color: 'var(--c-text-4)' }} />
          <p className="font-medium text-gray-500">No assessments yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {canEdit
              ? 'Create an assessment to start entering marks.'
              : 'No assessments have been created yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {(Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).map((type) => {
            const group = grouped[type]
            if (!group.length) return null
            return (
              <div key={type}>
                <h2
                  className="text-xs font-bold uppercase tracking-widest mb-2 px-1"
                  style={{ color: TYPE_ACCENT[type] }}
                >
                  {ASSESSMENT_TYPE_LABELS[type]}
                </h2>
                <div className="space-y-2">
                  {group.map((assessment) => {
                    const subjects = Object.keys(assessment.subject_marks)
                    const totalMax = Object.values(assessment.subject_marks).reduce(
                      (s, m) => s + m,
                      0
                    )
                    return (
                      <div
                        key={assessment.id}
                        className="card p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                            onClick={() => navigate(`/school/assessments/${assessment.id}`)}
                          >
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${TYPE_ACCENT[assessment.type]}20` }}
                            >
                              <BookOpen
                                size={18}
                                style={{ color: TYPE_ACCENT[assessment.type] }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 text-sm">
                                  {assessment.name}
                                </p>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[assessment.type]}`}
                                >
                                  {ASSESSMENT_TYPE_LABELS[assessment.type]}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Users size={11} /> {assessment.class}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar size={11} />{' '}
                                  {new Date(assessment.date).toLocaleDateString('en-PK', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {subjects.length} subject{subjects.length !== 1 ? 's' : ''} ·
                                  Total {totalMax} marks
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {subjects.map((subj) => (
                                  <span
                                    key={subj}
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: `${TYPE_ACCENT[assessment.type]}15`,
                                      color: TYPE_ACCENT[assessment.type],
                                    }}
                                  >
                                    {subj}: {assessment.subject_marks[subj]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => navigate(`/school/assessments/${assessment.id}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-3)' }}
                            >
                              Results <ChevronRight size={12} />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => deleteAssessment(assessment.id)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete assessment"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Assessment Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">New Assessment</h3>
              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Type */}
              <div>
                <label className={labelCls}>Assessment Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className="py-2.5 px-2 rounded-xl text-xs font-semibold border-2 transition-all text-center"
                      style={{
                        borderColor: formType === t ? TYPE_ACCENT[t] : 'var(--c-border)',
                        backgroundColor: formType === t ? `${TYPE_ACCENT[t]}15` : 'transparent',
                        color: formType === t ? TYPE_ACCENT[t] : 'var(--c-text-3)',
                      }}
                    >
                      {ASSESSMENT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className={labelCls}>Assessment Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. June Monthly Test"
                  className={inputCls}
                />
              </div>

              {/* Class + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Class *</label>
                  <div className="relative">
                    <select
                      value={formClass}
                      onChange={(e) => setFormClass(e.target.value)}
                      className={`${inputCls} appearance-none pr-8`}
                    >
                      <option value="">— Select —</option>
                      {CLASS_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Subjects + marks table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`${labelCls} mb-0`}>
                    Subjects & Marks *
                  </label>
                  <button
                    type="button"
                    onClick={addSubject}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--c-accent)', backgroundColor: 'rgba(74,144,217,0.1)' }}
                  >
                    <Plus size={12} /> Add Subject
                  </button>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_90px_32px] gap-2 mb-1.5 px-1">
                  <span className="text-xs font-semibold text-gray-400">Subject Name</span>
                  <span className="text-xs font-semibold text-gray-400 text-center">Max Marks</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {subjectRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_90px_32px] gap-2 items-center">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateSubjectName(idx, e.target.value)}
                        placeholder={`Subject ${idx + 1}`}
                        className={`${inputCls} py-2`}
                      />
                      <input
                        type="number"
                        value={row.marks}
                        onChange={(e) => updateSubjectMarks(idx, e.target.value)}
                        min={1}
                        max={1000}
                        placeholder="100"
                        className={`${inputCls} py-2 text-center`}
                      />
                      <button
                        type="button"
                        onClick={() => removeSubject(idx)}
                        disabled={subjectRows.length <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                        title="Remove subject"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total */}
                {subjectRows.some((r) => r.name.trim() && parseFloat(r.marks) > 0) && (
                  <div
                    className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{ backgroundColor: 'var(--c-surface-2)' }}
                  >
                    <span className="text-gray-500">
                      {subjectRows.filter((r) => r.name.trim()).length} subjects
                    </span>
                    <span className="font-bold text-gray-900">
                      Total:{' '}
                      {subjectRows
                        .filter((r) => r.name.trim())
                        .reduce((s, r) => s + (parseFloat(r.marks) || 0), 0)}{' '}
                      marks
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Enter Results'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
