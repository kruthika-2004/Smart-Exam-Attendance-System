import { useState } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopBar } from '../../components/layout/TopBar';
import { AdminOverview } from './AdminOverview';
import { ClassManagement } from './ClassManagement';
import { StudentManagement } from './StudentManagement';
import { SessionManagement } from './SessionManagement';
import { AttendanceManagement } from './AttendanceManagement';
import { AdminSettings } from './AdminSettings';
import { LiveAttendance } from './LiveAttendance';

export function AdminDashboard() {
  const [currentPath, setCurrentPath] = useState('/admin');
  const [liveAttendanceSessionId, setLiveAttendanceSessionId] = useState<string | null>(null);

  const renderContent = () => {
    // Show live attendance page if active
    if (liveAttendanceSessionId) {
      return (
        <LiveAttendance
          sessionId={liveAttendanceSessionId}
          onBack={() => setLiveAttendanceSessionId(null)}
        />
      );
    }

    switch (currentPath) {
      case '/admin':
        return <AdminOverview onNavigate={setCurrentPath} />;
      case '/admin/classes':
        return <ClassManagement />;
      case '/admin/students':
        return <StudentManagement />;
      case '/admin/sessions':
        return <SessionManagement onNavigateToAttendance={(sessionId) => setLiveAttendanceSessionId(sessionId)} />;
      case '/admin/attendance':
        return <AttendanceManagement />;
      case '/admin/settings':
        return <AdminSettings />;
      default:
        return <AdminOverview onNavigate={setCurrentPath} />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      '/admin': 'Dashboard Overview',
      '/admin/classes': 'Class Management',
      '/admin/students': 'Student Management',
      '/admin/sessions': 'Session Management',
      '/admin/attendance': 'Attendance Management',
      '/admin/settings': 'Settings'
    };
    return titles[currentPath] || 'Dashboard';
  };

  // Hide sidebar and topbar when in live attendance mode
  if (liveAttendanceSessionId) {
    return renderContent();
  }

  return (
    <div className="flex h-screen bg-[#F7F9FC]">
      <Sidebar role="admin" currentPath={currentPath} onNavigate={setCurrentPath} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={getPageTitle()} />
        <main className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
