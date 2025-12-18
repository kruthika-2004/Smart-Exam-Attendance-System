import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { localDB, Student, Session, Attendance, Class } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Award } from 'lucide-react';

type SessionWithMarks = Session & {
  class?: Class;
  attendance?: Attendance;
  marks?: number;
};

export function StudentMarks() {
  const { user } = useAuth();
  const [sessionsWithMarks, setSessionsWithMarks] = useState<SessionWithMarks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMarks();
    }
  }, [user]);

  const fetchMarks = async () => {
    try {
      setLoading(true);
      if (!user) return;

      // Get student data with fallback
      let studentData = await localDB.selectSingle<Student>('students', {
        eq: { user_id: user.id }
      });

      if (!studentData) {
        studentData = await localDB.selectSingle<Student>('students', {
          eq: { email: user.email }
        });
      }

      if (!studentData) {
        console.error('Student not found');
        return;
      }

      // Get all students with same email (to handle multiple student records)
      const allStudents = await localDB.select<Student>('students', {});
      const studentsWithSameEmail = allStudents.filter(s => s.email === user.email);

      // Get all attendance records
      const allAttendance = await localDB.select<Attendance>('attendance', {});
      
      // Find which student has attendance records (use the one with most attendance)
      let actualStudentId = studentData.id;
      let studentAttendance: Attendance[] = [];
      let maxAttendanceCount = 0;
      
      for (const student of studentsWithSameEmail) {
        const attendance = allAttendance.filter(a => a.student_id === student.id);
        if (attendance.length > maxAttendanceCount) {
          actualStudentId = student.id;
          studentAttendance = attendance;
          maxAttendanceCount = attendance.length;
        }
      }
      
      // If no attendance found for any student, use original student
      if (studentAttendance.length === 0) {
        studentAttendance = allAttendance.filter(a => a.student_id === studentData.id);
      }

      console.log('📊 Marks - Student attendance:', {
        studentId: actualStudentId,
        attendanceCount: studentAttendance.length,
        records: studentAttendance.map(a => ({
          session_id: a.session_id,
          marks: a.marks,
          timestamp: a.timestamp
        }))
      });

      // Get all sessions (not just ended - include all sessions where student has attendance)
      const allSessions = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: false }
      });

      // Get unique session IDs from attendance records
      const attendedSessionIds = new Set(studentAttendance.map(a => a.session_id));
      
      // Filter sessions to only those where student has attendance
      const attendedSessions = allSessions.filter(s => attendedSessionIds.has(s.id));

      console.log('📊 Marks - Attended sessions:', {
        totalSessions: allSessions.length,
        attendedSessions: attendedSessions.length,
        sessionIds: Array.from(attendedSessionIds)
      });

      // Match attendance with sessions
      const sessionsWithData: SessionWithMarks[] = await Promise.all(
        attendedSessions.map(async (session) => {
          const attendance = studentAttendance.find(a => a.session_id === session.id);
          const classData = await localDB.selectSingle<Class>('classes', {
            eq: { id: session.class_id }
          });

          return {
            ...session,
            class: classData || undefined,
            attendance: attendance || undefined,
            marks: attendance?.marks
          };
        })
      );

      // Sort by date (most recent first)
      sessionsWithData.sort((a, b) => 
        new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
      );

      setSessionsWithMarks(sessionsWithData);
    } catch (error) {
      console.error('Error fetching marks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500">Loading marks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Marks</h2>
        <p className="text-sm text-gray-500 mt-1">View your marks for attended sessions</p>
      </div>

      {sessionsWithMarks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">No attended sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessionsWithMarks.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                      {session.class && (
                        <Badge variant="default">
                          {session.class.branch_name} - {session.class.section_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1">
                        <Calendar size={16} />
                        {new Date(session.start_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="text-[#0B6CF9]" size={20} />
                      <span className="text-sm font-medium text-gray-700">Marks:</span>
                      {session.marks !== undefined && session.marks !== null ? (
                        <span className="text-2xl font-bold text-[#0B6CF9]">{session.marks} / 100</span>
                      ) : (
                        <Badge variant="default" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          To be updated
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

