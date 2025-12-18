import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
import { localDB, Student, Session } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export function StudentOverview() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState({
    totalSessions: 0,
    attended: 0,
    attendancePercentage: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (user) {
      fetchStudentData();
      fetchStats();
      fetchUpcomingSessions();
    }
  }, [user]);

  const fetchStudentData = async () => {
    try {
      if (!user) return;
      const data = await localDB.selectSingle<Student>('students', {
        eq: { user_id: user.id }
      });
      setStudent(data);
    } catch (error) {
      console.error('Error fetching student data:', error);
    }
  };

  const fetchStats = async () => {
    try {
      if (!user) return;
      let studentData = await localDB.selectSingle<Student>('students', {
        eq: { user_id: user.id }
      });

      // Fallback: try by email if user_id lookup fails
      if (!studentData) {
        studentData = await localDB.selectSingle<Student>('students', {
          eq: { email: user.email }
        });
      }

      if (!studentData) {
        console.error('Student not found for user:', user.email);
        return;
      }

      // Get all classes this student belongs to
      const classStudents = await localDB.select('classStudents', {
        eq: { student_id: studentData.id }
      });
      
      console.log('📊 Class enrollment:', {
        studentId: studentData.id,
        enrolledClasses: classStudents.length,
        classIds: classStudents.map((cs: any) => cs.class_id)
      });
      
      const classIds = classStudents.map((cs: any) => cs.class_id);
      
      // Get all sessions
      const allSessions = await localDB.select<Session>('sessions', {});
      console.log('📊 All sessions:', allSessions.length);
      
      // If student is enrolled in classes, filter sessions by class
      // Otherwise, count all sessions (fallback)
      const studentSessions = classIds.length > 0 
        ? allSessions.filter(s => classIds.includes(s.class_id))
        : allSessions;
      
      console.log('📊 Student sessions:', {
        total: studentSessions.length,
        sessions: studentSessions.map(s => ({ id: s.id, title: s.title, class_id: s.class_id, status: s.status }))
      });
      
      // Count unique sessions where student has attendance
      const allAttendance = await localDB.select('attendance', {});
      
      // Check all students with same email to find the one with attendance records
      const allStudents = await localDB.select<Student>('students', {});
      const studentsWithSameEmail = allStudents.filter(s => s.email === user.email);
      
      // Find which student has attendance records
      let actualStudentId = studentData.id;
      let studentAttendance: any[] = [];
      let maxAttendanceCount = 0;
      
      for (const student of studentsWithSameEmail) {
        const attendance = allAttendance.filter((a: any) => a.student_id === student.id);
        if (attendance.length > maxAttendanceCount) {
          actualStudentId = student.id;
          studentAttendance = attendance;
          maxAttendanceCount = attendance.length;
        }
      }
      
      // If no attendance found for any student, use original student
      if (studentAttendance.length === 0) {
        studentAttendance = allAttendance.filter((a: any) => a.student_id === studentData.id);
      }
      
      console.log('📊 Attendance records:', {
        total: allAttendance.length,
        studentAttendance: studentAttendance.length,
        actualStudentId,
        originalStudentId: studentData.id,
        studentsWithSameEmail: studentsWithSameEmail.map(s => ({ id: s.id, name: s.name })),
        records: studentAttendance.map((a: any) => ({ 
          id: a.id, 
          session_id: a.session_id, 
          student_id: a.student_id,
          timestamp: a.timestamp 
        }))
      });
      
      // Count unique session_ids in attendance records
      const uniqueAttendedSessions = new Set(studentAttendance.map((a: any) => a.session_id));
      const attended = uniqueAttendedSessions.size;
      
      // Get session IDs from attendance records
      const attendedSessionIds = Array.from(uniqueAttendedSessions);
      
      // Total sessions should be:
      // 1. Sessions for classes the student is enrolled in, OR
      // 2. All sessions if student is not enrolled in any class, OR
      // 3. At minimum, all sessions where the student has attendance (to ensure total >= attended)
      const enrolledSessionIds = new Set(studentSessions.map(s => s.id));
      const attendedSessionSet = new Set(attendedSessionIds);
      
      // Combine: sessions from enrolled classes + sessions with attendance
      const allRelevantSessionIds = new Set([...enrolledSessionIds, ...attendedSessionSet]);
      
      // Get the actual session objects
      const relevantSessions = allSessions.filter(s => allRelevantSessionIds.has(s.id));
      const totalSessions = relevantSessions.length;

      const percentage = totalSessions > 0 ? (attended / totalSessions) * 100 : 0;

      console.log('📊 Final Attendance Stats:', {
        studentId: studentData.id,
        studentName: studentData.name,
        totalSessions,
        attended,
        percentage: Math.round(percentage),
        uniqueAttendedSessionIds: Array.from(uniqueAttendedSessions)
      });

      setStats({
        totalSessions,
        attended,
        attendancePercentage: Math.round(percentage)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUpcomingSessions = async () => {
    try {
      const allSessions = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: true }
      });
      
      const upcoming = allSessions
        .filter(s => s.status === 'upcoming' || s.status === 'live')
        .slice(0, 5);
      
      setUpcomingSessions(upcoming);
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Attendance Rate</p>
              <p className="text-3xl font-bold text-[#0B6CF9]">{stats.attendancePercentage}%</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <CheckCircle className="text-[#0B6CF9]" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sessions Attended</p>
              <p className="text-3xl font-bold text-[#16A34A]">{stats.attended}</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <Calendar className="text-[#16A34A]" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Sessions</p>
              <p className="text-3xl font-bold text-[#F59E0B]">{stats.totalSessions}</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <Clock className="text-[#F59E0B]" size={32} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming sessions</p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{session.title}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(session.start_at).toLocaleString()}
                    </p>
                  </div>
                  {session.status === 'live' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Live Now
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
