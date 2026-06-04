import { useState, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  BadgeDollarSign,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface NavItem {
  to: string
  icon: ReactNode
  label: string
}

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const adminNav: NavItem[] = [
    { to: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/admin/schools', icon: <School size={20} />, label: 'Schools' },
    { to: '/admin/users', icon: <Users size={20} />, label: 'Users' },
  ]

  const schoolNav: NavItem[] = [
    { to: '/school', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/school/students', icon: <GraduationCap size={20} />, label: 'Students' },
    { to: '/school/fees', icon: <BadgeDollarSign size={20} />, label: 'Fees' },
  ]

  const navItems = profile?.role === 'admin' ? adminNav : schoolNav

  const roleBadge = {
    admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
    school_owner: { label: 'Principal', color: 'bg-blue-100 text-blue-700' },
    staff: { label: 'Staff', color: 'bg-green-100 text-green-700' },
  }[profile?.role ?? 'staff']

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login')
      toast.success('Signed out successfully')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Fee Manager</p>
            <p className="text-xs text-gray-500 leading-tight">School System</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-600 font-semibold text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name}</p>
            {profile?.schools && (
              <p className="text-xs text-gray-500 truncate">{profile.schools.name}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge.color}`}>
            {roleBadge.label}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/school'}
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-gray-200 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-60">
        {/* Top Header (mobile) */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 -ml-2"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center flex-shrink-0">
              <BookOpen size={15} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm truncate">Fee Manager</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge.color}`}>
            {roleBadge.label}
          </span>
        </header>

        {/* Desktop header bar */}
        <header className="hidden md:flex sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Welcome back,</span>
            <span className="font-medium text-gray-900">{profile?.full_name}</span>
            {profile?.schools && (
              <>
                <ChevronRight size={14} />
                <span className="text-indigo-600 font-medium">{profile.schools.name}</span>
              </>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}
