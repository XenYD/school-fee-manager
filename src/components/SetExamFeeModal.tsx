import { useState } from 'react'
import { X, BookOpen, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { CLASS_LIST } from '../types'

interface Props {
  schoolId: string
  onClose: () => void
  onApplied: () => void
}

export default function SetExamFeeModal({ schoolId, onClose, onApplied }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [amount, setAmount] = useState('')
  const [applying, setApplying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function fetchStudentIds() {
    let q = supabase.from('students').select('id').eq('school_id', schoolId)
    if (selectedClass !== 'all') q = q.eq('class', selectedClass)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error('No students found for the selected class')
    return data.map((s) => s.id)
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    const fee = parseFloat(amount)
    if (isNaN(fee) || fee < 0) { toast.error('Enter a valid fee amount'); return }

    setApplying(true)
    try {
      const ids = await fetchStudentIds()

      const { error: stuErr } = await supabase
        .from('students').update({ exam_fee_amount: fee }).in('id', ids)
      if (stuErr) throw new Error(stuErr.message)

      // Update unpaid/partial exam fee records to new due_amount
      const { error: recErr } = await supabase
        .from('fee_records').update({ due_amount: fee })
        .in('student_id', ids).eq('fee_type', 'exam_fee').in('status', ['unpaid', 'partial'])
      if (recErr) throw new Error(recErr.message)

      const scope = selectedClass === 'all' ? 'all students' : `${selectedClass} students`
      toast.success(`Exam fee set to Rs ${fee.toLocaleString()} for ${ids.length} ${scope}`)
      onApplied()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply exam fee')
    } finally {
      setApplying(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      const ids = await fetchStudentIds()

      // Set exam_fee_amount = 0 on students
      const { error: stuErr } = await supabase
        .from('students').update({ exam_fee_amount: 0 }).in('id', ids)
      if (stuErr) throw new Error(stuErr.message)

      // Delete unpaid/partial exam fee records (paid ones are kept for history)
      const { error: recErr } = await supabase
        .from('fee_records').delete()
        .in('student_id', ids).eq('fee_type', 'exam_fee').in('status', ['unpaid', 'partial'])
      if (recErr) throw new Error(recErr.message)

      const scope = selectedClass === 'all' ? 'all students' : `${selectedClass} students`
      toast.success(`Exam fee removed for ${ids.length} ${scope}`)
      onApplied()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove exam fee')
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const scopeLabel = selectedClass === 'all' ? 'all students' : `${selectedClass} students`

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <BookOpen size={14} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Exam Fee Manager</h3>
              <p className="text-xs text-gray-500 mt-0.5">Set or remove exam fee in bulk</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Shared class selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Apply To</label>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setConfirmRemove(false) }}
              className="input-field"
            >
              <option value="all">All Classes</option>
              {CLASS_LIST.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* SET section */}
          <form onSubmit={handleApply} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Exam Fee Amount (Rs)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1500"
                className="input-field text-base font-semibold"
                min={0}
                step={1}
                autoFocus
                required
              />
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              Updates each student's exam fee and adjusts unpaid records. Already-paid records are not changed.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={applying || removing} className="btn-primary flex-1">
                {applying
                  ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying...</>
                  : 'Set Exam Fee'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* REMOVE section */}
          {!confirmRemove ? (
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={applying || removing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold text-sm transition-colors"
            >
              <Trash2 size={14} />
              Remove Exam Fee for {scopeLabel}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
                This sets exam fee to Rs 0 and deletes all unpaid exam fee records for <strong>{scopeLabel}</strong>. Paid records are kept.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="btn-secondary flex-1"
                  disabled={removing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
                >
                  {removing
                    ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Removing...</>
                    : <><Trash2 size={14} />Confirm Remove</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
