import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { FeeResetType } from '../../types'
import { CLASS_LIST } from '../../types'
import { ArrowLeft, School, ChevronDown, ChevronUp, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const initClassFees = () => Object.fromEntries(CLASS_LIST.map((c) => [c, '']))

export default function AddSchoolPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [showClassFees, setShowClassFees] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    fee_reset_type: 'monthly' as FeeResetType,
    class_fees: initClassFees(),
  })

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('School name is required'); return }
    setSaving(true)
    try {
      const classFees: Record<string, number> = {}
      for (const [cls, val] of Object.entries(form.class_fees)) {
        const n = parseFloat(val)
        if (!isNaN(n) && n > 0) classFees[cls] = n
      }
      const { error } = await supabase.from('schools').insert({
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        fee_reset_type: form.fee_reset_type,
        class_fees: classFees,
      })
      if (error) throw error
      toast.success(`School "${form.name}" created!`)
      navigate('/admin/schools')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create school')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/schools')}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--c-text-3)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add New School</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the school details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <School size={16} style={{ color: 'var(--c-accent)' }} />
            <h2 className="font-semibold text-gray-900 text-sm">School Information</h2>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>School Name <span className="text-red-400">*</span></label>
            <input className={inputCls} placeholder="e.g. DAR-UL-ILM School" autoFocus
              value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Address</label>
              <input className={inputCls} placeholder="School address"
                value={form.address} onChange={(e) => setField('address', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Phone</label>
              <input className={inputCls} placeholder="Contact number"
                value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Fee Reset Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(['monthly', 'term'] as FeeResetType[]).map((t) => (
                <button key={t} type="button" onClick={() => setField('fee_reset_type', t)}
                  className="flex items-start gap-3 p-3 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: form.fee_reset_type === t ? 'var(--c-accent)' : 'var(--c-border)',
                    backgroundColor: form.fee_reset_type === t ? 'rgba(74,144,217,0.10)' : 'var(--c-surface-2)',
                  }}>
                  <div className="w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: form.fee_reset_type === t ? 'var(--c-accent)' : 'var(--c-border)' }}>
                    {form.fee_reset_type === t && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--c-accent)' }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t === 'monthly' ? 'Monthly' : 'Term-Based'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t === 'monthly' ? 'Fees reset on 1st of every month' : 'Fees reset every 3 months (Jan, Apr, Jul, Oct)'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Class Fees */}
        <div className="card">
          <button type="button" onClick={() => setShowClassFees((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-900">
            <span>Class-wise Fee Amounts <span className="font-normal text-gray-400 ml-1">(optional)</span></span>
            {showClassFees ? <ChevronUp size={16} style={{ color: 'var(--c-accent)' }} /> : <ChevronDown size={16} style={{ color: 'var(--c-accent)' }} />}
          </button>
          {showClassFees && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CLASS_LIST.map((cls) => (
                <div key={cls}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-text-3)' }}>{cls}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: 'var(--c-text-4)' }}>Rs</span>
                    <input type="number" className={inputCls + ' pl-8'} placeholder="0"
                      value={form.class_fees[cls]}
                      onChange={(e) => setField('class_fees', { ...form.class_fees, [cls]: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/admin/schools')} className="btn-secondary text-sm px-5">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary text-sm px-8">
            {saving
              ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
              : <><Save size={15} /> Create School</>}
          </button>
        </div>
      </form>
    </div>
  )
}
