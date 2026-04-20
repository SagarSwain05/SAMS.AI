import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboardIntegrated from './components/TeacherDashboardIntegrated';
import StudentDashboard from './components/StudentDashboard';
import RecognitionKiosk from './components/RecognitionKiosk';

// ── Legacy type exports (kept for backward compat with existing components) ──
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  name: string;
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  regdNumber: string;
  college: string;
  class: string;
  section: string;
  email: string;
  phone: string;
  status: 'present' | 'absent' | 'late';
  entryTime?: string;
  exitTime?: string;
  notes?: string;
  subjects: { [key: string]: SubjectAttendance };
}

export interface SubjectAttendance {
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
  lastAttended: string;
  status: 'present' | 'absent' | 'late';
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  subject: string;
  entryTime?: string;
  exitTime?: string;
  notes?: string;
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
        <p className="mt-4 text-gray-600">Loading…</p>
      </div>
    </div>
  );
}

// ── Protected route wrapper ───────────────────────────────────────────────────
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactElement;
  requiredRole?: 'admin' | 'teacher' | 'student';
}) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (requiredRole && user.role !== requiredRole) {
    // Redirect to the correct dashboard instead of a dead end
    const dest = user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student';
    return <Navigate to={dest} replace />;
  }
  return children;
}

// ── Root redirect — sends logged-in users straight to their dashboard ─────────
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <LandingPage />;
  const dest = user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student';
  return <Navigate to={dest} replace />;
}

// ── Dashboard wrappers (convert typed User to legacy User) ────────────────────
function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const legacyUser: User = { id: user.id.toString(), username: user.username, role: 'admin', name: user.name };
  return <AdminDashboard user={legacyUser} onLogout={async () => { await logout(); navigate('/'); }} />;
}

function TeacherPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const legacyUser: User = { id: user.id.toString(), username: user.username, role: 'teacher', name: user.name };
  return <TeacherDashboardIntegrated user={legacyUser} onLogout={async () => { await logout(); navigate('/'); }} />;
}

function StudentPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const legacyUser: User = { id: user.id.toString(), username: user.username, role: 'student', name: user.name };
  return <StudentDashboard user={legacyUser} onLogout={async () => { await logout(); navigate('/'); }} />;
}

// ── App router ────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/kiosk" element={<RecognitionKiosk />} />

      {/* Protected dashboards — nested routes keep URL stable during tab switches */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/*"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all → root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: { background: '#363636', color: '#fff' },
                success: { duration: 3000, iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error:   { duration: 5000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
