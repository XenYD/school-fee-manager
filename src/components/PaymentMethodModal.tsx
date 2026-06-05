import { useState } from 'react'
import { Banknote, Smartphone, X, CheckCircle2 } from 'lucide-react'
import type { PaymentMethod } from '../types'

interface Props {
  /** Shown when marking a single student paid */
  studentName?: string
  feeAmount?: number
  /** Shown when doing a bulk "Mark All Paid" */
  isBulk?: boolean
  bulkCount?: number
  onConfirm: (method: PaymentMethod) => void
  onCancel: () => void
}

export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: React.ReactNode; activeColor: string; activeBg: string; activeBorder: string }> = {
  cash: {
    label: 'Cash',
    icon: <Banknote size={24} />,
    activeColor: 'text-green-700',
    activeBg: 'bg-green-50',
    activeBorder: 'border-green-500',
  },
  online: {
    label: 'Online',
    icon: <Smartphone size={24} />,
    activeColor: 'text-blue-700',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-500',
  },
}

export default function PaymentMethodModal({
  studentName,
  feeAmount,
  isBulk = false,
  bulkCount = 0,
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<PaymentMethod | null>(null)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">
              {isBulk ? 'Bulk Payment Confirmation' : 'Confirm Payment'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Select how the fee was collected</p>
          </div>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Context strip */}
          <div className="bg-gray-50 rounded-xl p-3.5 flex items-center justify-between">
            {isBulk ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {bulkCount} student{bulkCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">All will use the same method</p>
                </div>
                <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                  Bulk
                </span>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{studentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Monthly fee</p>
                </div>
                <p className="text-lg font-bold text-indigo-600 flex-shrink-0 ml-3">
                  {feeAmount?.toLocaleString()}
                </p>
              </>
            )}
          </div>

          {/* Payment Method Picker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Payment Method *
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(PAYMENT_METHOD_CONFIG) as [PaymentMethod, typeof PAYMENT_METHOD_CONFIG[PaymentMethod]][]).map(([method, cfg]) => {
                const isSelected = selected === method
                return (
                  <button
                    key={method}
                    onClick={() => setSelected(method)}
                    className={`relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-xl border-2 transition-all focus:outline-none ${
                      isSelected
                        ? `${cfg.activeBorder} ${cfg.activeBg}`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <CheckCircle2 size={14} className={cfg.activeColor} />
                      </span>
                    )}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isSelected ? `${cfg.activeBg} ${cfg.activeColor}` : 'bg-gray-100 text-gray-500'
                    }`}>
                      {cfg.icon}
                    </div>
                    <span className={`text-sm font-bold ${isSelected ? cfg.activeColor : 'text-gray-700'}`}>
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {!selected && (
              <p className="text-xs text-amber-600 mt-2.5 text-center font-medium">
                ⚠ Please select Cash or Online to continue
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} className="btn-secondary flex-1 py-2.5">
              Cancel
            </button>
            <button
              onClick={() => selected && onConfirm(selected)}
              disabled={!selected}
              className={`btn-success flex-1 py-2.5 transition-opacity ${!selected ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <CheckCircle2 size={16} />
              Confirm Paid
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
