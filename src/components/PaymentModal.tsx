import { useState } from 'react'
import { Banknote, Smartphone, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { PaymentMethod, FeeType } from '../types'
import { FEE_TYPE_LABELS } from '../types'

interface Props {
  studentName?: string
  feeType?: FeeType
  dueAmount?: number
  paidSoFar?: number
  isBulk?: boolean
  bulkCount?: number
  onConfirm: (amount: number, method: PaymentMethod) => void
  onCancel: () => void
}

export default function PaymentModal({
  studentName,
  feeType,
  dueAmount = 0,
  paidSoFar = 0,
  isBulk = false,
  bulkCount = 0,
  onConfirm,
  onCancel,
}: Props) {
  const remaining = dueAmount - paidSoFar
  const [amount, setAmount] = useState<string>(isBulk ? '' : String(remaining))
  const [method, setMethod] = useState<PaymentMethod | null>(null)

  const numAmount = parseFloat(amount) || 0
  const isPartial = !isBulk && numAmount > 0 && numAmount < remaining
  const isValid = method !== null && (isBulk ? true : numAmount > 0 && numAmount <= remaining)

  function handleConfirm() {
    if (!isValid || !method) return
    onConfirm(isBulk ? 0 : numAmount, method)
  }

  const feeLabel = feeType ? FEE_TYPE_LABELS[feeType] : ''

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">
              {isBulk ? 'Bulk Payment' : 'Record Payment'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isBulk
                ? `${bulkCount} student${bulkCount !== 1 ? 's' : ''} — full remaining each`
                : feeLabel}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Context summary (single mode only) */}
          {!isBulk && (
            <div className="bg-gray-50 rounded-xl p-3.5">
              <p className="font-semibold text-gray-900 text-sm mb-2.5">{studentName}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Total Due</p>
                  <p className="font-bold text-gray-900 text-sm">{dueAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Paid So Far</p>
                  <p className="font-bold text-green-600 text-sm">{paidSoFar.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
                  <p className="font-bold text-red-500 text-sm">{remaining.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Amount input (single mode only) */}
          {!isBulk && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Amount to Pay
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field text-lg font-bold"
                placeholder={`Max: ${remaining.toLocaleString()}`}
                min={1}
                max={remaining}
                step={1}
                autoFocus
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setAmount(String(remaining))}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Pay full ({remaining.toLocaleString()})
                </button>
                {remaining >= 2 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.floor(remaining / 2)))}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Half ({Math.floor(remaining / 2).toLocaleString()})
                  </button>
                )}
              </div>
              {isPartial && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                  <AlertCircle size={11} />
                  Partial payment · {(remaining - numAmount).toLocaleString()} will remain
                </div>
              )}
              {numAmount > remaining && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                  <AlertCircle size={11} />
                  Amount exceeds remaining balance
                </div>
              )}
            </div>
          )}

          {/* Payment method */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Payment Method *
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { m: 'cash' as PaymentMethod, label: 'Cash', Icon: Banknote, color: 'green' },
                  { m: 'online' as PaymentMethod, label: 'Online', Icon: Smartphone, color: 'blue' },
                ] as const
              ).map(({ m, label, Icon, color }) => {
                const sel = method === m
                const selColor =
                  color === 'green'
                    ? 'border-green-500 bg-green-50'
                    : 'border-blue-500 bg-blue-50'
                const iconColor =
                  color === 'green'
                    ? sel ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                    : sel ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                const textColor =
                  color === 'green'
                    ? sel ? 'text-green-700' : 'text-gray-700'
                    : sel ? 'text-blue-700' : 'text-gray-700'
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`relative flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                      sel ? selColor : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {sel && (
                      <CheckCircle2
                        size={13}
                        className={`absolute top-2 right-2 ${color === 'green' ? 'text-green-600' : 'text-blue-600'}`}
                      />
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
                      <Icon size={20} />
                    </div>
                    <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
                  </button>
                )
              })}
            </div>
            {!method && (
              <p className="text-xs text-amber-600 text-center mt-2">Select a payment method to continue</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isValid}
              className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors ${
                isValid
                  ? isPartial
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isBulk ? 'Mark All Paid' : isPartial ? 'Record Partial' : 'Confirm Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
