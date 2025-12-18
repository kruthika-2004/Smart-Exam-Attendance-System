import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { Chatbot } from './components/Chatbot';

function AppContent() {
  const { user, role, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#0B6CF9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !role) {
    if (showLogin) {
      return <Login />;
    }
    return <Home onLogin={() => setShowLogin(true)} />;
  }

  if (role === 'admin' || role === 'teacher') {
    return <AdminDashboard />;
  }

  if (role === 'student') {
    return <StudentDashboard />;
  }

  return <Home onLogin={() => setShowLogin(true)} />;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
        <Chatbot />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
