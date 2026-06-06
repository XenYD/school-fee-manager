import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { UserRole } from '../types'
import LoadingSpinner from './LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner fullPage text="Loading..." />

  if (!user) return <Navigate to="/login" replace />

  if (!profile) return <LoadingSpinner fullPage text="Loading profile..." />

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'admin' || profile.role === 'demo') return <Navigate to="/admin" replace />
    return <Navigate to="/school" replace />
  }

  return <>{children}</>
}
