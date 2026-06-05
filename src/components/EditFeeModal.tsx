import { useState } from 'react'
import { X, PenLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import type { Student } from '../types'

interface Props {
  student: Student
  onClose: () => void
  onSaved: () => void
}

export default function EditFeeModal({ student, onClose, onSaved }: Props) {
  const [schoolFee, setSchoolFee] = useState(String(Number(student.fee_amount) || 0))
  const [examFee, setExamFee] = useState(String(Number(student.exam_fee_amount) || 0))
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const newSchoolFee = parseFloat(schoolFee) || 0
    const newExamFee = parseFloat(examFee) || 0
    if (newSchoolFee < 0 || newExamFee < 0) {
      toast.error('Fee amounts cannot be negative')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('students')
        .update({ fee_amount: newSchoolFee, exam_fee_amount: newExamFee })
        .eq('id', student.id)
      if (error) throw error
      toast.success(`Fees updated for ${student.name}`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fees')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <PenLine size={14} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Edit Fee Amounts</h3>
              <p className="text-xs text-gray-500 mt-0.5">{student.name} · {student.class}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              School Fee (Rs)
              <span className="text-xs font-normal text-gray-400 ml-1">— monthly / per term</span>
            </label>
            <input
              type="number"
              value={schoolFee}
              onChange={(e) => setSchoolFee(e.target.value)}
              className="input-field text-base font-semibold"
              min={0}
              step={1}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Exam Fee (Rs)
              <span className="text-xs font-normal text-gray-400 ml-1">— one-time per term/year</span>
            </label>
            <input
              type="number"
              value={examFee}
              onChange={(e) => setExamFee(e.target.value)}
              className="input-field text-base font-semibold"
              min={0}
              step={1}
            />
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Changes apply to future fee records only. Existing paid records are not affected.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
