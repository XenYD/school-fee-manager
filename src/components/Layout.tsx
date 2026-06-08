import { useState, ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  LayoutDashboard, School, Users, GraduationCap, BadgeDollarSign,
  LogOut, Menu, X, ChevronRight, Sun, Moon, Receipt, Phone, ChevronDown,
} from 'lucide-react'
import FeeFlowLogo, { FeeFlowIcon } from './FeeFlowLogo'
import toast from 'react-hot-toast'

interface NavLeaf { type: 'leaf'; to: string; label: string; exact?: boolean }
interface NavGroup {
  type: 'group'
  label: string
  icon: ReactNode
  children: NavLeaf[]
  matchPaths?: string[] // paths that count as "active" for this group
}
type NavEntry = ({ type: 'leaf'; to: string; label: string; icon: ReactNode; exact?: boolean }) | NavGroup

interface LayoutProps { children: ReactNode }

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Pre-open the group that contains the current path
    return new Set<string>()
  })

  // ── Nav definitions ─────────────────────────────────────────────────────────

  const adminNav: NavEntry[] = [
    { type: 'leaf', to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} />, exact: true },
    {
      type: 'group', label: 'Schools', icon: <School size={18} />,
      matchPaths: ['/admin/schools'],
      children: [
        { type: 'leaf', to: '/admin/schools', label: 'All Schools' },
        { type: 'leaf', to: '/admin/schools/new', label: 'Add School' },
      ],
    },
    {
      type: 'group', label: 'Users', icon: <Users size={18} />,
      matchPaths: ['/admin/users'],
      children: [
        { type: 'leaf', to: '/admin/users', label: 'All Users' },
        { type: 'leaf', to: '/admin/users/new', label: 'Add User' },
      ],
    },
    {
      type: 'group', label: 'Expenses', icon: <Receipt size={18} />,
      matchPaths: ['/admin/expenses'],
      children: [
        { type: 'leaf', to: '/admin/expenses', label: 'All Expenses' },
        { type: 'leaf', to: '/admin/expenses/new', label: 'Add Expense' },
      ],
    },
    {
      type: 'group', label: 'Students', icon: <GraduationCap size={18} />,
      matchPaths: ['/admin/students'],
      children: [
        { type: 'leaf', to: '/admin/students', label: 'All Students' },
        { type: 'leaf', to: '/admin/students/new', label: 'New Admission' },
      ],
    },
  ]

  const demoNav: NavEntry[] = [
    { type: 'leaf', to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} />, exact: true },
    { type: 'leaf', to: '/admin/schools', label: 'Schools', icon: <School size={18} /> },
    { type: 'leaf', to: '/admin/expenses', label: 'Expenses', icon: <Receipt size={18} /> },
  ]

  const principalNav: NavEntry[] = [
    { type: 'leaf', to: '/school', label: 'Dashboard', icon: <LayoutDashboard size={18} />, exact: true },
    { type: 'leaf', to: '/school/fees', label: 'Fees', icon: <BadgeDollarSign size={18} /> },
    {
      type: 'group', label: 'Students', icon: <GraduationCap size={18} />,
      matchPaths: ['/school/students'],
      children: [
        { type: 'leaf', to: '/school/students', label: 'All Students' },
        { type: 'leaf', to: '/school/students/new', label: 'New Admission' },
      ],
    },
    { type: 'leaf', to: '/school/contacts', label: 'Contacts', icon: <Phone size={18} /> },
    {
      type: 'group', label: 'Expenses', icon: <Receipt size={18} />,
      matchPaths: ['/school/expenses'],
      children: [
        { type: 'leaf', to: '/school/expenses', label: 'All Expenses' },
        { type: 'leaf', to: '/school/expenses/new', label: 'Add Expense' },
      ],
    },
  ]

  const staffNav: NavEntry[] = [
    { type: 'leaf', to: '/school', label: 'Dashboard', icon: <LayoutDashboard size={18} />, exact: true },
    { type: 'leaf', to: '/school/fees', label: 'Fees', icon: <BadgeDollarSign size={18} /> },
    {
      type: 'group', label: 'Students', icon: <GraduationCap size={18} />,
      matchPaths: ['/school/students'],
      children: [
        { type: 'leaf', to: '/school/students', label: 'All Students' },
        { type: 'leaf', to: '/school/students/new', label: 'New Admission' },
      ],
    },
    { type: 'leaf', to: '/school/contacts', label: 'Contacts', icon: <Phone size={18} /> },
  ]

  const navEntries: NavEntry[] =
    profile?.role === 'admin' ? adminNav :
    profile?.role === 'demo'  ? demoNav  :
    profile?.role === 'school_owner' ? principalNav :
    staffNav

  const roleBadge = ({
    admin:        { label: 'Admin',     cls: 'bg-purple-500/20 text-purple-200 border border-purple-400/30' },
    school_owner: { label: 'Principal', cls: 'bg-blue-500/20 text-blue-200 border border-blue-400/30' },
    staff:        { label: 'Staff',     cls: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' },
    demo:         { label: 'Demo',      cls: 'bg-orange-500/20 text-orange-200 border border-orange-400/30' },
  } as Record<string, { label: string; cls: string }>)[profile?.role ?? 'staff'] ?? { label: 'Staff', cls: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' }

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login')
      toast.success('Signed out successfully')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  function isGroupActive(entry: NavGroup): boolean {
    return entry.children.some((c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function isOpen(entry: NavGroup): boolean {
    return openGroups.has(entry.label) || isGroupActive(entry)
  }

  // ── Leaf nav link ────────────────────────────────────────────────────────────
  function LeafLink({ to, label, icon, exact, sub = false, onClick }: {
    to: string; label: string; icon?: ReactNode; exact?: boolean; sub?: boolean; onClick?: () => void
  }) {
    const active = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + '/')
    return (
      <NavLink
        to={to}
        end={exact}
        onClick={() => { setSidebarOpen(false); onClick?.() }}
        className={`flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          sub ? 'px-3 py-1.5 ml-6' : 'px-3 py-2.5'
        } ${active
          ? 'bg-[var(--c-nav-active-bg)] text-white shadow-sm'
          : 'text-[var(--c-sidebar-muted)] hover:bg-[var(--c-nav-hover-bg)] hover:text-white'
        }`}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {sub && !icon && <span className="w-1 h-1 rounded-full bg-current opacity-60 flex-shrink-0 ml-0.5" />}
        <span>{label}</span>
      </NavLink>
    )
  }

  // ── Group nav ────────────────────────────────────────────────────────────────
  function GroupNav({ entry }: { entry: NavGroup }) {
    const active = isGroupActive(entry)
    const open = isOpen(entry)
    return (
      <div>
        <button
          onClick={() => toggleGroup(entry.label)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            active
              ? 'text-white bg-[var(--c-nav-hover-bg)]'
              : 'text-[var(--c-sidebar-muted)] hover:bg-[var(--c-nav-hover-bg)] hover:text-white'
          }`}
        >
          <span className="flex-shrink-0">{entry.icon}</span>
          <span className="flex-1 text-left">{entry.label}</span>
          <ChevronDown
            size={14}
            className="flex-shrink-0 transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {entry.children.map((child) => (
              <LeafLink key={child.to} to={child.to} label={child.label} sub />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Sidebar content ──────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full"
      style={{
        background: 'var(--c-sidebar)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--c-sidebar-border)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--c-sidebar-border)]">
        <FeeFlowLogo size={36} variant="sidebar" />
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-[var(--c-sidebar-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #4A90D9, #2C5F8A)' }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">{profile?.full_name}</p>
            {profile?.schools && (
              <p className="text-xs text-[var(--c-sidebar-muted)] truncate leading-tight">{profile.schools.name}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge.cls}`}>
            {roleBadge.label}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--c-sidebar-muted)] px-3 mb-2">
          Navigation
        </p>
        {navEntries.map((entry) =>
          entry.type === 'leaf'
            ? <LeafLink key={entry.to} to={entry.to} label={entry.label} icon={entry.icon} exact={entry.exact} />
            : <GroupNav key={entry.label} entry={entry} />
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1 border-t border-[var(--c-sidebar-border)] pt-3">
        <button onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--c-sidebar-muted)] hover:bg-[var(--c-nav-hover-bg)] hover:text-white transition-all duration-150">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--c-sidebar-muted)] hover:bg-red-500/15 hover:text-red-300 transition-all duration-150">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'transparent' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-30" style={{ boxShadow: '4px 0 32px rgba(0,0,0,0.35)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`md:hidden fixed inset-y-0 left-0 w-72 z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ boxShadow: '8px 0 40px rgba(0,0,0,0.5)' }}>
        <div className="absolute top-3 right-3 z-10">
          <button onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="md:pl-60">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3 md:hidden border-b"
          style={{ background: 'var(--c-sidebar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'var(--c-sidebar-border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 -ml-2 transition-colors">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FeeFlowIcon size={28} />
            <div className="flex items-center gap-1 truncate">
              <span className="font-extrabold text-white text-sm">Fee</span>
              <span className="font-extrabold text-sm" style={{ color: '#4A90D9' }}>Flow</span>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge.cls}`}>{roleBadge.label}</span>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex sticky top-0 z-20 px-6 py-3 items-center justify-between border-b"
          style={{ background: 'var(--glass-bg-strong)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'var(--glass-border)', boxShadow: '0 2px 20px rgba(0,0,0,0.25)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--c-text-3)' }}>
            <span>Welcome back,</span>
            <span className="font-semibold" style={{ color: 'var(--c-text-1)' }}>{profile?.full_name}</span>
            {profile?.schools && (
              <>
                <ChevronRight size={14} />
                <span className="font-medium" style={{ color: 'var(--c-accent)' }}>{profile.schools.name}</span>
              </>
            )}
          </div>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--c-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--c-danger)'; e.currentTarget.style.backgroundColor = 'var(--c-danger-bg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--c-text-3)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 pb-6">{children}</main>
      </div>
    </div>
  )
}

