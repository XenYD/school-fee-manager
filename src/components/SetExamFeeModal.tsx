import { useState } from 'react'
import { X, BookOpen } from 'lucide-react'
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

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    const fee = parseFloat(amount)
    if (isNaN(fee) || fee < 0) {
      toast.error('Enter a valid fee amount')
      return
    }

    setApplying(true)
    try {
      // 1. Fetch matching student IDs
      let studentQuery = supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)

      if (selectedClass !== 'all') {
        studentQuery = studentQuery.eq('class', selectedClass)
      }

      const { data: students, error: fetchErr } = await studentQuery
      if (fetchErr) throw fetchErr
      if (!students || students.length === 0) {
        toast.error('No students found for the selected class')
        setApplying(false)
        return
      }

      const ids = students.map((s) => s.id)

      // 2. Update students.exam_fee_amount
      const { error: stuErr } = await supabase
        .from('students')
        .update({ exam_fee_amount: fee })
        .in('id', ids)
      if (stuErr) throw stuErr

      // 3. Update existing unpaid/partial exam fee records to new due_amount
      const { error: recErr } = await supabase
        .from('fee_records')
        .update({ due_amount: fee })
        .in('student_id', ids)
        .eq('fee_type', 'exam_fee')
        .in('status', ['unpaid', 'partial'])
      if (recErr) throw recErr

      const scope = selectedClass === 'all' ? 'all students' : `${selectedClass} students`
      toast.success(`Exam fee set to Rs ${fee.toLocaleString()} for ${ids.length} ${scope}`)
      onApplied()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply exam fee')
    } finally {
      setApplying(false)
    }
  }

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
              <h3 className="font-semibold text-gray-900 text-sm">Set Exam Fee</h3>
              <p className="text-xs text-gray-500 mt-0.5">Assign exam fee to students in bulk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 space-y-4">
          {/* Class selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Apply To
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input-field"
            >
              <option value="all">All Classes</option>
              {CLASS_LIST.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Amount input */}
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
            This updates each student's exam fee amount and adjusts any existing unpaid exam fee records. Already-paid records are not changed.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={applying} className="btn-primary flex-1">
              {applying ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
