import { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  GraduationCap,
  BookOpen,
  Award
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
  active?: boolean;
}

interface SidebarProps {
  role: 'admin' | 'student';
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Sidebar({ role, currentPath, onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();

  const adminNavItems: NavItem[] = [
    { label: 'Overview', icon: <LayoutDashboard size={20} />, path: '/admin' },
    { label: 'Classes', icon: <BookOpen size={20} />, path: '/admin/classes' },
    { label: 'Students', icon: <Users size={20} />, path: '/admin/students' },
    { label: 'Sessions', icon: <Calendar size={20} />, path: '/admin/sessions' },
    { label: 'Attendance', icon: <ClipboardList size={20} />, path: '/admin/attendance' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/admin/settings' }
  ];

  const studentNavItems: NavItem[] = [
    { label: 'Overview', icon: <LayoutDashboard size={20} />, path: '/user' },
    { label: 'Profile', icon: <Users size={20} />, path: '/user/profile' },
    { label: 'Sessions', icon: <Calendar size={20} />, path: '/user/sessions' },
    { label: 'Attendance Status', icon: <ClipboardList size={20} />, path: '/user/attendance-status' },
    { label: 'Marks', icon: <Award size={20} />, path: '/user/marks' },
    { label: 'Hall Ticket', icon: <GraduationCap size={20} />, path: '/user/hallticket' }
  ];

  const navItems = role === 'admin' ? adminNavItems : studentNavItems;

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-[#0B6CF9]">FaceXam</h1>
        <p className="text-xs text-gray-500 mt-1">Attendance System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const isActive = currentPath === item.path || (item.path !== '/admin' && item.path !== '/user' && currentPath.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#0B6CF9] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#0B6CF9] flex items-center justify-center text-white font-semibold">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
            <p className="text-xs text-gray-500 capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}
