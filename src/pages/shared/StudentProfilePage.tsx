import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Student } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  ArrowLeft, User, Phone, BookOpen, Heart, AlertCircle,
  GraduationCap, Calendar, Download, Users, MapPin,
  CreditCard, Droplets, Cross, School2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [siblings, setSiblings] = useState<Pick<Student, 'id' | 'name' | 'class'>[]>([])
  const [schoolName, setSchoolName] = useState('')
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'demo'
  const backPath = isAdmin ? '/admin/students' : '/school/students'

  useEffect(() => {
    if (id) loadStudent(id)
  }, [id])

  async function loadStudent(studentId: string) {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, schools(name)')
        .eq('id', studentId)
        .single()
      if (error) throw error
      setStudent(data as Student)
      setSchoolName((data as Student & { schools?: { name: string } }).schools?.name ?? '')

      // Load siblings
      if (data.sibling_ids?.length) {
        const { data: sibData } = await supabase
          .from('students')
          .select('id, name, class')
          .in('id', data.sibling_ids)
        setSiblings(sibData ?? [])
      }
    } catch {
      toast.error('Failed to load student profile')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch { return dateStr }
  }

  function calcAge(dob: string | null) {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  }

  async function downloadPDF() {
    if (!student) return
    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, margin = 15

      // ── Header ────────────────────────────────────────────────────────────
      doc.setFillColor(15, 45, 82)
      doc.rect(0, 0, W, 36, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(255, 255, 255)
      doc.text(schoolName || 'School', margin, 14)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('STUDENT ADMISSION RECORD', margin, 22)
      doc.setFontSize(8)
      doc.setTextColor(74, 144, 217)
      doc.text('Powered by FeeFlow', margin, 31)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text(`Printed: ${new Date().toLocaleDateString('en-PK')}`, W - margin, 31, { align: 'right' })

      let y = 44

      // ── Student Info ──────────────────────────────────────────────────────
      doc.setFillColor(248, 249, 250)
      doc.roundedRect(margin, y, W - margin * 2, 38, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(20, 20, 20)
      doc.text(student.name, margin + 4, y + 9)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      const col1 = margin + 4, col2 = W / 2 + 4
      doc.text(`Class: ${student.class}`, col1, y + 17)
      doc.text(`Admission No.: ${student.id.slice(0, 8).toUpperCase()}`, col2, y + 17)
      doc.text(`Admission Date: ${formatDate(student.admission_date)}`, col1, y + 24)
      doc.text(`Gender: ${student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : 'Not specified'}`, col2, y + 24)
      if (student.date_of_birth) {
        const age = calcAge(student.date_of_birth)
        doc.text(`Date of Birth: ${formatDate(student.date_of_birth)}${age ? ` (Age ${age})` : ''}`, col1, y + 31)
      }
      y += 44

      // ── Fees ─────────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 45, 82)
      doc.text('FEE INFORMATION', margin, y)
      y += 5
      doc.setDrawColor(15, 45, 82)
      doc.setLineWidth(0.5)
      doc.line(margin, y, W - margin, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      doc.text(`Monthly School Fee:  Rs ${Number(student.fee_amount).toLocaleString()}`, col1, y)
      doc.text(`Exam Fee:  Rs ${Number(student.exam_fee_amount) > 0 ? Number(student.exam_fee_amount).toLocaleString() : '0'}`, col2, y)
      y += 10

      // ── Parent / Guardian ─────────────────────────────────────────────────
      if (student.parent_name || student.parent_phone) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 45, 82)
        doc.text('PARENT / GUARDIAN INFORMATION', margin, y)
        y += 5
        doc.line(margin, y, W - margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(50, 50, 50)
        if (student.parent_name) { doc.text(`Name: ${student.parent_name}`, col1, y); y += 6 }
        if (student.parent_cnic) { doc.text(`CNIC: ${student.parent_cnic}`, col1, y) }
        if (student.parent_phone) { doc.text(`Phone: ${student.parent_phone}`, col2, y) }
        y += 6
        if (student.parent_whatsapp) { doc.text(`WhatsApp: ${student.parent_whatsapp}`, col1, y); y += 6 }
        if (student.address) {
          const addressLines = doc.splitTextToSize(`Address: ${student.address}`, W - margin * 2 - 8)
          doc.text(addressLines, col1, y)
          y += addressLines.length * 5
        }
        y += 4
      }

      // ── Other Details ─────────────────────────────────────────────────────
      const hasOptional = student.blood_group || student.religion || student.emergency_contact_name ||
        student.special_needs || student.previous_school
      if (hasOptional) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 45, 82)
        doc.text('ADDITIONAL DETAILS', margin, y)
        y += 5
        doc.line(margin, y, W - margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(50, 50, 50)
        let detailCol = 1
        const addDetail = (label: string, value: string | null) => {
          if (!value) return
          const x = detailCol === 1 ? col1 : col2
          doc.text(`${label}: ${value}`, x, y)
          detailCol = detailCol === 1 ? 2 : 1
          if (detailCol === 1) y += 6
        }
        addDetail('Blood Group', student.blood_group)
        addDetail('Religion', student.religion)
        addDetail('Emergency Contact', student.emergency_contact_name)
        addDetail('Emergency Phone', student.emergency_contact_phone)
        if (detailCol === 2) y += 6
        if (student.previous_school) { doc.text(`Previous School: ${student.previous_school}`, col1, y); y += 6 }
        if (student.special_needs) {
          doc.text('Special Needs / Notes:', col1, y); y += 5
          const lines = doc.splitTextToSize(student.special_needs, W - margin * 2 - 8)
          doc.text(lines, col1, y)
          y += lines.length * 5
        }
        y += 4
      }

      // ── Siblings ─────────────────────────────────────────────────────────
      if (siblings.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(15, 45, 82)
        doc.text('SIBLINGS', margin, y)
        y += 5
        doc.line(margin, y, W - margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(50, 50, 50)
        siblings.forEach((s, i) => {
          const x = i % 2 === 0 ? col1 : col2
          doc.text(`${s.name} (${s.class})`, x, y)
          if (i % 2 === 1) y += 6
        })
        if (siblings.length % 2 === 1) y += 6
        y += 4
      }

      // ── Footer ────────────────────────────────────────────────────────────
      doc.setFillColor(15, 45, 82)
      doc.rect(0, 280, W, 17, 'F')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(180, 200, 220)
      doc.text('This is a computer-generated admission record by FeeFlow. No signature required.', W / 2, 290, { align: 'center' })

      doc.save(`Admission_${student.name.replace(/ /g, '_')}.pdf`)
      toast.success('Admission record downloaded!')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (loading) return <LoadingSpinner fullPage text="Loading profile..." />
  if (!student) return (
    <div className="card text-center py-12">
      <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">Student not found</p>
    </div>
  )

  const age = calcAge(student.date_of_birth)

  function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null
    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--c-text-4)', minWidth: 140 }}>{label}</span>
        <span className="text-sm font-medium text-gray-900">{value}</span>
      </div>
    )
  }

  function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
      <div className="card space-y-3">
        <div className="flex items-center gap-2 pb-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
          <span style={{ color: 'var(--c-accent)' }}>{icon}</span>
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        </div>
        <div className="space-y-2.5">{children}</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)}
            className="p-2 rounded-lg transition-colors" style={{ color: 'var(--c-text-3)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admission Record</h1>
            <p className="text-xs text-gray-500 mt-0.5">Full admission details for this student</p>
          </div>
        </div>
        <button onClick={downloadPDF} disabled={generatingPdf}
          className="btn-primary text-sm flex items-center gap-2">
          {generatingPdf
            ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
            : <><Download size={15} /> Download PDF</>}
        </button>
      </div>

      {/* Student hero card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(15,45,82,0.9), rgba(20,60,110,0.85))' }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #4A90D9, #2C5F8A)' }}>
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{student.name}</h2>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: 'rgba(74,144,217,0.4)' }}>
                {student.class}
              </span>
              {student.gender && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                  {student.gender}
                </span>
              )}
              {age && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Age {age}
                </span>
              )}
            </div>
            {schoolName && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <School2 size={11} /> {schoolName}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0 hidden sm:block">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Monthly Fee</p>
            <p className="text-lg font-bold text-white">Rs {Number(student.fee_amount).toLocaleString()}</p>
            {Number(student.exam_fee_amount) > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Exam: Rs {Number(student.exam_fee_amount).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Student info */}
      <SectionCard icon={<User size={15} />} title="Student Information">
        <InfoRow label="Full Name" value={student.name} />
        <InfoRow label="Date of Birth" value={student.date_of_birth ? `${formatDate(student.date_of_birth)}${age ? ` (Age ${age})` : ''}` : null} />
        <InfoRow label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null} />
        <InfoRow label="Class" value={student.class} />
        <InfoRow label="Admission Date" value={formatDate(student.admission_date)} />
        <InfoRow label="Monthly Fee" value={`Rs ${Number(student.fee_amount).toLocaleString()}`} />
        {Number(student.exam_fee_amount) > 0 && (
          <InfoRow label="Exam Fee" value={`Rs ${Number(student.exam_fee_amount).toLocaleString()}`} />
        )}
      </SectionCard>

      {/* Parent info */}
      {(student.parent_name || student.parent_phone || student.parent_cnic) && (
        <SectionCard icon={<Phone size={15} />} title="Parent / Guardian Information">
          <InfoRow label="Parent / Guardian Name" value={student.parent_name} />
          <InfoRow label="CNIC" value={student.parent_cnic} />
          <InfoRow label="Phone Number" value={student.parent_phone} />
          <InfoRow label="WhatsApp" value={student.parent_whatsapp} />
          <InfoRow label="Home Address" value={student.address} />
        </SectionCard>
      )}

      {/* Optional details */}
      {(student.blood_group || student.religion || student.emergency_contact_name || student.special_needs || student.previous_school) && (
        <SectionCard icon={<BookOpen size={15} />} title="Additional Details">
          {student.blood_group && (
            <div className="flex items-center gap-2">
              <Droplets size={14} style={{ color: '#E74C3C' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--c-text-4)' }}>Blood Group</span>
              <span className="text-sm font-bold" style={{ color: '#E74C3C' }}>{student.blood_group}</span>
            </div>
          )}
          <InfoRow label="Religion" value={student.religion} />
          <InfoRow label="Emergency Contact" value={student.emergency_contact_name} />
          <InfoRow label="Emergency Phone" value={student.emergency_contact_phone} />
          <InfoRow label="Previous School" value={student.previous_school} />
          {student.special_needs && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c-text-4)' }}>Special Needs / Notes</p>
              <p className="text-sm text-gray-900 p-2 rounded-lg text-wrap" style={{ backgroundColor: 'var(--c-surface-2)' }}>
                {student.special_needs}
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {/* Siblings */}
      {siblings.length > 0 && (
        <SectionCard icon={<Users size={15} />} title="Siblings">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {siblings.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg"
                style={{ backgroundColor: 'var(--c-surface-2)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: 'var(--c-accent)' }}>
                  {s.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--c-text-4)' }}>{s.class}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Meta */}
      <div className="text-xs text-center pb-2" style={{ color: 'var(--c-text-4)' }}>
        Admission ID: {student.id.slice(0, 8).toUpperCase()} &nbsp;•&nbsp;
        Enrolled: {formatDate(student.created_at?.slice(0, 10))}
      </div>
    </div>
  )
}
