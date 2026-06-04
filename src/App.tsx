import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

import AdminDashboard from './pages/admin/AdminDashboard'
import SchoolsPage from './pages/admin/SchoolsPage'
import SchoolDetailPage from './pages/admin/SchoolDetailPage'
import UsersPage from './pages/admin/UsersPage'

import SchoolDashboard from './pages/school/SchoolDashboard'
import StudentsPage from './pages/school/StudentsPage'
import FeesPage from './pages/school/FeesPage'

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner fullPage text="Loading..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner fullPage text="Loading profile..." />

  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/school" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/schools" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout>
            <SchoolsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/schools/:id" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout>
            <SchoolDetailPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout>
            <UsersPage />
          </Layout>
        </ProtectedRoute>
      } />

      {/* School / Staff Routes */}
      <Route path="/school" element={
        <ProtectedRoute allowedRoles={['school_owner', 'staff']}>
          <Layout>
            <SchoolDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/school/students" element={
        <ProtectedRoute allowedRoles={['school_owner', 'staff']}>
          <Layout>
            <StudentsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/school/fees" element={
        <ProtectedRoute allowedRoles={['school_owner', 'staff']}>
          <Layout>
            <FeesPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
