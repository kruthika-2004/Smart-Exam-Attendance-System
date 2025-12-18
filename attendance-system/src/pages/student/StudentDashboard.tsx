import { useState } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopBar } from '../../components/layout/TopBar';
import { StudentOverview } from './StudentOverview';
import { StudentProfile } from './StudentProfile';
import { StudentSessions } from './StudentSessions';
import { StudentAttendanceStatus } from './StudentAttendanceStatus';
import { StudentMarks } from './StudentMarks';
import { HallTicketGenerator } from './HallTicketGenerator';

export function StudentDashboard() {
  const [currentPath, setCurrentPath] = useState('/user');

  const renderContent = () => {
    switch (currentPath) {
      case '/user':
        return <StudentOverview />;
      case '/user/profile':
        return <StudentProfile />;
      case '/user/sessions':
        return <StudentSessions />;
      case '/user/attendance-status':
        return <StudentAttendanceStatus />;
      case '/user/marks':
        return <StudentMarks />;
      case '/user/hallticket':
        return <HallTicketGenerator />;
      default:
        return <StudentOverview />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      '/user': 'Dashboard',
      '/user/profile': 'My Profile',
      '/user/sessions': 'Sessions',
      '/user/attendance-status': 'Attendance Status',
      '/user/marks': 'Marks',
      '/user/hallticket': 'Hall Ticket'
    };
    return titles[currentPath] || 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-[#F7F9FC]">
      <Sidebar role="student" currentPath={currentPath} onNavigate={setCurrentPath} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={getPageTitle()} showSearch={false} showNewButton={false} />
        <main className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
