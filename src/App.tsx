import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import SchoolsPage from './pages/admin/SchoolsPage'
import AddSchoolPage from './pages/admin/AddSchoolPage'
import SchoolDetailPage from './pages/admin/SchoolDetailPage'
import UsersPage from './pages/admin/UsersPage'
import AddUserPage from './pages/admin/AddUserPage'
import AdminStudentsPage from './pages/admin/AdminStudentsPage'

// School pages
import SchoolDashboard from './pages/school/SchoolDashboard'
import StudentsPage from './pages/school/StudentsPage'
import FeesPage from './pages/school/FeesPage'
import ExpensesPage from './pages/school/ExpensesPage'
import ContactsPage from './pages/school/ContactsPage'
import PromoteStudentsPage from './pages/school/PromoteStudentsPage'
import InquiriesPage from './pages/school/InquiriesPage'
import InvoicesPage from './pages/school/InvoicesPage'
import AssessmentsPage from './pages/school/AssessmentsPage'
import AssessmentResultsPage from './pages/school/AssessmentResultsPage'

// Shared pages
import AddExpensePage from './pages/shared/AddExpensePage'
import NewAdmissionPage from './pages/shared/NewAdmissionPage'
import StudentProfilePage from './pages/shared/StudentProfilePage'

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingSpinner fullPage text="Loading..." />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner fullPage text="Loading profile..." />
  if (profile.role === 'admin' || profile.role === 'demo') return <Navigate to="/admin" replace />
  return <Navigate to="/school" replace />
}

function W({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ── Admin + Demo ── */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin','demo']}><W><AdminDashboard /></W></ProtectedRoute>} />
      <Route path="/admin/schools" element={<ProtectedRoute allowedRoles={['admin','demo']}><W><SchoolsPage /></W></ProtectedRoute>} />
      <Route path="/admin/schools/new" element={<ProtectedRoute allowedRoles={['admin']}><W><AddSchoolPage /></W></ProtectedRoute>} />
      <Route path="/admin/schools/:id" element={<ProtectedRoute allowedRoles={['admin','demo']}><W><SchoolDetailPage /></W></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><W><UsersPage /></W></ProtectedRoute>} />
      <Route path="/admin/users/new" element={<ProtectedRoute allowedRoles={['admin']}><W><AddUserPage /></W></ProtectedRoute>} />
      <Route path="/admin/expenses" element={<ProtectedRoute allowedRoles={['admin','demo']}><W><ExpensesPage /></W></ProtectedRoute>} />
      <Route path="/admin/expenses/new" element={<ProtectedRoute allowedRoles={['admin']}><W><AddExpensePage /></W></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin','demo']}><W><AdminStudentsPage /></W></ProtectedRoute>} />
      <Route path="/admin/students/new" element={<ProtectedRoute allowedRoles={['admin']}><W><NewAdmissionPage /></W></ProtectedRoute>} />
      <Route path="/admin/students/:id" element={<ProtectedRoute allowedRoles={['admin','demo']}><W><StudentProfilePage /></W></ProtectedRoute>} />

      {/* ── School / Staff ── */}
      <Route path="/school" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><SchoolDashboard /></W></ProtectedRoute>} />
      <Route path="/school/fees" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><FeesPage /></W></ProtectedRoute>} />
      <Route path="/school/students" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><StudentsPage /></W></ProtectedRoute>} />
      <Route path="/school/students/new" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><NewAdmissionPage /></W></ProtectedRoute>} />
      <Route path="/school/students/promote" element={<ProtectedRoute allowedRoles={['school_owner']}><W><PromoteStudentsPage /></W></ProtectedRoute>} />
      <Route path="/school/students/:id" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><StudentProfilePage /></W></ProtectedRoute>} />
      <Route path="/school/contacts" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><ContactsPage /></W></ProtectedRoute>} />
      <Route path="/school/expenses" element={<ProtectedRoute allowedRoles={['school_owner']}><W><ExpensesPage /></W></ProtectedRoute>} />
      <Route path="/school/expenses/new" element={<ProtectedRoute allowedRoles={['school_owner']}><W><AddExpensePage /></W></ProtectedRoute>} />
      <Route path="/school/admissions" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><InquiriesPage /></W></ProtectedRoute>} />
      <Route path="/school/invoices" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><InvoicesPage /></W></ProtectedRoute>} />
      <Route path="/school/assessments" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><AssessmentsPage /></W></ProtectedRoute>} />
      <Route path="/school/assessments/:id" element={<ProtectedRoute allowedRoles={['school_owner','staff']}><W><AssessmentResultsPage /></W></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
