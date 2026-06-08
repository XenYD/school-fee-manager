import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { School, UserRole } from '../../types'
import { ArrowLeft, UserPlus, Save, Shield, UserCheck, GraduationCap, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES: { value: UserRole; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'admin',        label: 'Admin',     desc: 'Full access to all schools and features', icon: <Shield size={16} /> },
  { value: 'school_owner', label: 'Principal', desc: 'Manage their assigned school',             icon: <UserCheck size={16} /> },
  { value: 'staff',        label: 'Staff',     desc: 'Fee collection for their school',           icon: <GraduationCap size={16} /> },
  { value: 'demo',         label: 'Demo',      desc: 'View-only access to all schools',           icon: <Eye size={16} /> },
]

export default function AddUserPage() {
  const navigate = useNavigate()
  const [schools, setSchools] = useState<School[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff' as UserRole,
    school_id: '',
  })

  useEffect(() => {
    supabase.from('schools').select('*').order('name').then(({ data }) => setSchools(data ?? []))
  }, [])

  const needsSchool = form.role === 'school_owner' || form.role === 'staff'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Full name is required'); return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (needsSchool && !form.school_id) { toast.error('Please assign a school for this role'); return }

    setSaving(true)
    try {
      // Create auth user via admin API
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email.trim(),
        password: form.password,
        email_confirm: true,
        user_metadata: { full_name: form.full_name.trim() },
      })
      if (authErr) throw authErr

      // Update profile with role + school
      if (authData.user) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name.trim(),
            role: form.role,
            school_id: needsSchool ? form.school_id || null : null,
          })
          .eq('id', authData.user.id)
        if (profileErr) throw profileErr
      }

      toast.success(`User "${form.full_name}" created!`)
      navigate('/admin/users')
    } catch (err: unknown) {
      // Fallback: if admin API not available, show instruction
      const msg = err instanceof Error ? err.message : 'Failed to create user'
      if (msg.includes('not allowed') || msg.includes('forbidden') || msg.includes('admin')) {
        toast.error('Admin user creation requires service role key. Ask the user to sign up, then assign role from All Users.')
      } else {
        toast.error(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'input-field text-sm'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/users')}
          className="p-2 rounded-lg transition-colors" style={{ color: 'var(--c-text-3)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add New User</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create an account and assign role</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="card" style={{ borderColor: 'rgba(74,144,217,0.3)', backgroundColor: 'rgba(74,144,217,0.06)' }}>
        <p className="text-xs" style={{ color: 'var(--c-text-2)' }}>
          <strong>Tip:</strong> If creation fails due to permissions, have the user sign up themselves at the login page, then use <strong>All Users</strong> to assign their role and school.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <UserPlus size={16} style={{ color: 'var(--c-accent)' }} />
            <h2 className="font-semibold text-gray-900 text-sm">Account Details</h2>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Full Name <span className="text-red-400">*</span></label>
            <input className={inputCls} placeholder="e.g. Ahmed Khan" autoFocus
              value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Email <span className="text-red-400">*</span></label>
              <input type="email" className={inputCls} placeholder="user@example.com"
                value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Password <span className="text-red-400">*</span></label>
              <input type="password" className={inputCls} placeholder="Min 6 characters"
                value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Role */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Shield size={16} style={{ color: 'var(--c-accent)' }} />
            <h2 className="font-semibold text-gray-900 text-sm">Role & Access</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button key={r.value} type="button" onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                className="flex items-start gap-3 p-3 rounded-xl border text-left transition-all"
                style={{
                  borderColor: form.role === r.value ? 'var(--c-accent)' : 'var(--c-border)',
                  backgroundColor: form.role === r.value ? 'rgba(74,144,217,0.10)' : 'var(--c-surface-2)',
                }}>
                <div className="mt-0.5 flex-shrink-0" style={{ color: form.role === r.value ? 'var(--c-accent)' : 'var(--c-text-4)' }}>
                  {r.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {needsSchool && (
            <div className="mt-2">
              <label className={labelCls} style={{ color: 'var(--c-text-2)' }}>Assign School <span className="text-red-400">*</span></label>
              <select className={inputCls} value={form.school_id} onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value }))}>
                <option value="">Select school</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/admin/users')} className="btn-secondary text-sm px-5">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm px-8">
            {saving
              ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
              : <><Save size={15} /> Create User</>}
          </button>
        </div>
      </form>
    </div>
  )
}
