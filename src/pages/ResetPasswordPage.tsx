import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { Lock, Eye, EyeOff, Sun, Moon, CheckCircle2, AlertTriangle } from 'lucide-react'
import { FeeFlowIcon } from '../components/FeeFlowLogo'
import toast from 'react-hot-toast'

type PageState = 'waiting' | 'ready' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>('waiting')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Supabase emits PASSWORD_RECOVERY when it detects the recovery token in the URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready')
      }
    })

    // Also check if we already have a session (e.g. page was refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPageState('ready')
    })

    // If no event fires after 5 seconds the link is invalid or expired
    const timer = setTimeout(() => {
      setPageState((s) => (s === 'waiting' ? 'invalid' : s))
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPageState('success')
      // Sign out so user logs in fresh with new password
      await supabase.auth.signOut()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  const mismatch = confirm.length > 0 && password !== confirm
  const strong   = password.length >= 8

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
        style={{ backgroundColor: 'var(--c-surface)', color: 'var(--c-text-3)', border: '1px solid var(--glass-border)' }}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-5 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4A90D9, transparent)', transform: 'translate(30%,-30%)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-5 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4A90D9, transparent)', transform: 'translate(-30%,30%)' }} />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <FeeFlowIcon size={56} />
          <div className="flex items-center gap-1.5 mt-3">
            <span className="font-extrabold" style={{ fontSize: '1.5rem', color: 'var(--c-text-1)', letterSpacing: '-0.02em' }}>Fee</span>
            <span className="font-extrabold" style={{ fontSize: '1.5rem', color: '#4A90D9', letterSpacing: '-0.02em' }}>Flow</span>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: 'var(--glass-bg-strong)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* ── Waiting for Supabase token ── */}
          {pageState === 'waiting' && (
            <div className="text-center py-6">
              <div className="h-10 w-10 border-2 rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }} />
              <p className="text-sm" style={{ color: 'var(--c-text-3)' }}>Verifying reset link…</p>
            </div>
          )}

          {/* ── Invalid / expired link ── */}
          {pageState === 'invalid' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--c-danger-bg)' }}>
                <AlertTriangle size={28} style={{ color: 'var(--c-danger)' }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--c-text-1)' }}>Link invalid or expired</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--c-text-3)' }}>
                This password reset link has expired or already been used. Please request a new one.
              </p>
              <button className="btn-primary w-full" onClick={() => navigate('/login')}>
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Reset form ── */}
          {pageState === 'ready' && (
            <>
              <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--c-text-1)' }}>
                Set New Password
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--c-text-3)' }}>
                Choose a strong password for your account.
              </p>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--c-text-2)' }}>
                    New Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-4)' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="input-field pl-9 pr-10"
                      required
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--c-text-4)' }} tabIndex={-1}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <p className="text-xs mt-1" style={{ color: strong ? 'var(--c-success)' : 'var(--c-warning)' }}>
                      {strong ? '✓ Strong password' : 'Use 8+ characters for a stronger password'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--c-text-2)' }}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-4)' }} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      className={`input-field pl-9 pr-10 ${mismatch ? 'border-red-500' : ''}`}
                      style={mismatch ? { borderColor: 'var(--c-danger)' } : undefined}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--c-text-4)' }} tabIndex={-1}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {mismatch && (
                    <p className="text-xs mt-1" style={{ color: 'var(--c-danger)' }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving || mismatch || password.length < 6}
                  className="btn-primary w-full text-base mt-2"
                >
                  {saving ? (
                    <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                  ) : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* ── Success ── */}
          {pageState === 'success' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--c-success-bg)' }}>
                <CheckCircle2 size={30} style={{ color: 'var(--c-success)' }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--c-text-1)' }}>
                Password reset!
              </h3>
              <p className="text-sm mb-5" style={{ color: 'var(--c-text-3)' }}>
                Your password has been updated successfully. Please sign in with your new password.
              </p>
              <button className="btn-primary w-full" onClick={() => navigate('/login')}>
                Go to Sign In
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--c-text-4)' }}>
          &copy; {new Date().getFullYear()} FeeFlow
        </p>
      </div>
    </div>
  )
}
