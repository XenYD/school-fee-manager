import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Assessment, AssessmentResult, Student } from '../../types'
import { ASSESSMENT_TYPE_LABELS, getGrade, getGradeColor } from '../../types'
import {
  ArrowLeft, Save, Download, FileSpreadsheet, AlertCircle,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// Marks map: studentId -> subject -> marks
type MarksMap = Record<string, Record<string, string>>

export default function AssessmentResultsPage() {
  const { id: assessmentId } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [existingResults, setExistingResults] = useState<AssessmentResult[]>([])
  const [marks, setMarks] = useState<MarksMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [schoolName, setSchoolName] = useState('')

  useEffect(() => {
    if (assessmentId) loadAll(assessmentId)
  }, [assessmentId])

  async function loadAll(aId: string) {
    setLoading(true)
    try {
      const { data: asmtData, error: asmtErr } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', aId)
        .single()
      if (asmtErr) throw asmtErr
      const asmt = asmtData as Assessment
      setAssessment(asmt)

      // Load students in that class
      let stuQuery = supabase
        .from('students')
        .select('id, name, class, school_id, status, fee_amount, exam_fee_amount, parent_phone, date_of_birth, gender, admission_date, parent_name, parent_cnic, parent_whatsapp, address, blood_group, religion, emergency_contact_name, emergency_contact_phone, special_needs, previous_school, sibling_ids, created_at, updated_at')
        .eq('class', asmt.class)
        .eq('status', 'active')
        .order('name')

      if (profile?.role !== 'admin') {
        stuQuery = stuQuery.eq('school_id', profile!.school_id!)
      } else {
        stuQuery = stuQuery.eq('school_id', asmt.school_id)
      }

      const { data: stuData } = await stuQuery
      const studs = (stuData ?? []) as Student[]
      setStudents(studs)

      // Load existing results
      const { data: resData } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('assessment_id', aId)
      const results = (resData ?? []) as AssessmentResult[]
      setExistingResults(results)

      // Build initial marks map
      const initialMarks: MarksMap = {}
      for (const student of studs) {
        initialMarks[student.id] = {}
        for (const subject of asmt.subjects) {
          const existing = results.find(
            (r) => r.student_id === student.id && r.subject === subject
          )
          initialMarks[student.id][subject] = existing
            ? String(existing.marks_obtained)
            : ''
        }
      }
      setMarks(initialMarks)

      // Get school name
      const { data: schData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', asmt.school_id)
        .single()
      if (schData) setSchoolName(schData.name)
    } catch {
      toast.error('Failed to load assessment')
    } finally {
      setLoading(false)
    }
  }

  function setMark(studentId: string, subject: string, value: string) {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: value,
      },
    }))
  }

  async function saveResults() {
    if (!assessment) return
    setSaving(true)
    try {
      const upsertRows: Omit<AssessmentResult, 'id' | 'created_at' | 'updated_at' | 'students'>[] = []

      for (const student of students) {
        for (const subject of assessment.subjects) {
          const raw = marks[student.id]?.[subject]
          if (raw === '' || raw === undefined) continue
          const marksObtained = parseFloat(raw)
          if (isNaN(marksObtained)) continue
          if (marksObtained < 0 || marksObtained > assessment.total_marks) {
            toast.error(`Invalid marks for ${student.name} in ${subject}`)
            setSaving(false)
            return
          }
          upsertRows.push({
            assessment_id: assessment.id,
            student_id: student.id,
            school_id: assessment.school_id,
            subject,
            marks_obtained: marksObtained,
            total_marks: assessment.total_marks,
          })
        }
      }

      if (!upsertRows.length) {
        toast.error('No marks entered')
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('assessment_results')
        .upsert(upsertRows, { onConflict: 'assessment_id,student_id,subject' })
      if (error) throw error

      toast.success(`Results saved for ${upsertRows.length} entries`)
      // Reload
      const { data: resData } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('assessment_id', assessment.id)
      setExistingResults((resData ?? []) as AssessmentResult[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save results')
    } finally {
      setSaving(false)
    }
  }

  // Computed student summary
  const studentSummaries = useMemo(() => {
    if (!assessment) return []
    return students.map((student) => {
      const studentMarks = assessment.subjects.map((subject) => {
        const raw = marks[student.id]?.[subject]
        const val = raw !== '' && raw !== undefined ? parseFloat(raw) : null
        const saved = existingResults.find(
          (r) => r.student_id === student.id && r.subject === subject
        )
        return {
          subject,
          obtained: val ?? (saved ? Number(saved.marks_obtained) : null),
          total: assessment.total_marks,
        }
      })

      const entered = studentMarks.filter((m) => m.obtained !== null)
      const totalObtained = entered.reduce((sum, m) => sum + (m.obtained ?? 0), 0)
      const totalPossible = assessment.subjects.length * assessment.total_marks
      const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0
      const grade = entered.length > 0 ? getGrade(percentage) : '—'

      return {
        student,
        subjectMarks: studentMarks,
        totalObtained,
        totalPossible,
        percentage,
        grade,
        hasResults: entered.length > 0,
      }
    })
  }, [students, marks, existingResults, assessment])

  async function exportPdf() {
    if (!assessment) return
    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = 297
      const margin = 12

      // Header
      doc.setFillColor(15, 45, 82)
      doc.rect(0, 0, W, 26, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(255, 255, 255)
      doc.text(schoolName, margin, 11)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`${assessment.name} — ${assessment.class}`, margin, 18)
      doc.setFontSize(8)
      doc.setTextColor(74, 144, 217)
      doc.text(ASSESSMENT_TYPE_LABELS[assessment.type], W - margin, 11, { align: 'right' })
      doc.setTextColor(180, 200, 220)
      doc.text(
        `Date: ${new Date(assessment.date).toLocaleDateString('en-PK')}   Printed: ${new Date().toLocaleDateString('en-PK')}`,
        W - margin, 18, { align: 'right' }
      )

      const headers = [
        'Sr.',
        'Student Name',
        ...assessment.subjects,
        `Total\n(${assessment.subjects.length * assessment.total_marks})`,
        'Percentage',
        'Grade',
      ]

      const rows = studentSummaries.map((s, idx) => [
        String(idx + 1),
        s.student.name,
        ...s.subjectMarks.map((m) =>
          m.obtained !== null ? String(m.obtained) : '—'
        ),
        s.hasResults ? String(s.totalObtained) : '—',
        s.hasResults ? `${s.percentage.toFixed(1)}%` : '—',
        s.grade,
      ])

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 45, 82],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
        },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 40 },
          ...(assessment.subjects.reduce((acc, _, i) => {
            acc[i + 2] = { halign: 'center', cellWidth: 18 }
            return acc
          }, {} as Record<number, { halign: 'center'; cellWidth: number }>)),
          [2 + assessment.subjects.length]: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
          [3 + assessment.subjects.length]: { halign: 'center', cellWidth: 20 },
          [4 + assessment.subjects.length]: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
        },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          const col = data.column.index
          const gradeCol = 4 + assessment.subjects.length
          if (data.section === 'body' && col === gradeCol) {
            const grade = data.cell.raw as string
            const color = getGradeColor(grade)
            const r = parseInt(color.slice(1, 3), 16)
            const g = parseInt(color.slice(3, 5), 16)
            const b = parseInt(color.slice(5, 7), 16)
            data.cell.styles.textColor = [r, g, b]
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Grade legend
      const finalY =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(15, 45, 82)
      doc.text('GRADING SCALE:', margin, finalY)
      const grades = [
        ['A+', '90-100', '#059669'],
        ['A', '80-89', '#10B981'],
        ['B', '70-79', '#3B82F6'],
        ['C', '60-69', '#F59E0B'],
        ['D', '50-59', '#F97316'],
        ['Fail', '<50', '#EF4444'],
      ]
      let gx = margin + 28
      grades.forEach(([g, range, hex]) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const gn = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        doc.setTextColor(r, gn, b)
        doc.setFont('helvetica', 'bold')
        doc.text(`${g}: ${range}`, gx, finalY)
        gx += 26
      })

      // Footer
      doc.setFillColor(15, 45, 82)
      doc.rect(0, 195, W, 10, 'F')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(6)
      doc.setTextColor(180, 200, 220)
      doc.text('Generated by FeeFlow', W / 2, 201, { align: 'center' })

      doc.save(
        `Results_${assessment.name.replace(/ /g, '_')}_${assessment.class.replace(/ /g, '_')}.pdf`
      )
      toast.success('PDF downloaded!')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  function exportExcel() {
    if (!assessment) return
    const headers = [
      'Sr.',
      'Student Name',
      ...assessment.subjects,
      'Total Obtained',
      `Total Marks (${assessment.subjects.length * assessment.total_marks})`,
      'Percentage',
      'Grade',
    ]

    const rows = studentSummaries.map((s, idx) => [
      idx + 1,
      s.student.name,
      ...s.subjectMarks.map((m) => m.obtained ?? ''),
      s.hasResults ? s.totalObtained : '',
      s.totalPossible,
      s.hasResults ? `${s.percentage.toFixed(1)}%` : '',
      s.grade,
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    XLSX.writeFile(
      wb,
      `Results_${assessment.name.replace(/ /g, '_')}_${assessment.class.replace(/ /g, '_')}.xlsx`
    )
    toast.success('Excel downloaded!')
  }

  if (loading) return <LoadingSpinner fullPage text="Loading results..." />
  if (!assessment)
    return (
      <div className="card text-center py-12">
        <AlertCircle size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500">Assessment not found.</p>
      </div>
    )

  const canEdit = profile?.role !== 'demo'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/school/assessments')}
            className="p-2 rounded-lg mt-0.5 transition-colors"
            style={{ color: 'var(--c-text-3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--c-surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{assessment.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {ASSESSMENT_TYPE_LABELS[assessment.type]} &nbsp;·&nbsp; {assessment.class} &nbsp;·&nbsp;{' '}
              {new Date(assessment.date).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-3)' }}
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={generatingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-3)' }}
          >
            {generatingPdf ? (
              <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={13} />
            )}
            PDF
          </button>
          {canEdit && (
            <button
              onClick={saveResults}
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={15} /> Save Results
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Assessment info */}
      <div
        className="card px-4 py-3 flex items-center gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, rgba(15,45,82,0.85), rgba(20,60,110,0.8))' }}
      >
        {[
          { label: 'Class', value: assessment.class },
          { label: 'Subjects', value: `${assessment.subjects.length}` },
          { label: 'Marks per Subject', value: String(assessment.total_marks) },
          { label: 'Total Marks', value: String(assessment.subjects.length * assessment.total_marks) },
          { label: 'Students', value: String(students.length) },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</p>
            <p className="text-sm font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {students.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No active students found in {assessment.class}.</p>
        </div>
      ) : (
        <>
          {/* Marks entry table — horizontal scroll */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr style={{ backgroundColor: 'var(--c-surface-2)' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 sticky left-0 z-10 bg-inherit min-w-[160px]">
                      Student
                    </th>
                    {assessment.subjects.map((subj) => (
                      <th key={subj} className="px-3 py-3 text-xs font-semibold text-gray-500 text-center min-w-[90px]">
                        {subj}
                        <div className="text-xs font-normal text-gray-400">/ {assessment.total_marks}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center min-w-[70px]">
                      Total
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center min-w-[75px]">
                      %
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center min-w-[55px]">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studentSummaries.map((summary, idx) => (
                    <tr
                      key={summary.student.id}
                      className="border-t transition-colors hover:bg-gray-50"
                      style={{ borderColor: 'var(--c-border)' }}
                    >
                      <td
                        className="px-4 py-2.5 sticky left-0 bg-white z-10 border-r"
                        style={{ borderColor: 'var(--c-border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #4A90D9, #2C5F8A)' }}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-medium text-gray-900 text-xs truncate max-w-[110px]">
                            {summary.student.name}
                          </span>
                        </div>
                      </td>

                      {assessment.subjects.map((subj) => {
                        const val = marks[summary.student.id]?.[subj] ?? ''
                        const num = val !== '' ? parseFloat(val) : null
                        const invalid =
                          num !== null && (isNaN(num) || num < 0 || num > assessment.total_marks)
                        return (
                          <td key={subj} className="px-2 py-1.5 text-center">
                            {canEdit ? (
                              <input
                                type="number"
                                value={val}
                                min={0}
                                max={assessment.total_marks}
                                onChange={(e) =>
                                  setMark(summary.student.id, subj, e.target.value)
                                }
                                className={`w-16 text-center rounded-lg border py-1 px-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 ${
                                  invalid
                                    ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-300'
                                    : num !== null
                                    ? 'border-green-200 bg-green-50 text-green-800 focus:ring-green-300'
                                    : 'border-gray-200 bg-gray-50 text-gray-700 focus:ring-blue-300'
                                }`}
                                placeholder="—"
                              />
                            ) : (
                              <span className="text-xs font-medium text-gray-700">
                                {num !== null ? num : '—'}
                              </span>
                            )}
                          </td>
                        )
                      })}

                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-bold text-gray-900">
                          {summary.hasResults
                            ? `${summary.totalObtained}/${summary.totalPossible}`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-semibold text-gray-700">
                          {summary.hasResults ? `${summary.percentage.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={
                            summary.grade !== '—'
                              ? {
                                  color: getGradeColor(summary.grade),
                                  backgroundColor: `${getGradeColor(summary.grade)}20`,
                                }
                              : { color: 'var(--c-text-4)' }
                          }
                        >
                          {summary.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grade Legend */}
          <div className="card px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Pakistani Grading Scale</p>
            <div className="flex flex-wrap gap-3">
              {[
                { grade: 'A+', range: '90–100%', color: '#059669' },
                { grade: 'A', range: '80–89%', color: '#10B981' },
                { grade: 'B', range: '70–79%', color: '#3B82F6' },
                { grade: 'C', range: '60–69%', color: '#F59E0B' },
                { grade: 'D', range: '50–59%', color: '#F97316' },
                { grade: 'Fail', range: 'Below 50%', color: '#EF4444' },
              ].map((g) => (
                <div key={g.grade} className="flex items-center gap-1.5">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ color: g.color, backgroundColor: `${g.color}20` }}
                  >
                    {g.grade}
                  </span>
                  <span className="text-xs text-gray-500">{g.range}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
