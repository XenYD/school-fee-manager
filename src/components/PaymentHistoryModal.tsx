import { useEffect, useState } from 'react'
import { X, Clock, Banknote, Smartphone, RotateCcw, AlertCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import type { FeeRecord, PaymentTransaction } from '../types'
import { FEE_TYPE_LABELS } from '../types'

interface Props {
  feeRecord: FeeRecord
  studentName: string
  onClose: () => void
  onReset: () => void
}

export default function PaymentHistoryModal({ feeRecord, studentName, onClose, onReset }: Props) {
  const { profile } = useAuth()
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<PaymentTransaction | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const canCancel = profile?.role === 'admin' || profile?.role === 'school_owner'

  useEffect(() => {
    loadTransactions()
  }, [feeRecord.id])

  async function loadTransactions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*, profiles(full_name)')
        .eq('fee_record_id', feeRecord.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setTransactions(data ?? [])
    } catch {
      toast.error('Failed to load payment history')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelReceipt() {
    if (!cancelTarget) return
    if (!cancelReason.trim()) return toast.error('Please enter a reason for cancellation')
    setCancelling(true)
    try {
      const { error: txErr } = await supabase
        .from('payment_transactions')
        .update({
          is_cancelled: true,
          cancelled_reason: cancelReason.trim(),
          cancelled_by: profile!.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', cancelTarget.id)
      if (txErr) throw txErr

      // Recalculate fee_record paid_amount from non-cancelled transactions
      const activeTxs = transactions.filter(
        (t) => t.id !== cancelTarget.id && !t.is_cancelled
      )
      const newPaid = activeTxs.reduce((sum, t) => sum + Number(t.amount), 0)
      const newStatus =
        newPaid <= 0
          ? 'unpaid'
          : newPaid >= Number(feeRecord.due_amount)
          ? 'paid'
          : 'partial'

      const { error: frErr } = await supabase
        .from('fee_records')
        .update({ paid_amount: newPaid, status: newStatus })
        .eq('id', feeRecord.id)
      if (frErr) throw frErr

      toast.success('Receipt cancelled and fee status updated')
      setCancelTarget(null)
      setCancelReason('')
      loadTransactions()
      onReset()
    } catch {
      toast.error('Failed to cancel receipt')
    } finally {
      setCancelling(false)
    }
  }

  async function handleReset() {
    if (
      !confirm(
        `Reset ${studentName}'s ${FEE_TYPE_LABELS[feeRecord.fee_type]} to unpaid?\n\nThis will delete ALL payment records for this fee. This cannot be undone.`
      )
    )
      return
    setResetting(true)
    try {
      const { error: txErr } = await supabase
        .from('payment_transactions')
        .delete()
        .eq('fee_record_id', feeRecord.id)
      if (txErr) throw txErr

      const { error: frErr } = await supabase
        .from('fee_records')
        .update({ paid_amount: 0, status: 'unpaid' })
        .eq('id', feeRecord.id)
      if (frErr) throw frErr

      toast.success('Fee reset to unpaid')
      onReset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const remaining = Number(feeRecord.due_amount) - Number(feeRecord.paid_amount)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">Payment History</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {studentName} · {FEE_TYPE_LABELS[feeRecord.fee_type]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total Due</p>
              <p className="font-bold text-gray-900 text-sm">
                {Number(feeRecord.due_amount).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total Paid</p>
              <p className="font-bold text-green-600 text-sm">
                {Number(feeRecord.paid_amount).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
              <p className={`font-bold text-sm ${remaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {remaining.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <LoadingSpinner text="Loading history..." />
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    tx.is_cancelled ? 'bg-red-50 opacity-75' : 'bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.is_cancelled
                        ? 'bg-red-100'
                        : tx.payment_method === 'cash'
                        ? 'bg-green-100'
                        : 'bg-blue-100'
                    }`}
                  >
                    {tx.is_cancelled ? (
                      <XCircle size={15} className="text-red-500" />
                    ) : tx.payment_method === 'cash' ? (
                      <Banknote size={15} className="text-green-600" />
                    ) : (
                      <Smartphone size={15} className="text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`font-bold text-sm ${
                          tx.is_cancelled ? 'text-red-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        Rs {Number(tx.amount).toLocaleString()}
                        {i === 0 && transactions.length > 1 && !tx.is_cancelled && (
                          <span className="text-xs text-gray-400 font-normal ml-1">(latest)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {tx.is_cancelled ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                            Cancelled
                          </span>
                        ) : (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              tx.payment_method === 'cash'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {tx.payment_method === 'cash' ? 'Cash' : 'Online'}
                          </span>
                        )}
                        {canCancel && !tx.is_cancelled && (
                          <button
                            onClick={() => { setCancelTarget(tx); setCancelReason('') }}
                            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Cancel receipt"
                          >
                            <XCircle size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {tx.profiles?.full_name && (
                        <p className="text-xs text-gray-400">· by {tx.profiles.full_name}</p>
                      )}
                    </div>
                    {tx.is_cancelled && tx.cancelled_reason && (
                      <p className="text-xs text-red-400 mt-0.5">
                        Reason: {tx.cancelled_reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset footer */}
        {feeRecord.status !== 'unpaid' && (
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-start gap-2 mb-3 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>Resetting will permanently delete all payment history for this fee.</span>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              {resetting ? (
                <div className="h-4 w-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Reset to Unpaid & Delete History
            </button>
          </div>
        )}
      </div>

      {/* Cancel Receipt Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Cancel Receipt</h3>
              <button
                onClick={() => { setCancelTarget(null); setCancelReason('') }}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 text-sm p-3 rounded-xl bg-red-50 text-red-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Cancel payment of Rs {Number(cancelTarget.amount).toLocaleString()}?
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    The fee will revert to unpaid or partial status.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Reason for Cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={3}
                  className="input-field text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setCancelTarget(null); setCancelReason('') }}
                className="btn-secondary flex-1 text-sm"
              >
                Keep
              </button>
              <button
                onClick={handleCancelReceipt}
                disabled={cancelling}
                className="flex-1 text-sm py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Cancel Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
