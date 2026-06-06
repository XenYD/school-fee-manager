import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff, Sun, Moon, X, ArrowLeft, Send } from 'lucide-react'
import { FeeFlowIcon } from '../components/FeeFlowLogo'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { signIn, user, profile, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Forgot-password state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(profile.role === 'admin' ? '/admin' : '/school', { replace: true })
    }
  }, [user, profile, loading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password')
      return
    }
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      toast.success('Welcome back!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      toast.error(msg.includes('Invalid') ? 'Invalid email or password' : msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail.trim()) { toast.error('Please enter your email address'); return }
    setSendingReset(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo })
      if (error) throw error
      setResetSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setSendingReset(false)
    }
  }

  function openForgot() {
    setForgotEmail(email) // pre-fill from login form if already typed
    setResetSent(false)
    setShowForgot(true)
  }

  function closeForgot() {
    setShowForgot(false)
    setResetSent(false)
    setForgotEmail('')
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
        style={{
          backgroundColor: 'var(--c-surface)',
          color: 'var(--c-text-3)',
          border: '1px solid var(--glass-border)',
        }}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-5 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4A90D9, transparent)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-5 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #4A90D9, transparent)', transform: 'translate(-30%, 30%)' }} />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <FeeFlowIcon size={64} />
          <div className="flex items-center gap-1.5 mt-4">
            <span className="font-extrabold" style={{ fontSize: '1.75rem', color: 'var(--c-text-1)', letterSpacing: '-0.02em' }}>Fee</span>
            <span className="font-extrabold" style={{ fontSize: '1.75rem', color: '#4A90D9', letterSpacing: '-0.02em' }}>Flow</span>
          </div>
          <p className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: 'var(--c-text-4)' }}>
            School Fee Management
          </p>
        </div>

        {/* Login Card */}
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
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--c-text-1)' }}>
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--c-text-2)' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-4)' }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="input-field pl-9"
                  autoComplete="email" autoCapitalize="none" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium" style={{ color: 'var(--c-text-2)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs font-medium hover:underline transition-colors"
                  style={{ color: 'var(--c-accent)' }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-4)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="input-field pl-9 pr-10"
                  autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: 'var(--c-text-4)' }} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full text-base mt-2">
              {submitting ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: 'var(--c-text-4)' }}>
            New staff member?{' '}
            <Link to="/signup" className="font-medium hover:underline" style={{ color: 'var(--c-accent)' }}>
              Create an account
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--c-text-4)' }}>
          &copy; {new Date().getFullYear()} FeeFlow
        </p>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: 'var(--glass-bg-strong)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--c-accent-bg)' }}>
                  <Mail size={16} style={{ color: 'var(--c-accent)' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight" style={{ color: 'var(--c-text-1)' }}>
                    Reset Password
                  </h3>
                  <p className="text-xs leading-tight" style={{ color: 'var(--c-text-4)' }}>
                    We'll send a reset link to your email
                  </p>
                </div>
              </div>
              <button onClick={closeForgot} className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--c-text-4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-surface-3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                <X size={18} />
              </button>
            </div>

            {resetSent ? (
              /* Success state */
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--c-success-bg)' }}>
                  <Send size={24} style={{ color: 'var(--c-success)' }} />
                </div>
                <h4 className="font-semibold mb-2" style={{ color: 'var(--c-text-1)' }}>
                  Check your inbox
                </h4>
                <p className="text-sm mb-1" style={{ color: 'var(--c-text-3)' }}>
                  A reset link was sent to
                </p>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--c-accent)' }}>
                  {forgotEmail}
                </p>
                <p className="text-xs mb-5" style={{ color: 'var(--c-text-4)' }}>
                  Click the link in the email to set a new password. Check your spam folder if you don't see it.
                </p>
                <button onClick={closeForgot} className="btn-primary w-full">
                  Back to Sign In
                </button>
              </div>
            ) : (
              /* Form state */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--c-text-2)' }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-4)' }} />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-field pl-9"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={closeForgot} className="btn-secondary flex-1">
                    <ArrowLeft size={15} /> Cancel
                  </button>
                  <button type="submit" disabled={sendingReset} className="btn-primary flex-1">
                    {sendingReset ? (
                      <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                    ) : (
                      <><Send size={15} />Send Link</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
