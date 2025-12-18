import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Users, Calendar, BookOpen, TrendingUp, ArrowRight } from 'lucide-react';
import { localDB, Session } from '../../lib/database';

interface Stats {
  totalStudents: number;
  totalClasses: number;
  totalSessions: number;
  liveSessions: number;
}

interface AdminOverviewProps {
  onNavigate?: (path: string) => void;
}

export function AdminOverview({ onNavigate }: AdminOverviewProps) {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalClasses: 0,
    totalSessions: 0,
    liveSessions: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [totalStudents, totalClasses, totalSessions, liveSessions] = await Promise.all([
        localDB.count('students'),
        localDB.count('classes'),
        localDB.count('sessions'),
        localDB.count('sessions', { eq: { status: 'live' } })
      ]);

      setStats({
        totalStudents,
        totalClasses,
        totalSessions,
        liveSessions
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const [recentSessions, setRecentSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchRecentSessions();
  }, []);

  const fetchRecentSessions = async () => {
    try {
      const sessions = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: false },
        limit: 5
      });
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Error fetching recent sessions:', error);
    }
  };

  const handleStatCardClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const handleQuickAction = (action: string) => {
    if (!onNavigate) return;
    
    switch (action) {
      case 'create-class':
        onNavigate('/admin/classes');
        // Small delay to ensure page loads before triggering modal
        setTimeout(() => {
          // The ClassManagement component will handle opening the modal
          // We can use a custom event or the component will auto-open on mount
        }, 100);
        break;
      case 'add-student':
        onNavigate('/admin/students');
        break;
      case 'start-session':
        onNavigate('/admin/sessions');
        break;
    }
  };

  const statCards = [
    { 
      title: 'Total Students', 
      value: stats.totalStudents, 
      icon: <Users className="text-[#0B6CF9]" size={24} />, 
      color: 'bg-blue-50',
      path: '/admin/students',
      clickable: true
    },
    { 
      title: 'Total Classes', 
      value: stats.totalClasses, 
      icon: <BookOpen className="text-[#16A34A]" size={24} />, 
      color: 'bg-green-50',
      path: '/admin/classes',
      clickable: true
    },
    { 
      title: 'Total Sessions', 
      value: stats.totalSessions, 
      icon: <Calendar className="text-[#F59E0B]" size={24} />, 
      color: 'bg-amber-50',
      path: '/admin/sessions',
      clickable: true
    },
    { 
      title: 'Live Sessions', 
      value: stats.liveSessions, 
      icon: <TrendingUp className="text-[#EF4444]" size={24} />, 
      color: 'bg-red-50',
      path: '/admin/sessions',
      clickable: true
    }
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card 
            key={index}
            className={stat.clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
            onClick={() => stat.clickable && handleStatCardClick(stat.path)}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-[#0F172A]">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.color}`}>
                {stat.icon}
              </div>
              {stat.clickable && (
                <ArrowRight className="ml-2 text-gray-400" size={20} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">No recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              Create New Class
            </button>
            <button className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              Add Student
            </button>
            <button className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              Start New Session
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
