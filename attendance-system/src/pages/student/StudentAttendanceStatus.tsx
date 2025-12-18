import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { localDB, Session, Attendance } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle } from 'lucide-react';

type SessionWithAttendance = Session & {
  attendance: { timestamp: string; method: string }[];
};

export function StudentAttendanceStatus() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);

  useEffect(() => {
    if (user) {
      fetchAttendanceStatus();
    }
  }, [user]);

  const fetchAttendanceStatus = async () => {
    try {
      if (!user) {
        console.error('No user found');
        return;
      }
      
      console.log('🔍 Looking up student for user:', {
        userId: user.id,
        userEmail: user.email
      });
      
      // Try to find student by user_id first
      let studentData = await localDB.selectSingle<{ id: string; name: string; email: string; user_id?: string }>('students', {
        eq: { user_id: user.id }
      });

      console.log('🔍 Student lookup by user_id:', studentData ? { id: studentData.id, name: studentData.name } : 'NOT FOUND');

      // If not found, try by email as fallback
      if (!studentData) {
        studentData = await localDB.selectSingle<{ id: string; name: string; email: string; user_id?: string }>('students', {
          eq: { email: user.email }
        });
        console.log('🔍 Student lookup by email:', studentData ? { id: studentData.id, name: studentData.name } : 'NOT FOUND');
      }

      if (!studentData) {
        console.error('❌ Student not found for user:', {
          userId: user.id,
          userEmail: user.email
        });
        
        // Try to list all students to see what's available
        const allStudents = await localDB.select<{ id: string; name: string; email: string; user_id?: string }>('students', {});
        console.log('📋 All students in database:', allStudents.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email,
          user_id: s.user_id
        })));
        return;
      }

      console.log('✅ Found student:', {
        id: studentData.id,
        name: studentData.name,
        email: studentData.email,
        user_id: studentData.user_id
      });

      const allSessions = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: false }
      });

      console.log('📋 Total sessions:', allSessions.length);
      console.log('📋 All sessions:', allSessions.map(s => ({
        id: s.id,
        title: s.title,
        start_at: s.start_at
      })));

      // Get all attendance records and filter by student_id (more reliable than indexed query)
      const allAttendance = await localDB.select<Attendance>('attendance', {});
      console.log(`📊 Total attendance records in database: ${allAttendance.length}`);
      console.log('📊 ALL attendance records (checking student_id values):', JSON.stringify(allAttendance.map(a => ({
        id: a.id,
        student_id: a.student_id,
        session_id: a.session_id,
        timestamp: a.timestamp,
        method: a.method
      })), null, 2));
      
      // Also check all students to see if there are multiple students with same email
      const allStudents = await localDB.select<Student>('students', {});
      const studentsWithSameEmail = allStudents.filter(s => s.email === user.email);
      console.log(`📊 Students with email ${user.email}:`, studentsWithSameEmail.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        user_id: s.user_id
      })));
      
      if (studentsWithSameEmail.length > 1) {
        console.warn('⚠️ Multiple students found with same email!');
      }
      
      // Check attendance records for all students with this email
      // Find which student has attendance records
      let actualStudentData = studentData!;
      let allStudentAttendance: Attendance[] = [];
      let maxAttendanceCount = 0;
      
      for (const student of studentsWithSameEmail) {
        const studentAttendance = allAttendance.filter(a => a.student_id === student.id);
        console.log(`📊 Attendance for student ${student.id} (${student.name}):`, studentAttendance.length);
        if (studentAttendance.length > 0) {
          console.log('📊 Found attendance for student:', {
            studentId: student.id,
            studentName: student.name,
            attendanceCount: studentAttendance.length,
            records: studentAttendance.map(a => ({
              session_id: a.session_id,
              timestamp: a.timestamp
            }))
          });
          
          // Use the student that has the most attendance records
          if (studentAttendance.length > maxAttendanceCount) {
            console.log(`✅ Using student ${student.id} (${student.name}) because they have ${studentAttendance.length} attendance records`);
            actualStudentData = { id: student.id, name: student.name, email: student.email, user_id: student.user_id };
            allStudentAttendance = studentAttendance;
            maxAttendanceCount = studentAttendance.length;
          }
        }
      }
      
      // If no attendance found for any student with this email, filter by original student
      if (allStudentAttendance.length === 0) {
        allStudentAttendance = allAttendance.filter(a => a.student_id === actualStudentData.id);
        console.log(`📊 No attendance found for any student with email ${user.email}. Using original student ${actualStudentData.id}`);
      }
      
      console.log(`📊 Final: Using student ${actualStudentData.id} (${actualStudentData.name}) with ${allStudentAttendance.length} attendance records`);
      console.log('📊 Final matching attendance records:', allStudentAttendance.map(a => ({
        id: a.id,
        student_id: a.student_id,
        session_id: a.session_id,
        timestamp: a.timestamp,
        method: a.method
      })));

      // Create a map of session_id -> attendance records for quick lookup
      const attendanceBySession = new Map<string, Attendance[]>();
      allStudentAttendance.forEach(record => {
        if (!attendanceBySession.has(record.session_id)) {
          attendanceBySession.set(record.session_id, []);
        }
        attendanceBySession.get(record.session_id)!.push(record);
      });

      // Fetch attendance for each session
      const sessionsWithAttendance = allSessions.map((session) => {
        const attendance = attendanceBySession.get(session.id) || [];
        
        console.log(`Session ${session.title} (${session.id}):`, {
          studentId: studentData!.id,
          sessionId: session.id,
          attendanceCount: attendance.length,
          attendanceRecords: attendance.map(a => ({
            id: a.id,
            student_id: a.student_id,
            session_id: a.session_id,
            timestamp: a.timestamp
          }))
        });
        
        return {
          ...session,
          attendance: attendance.map(a => ({ timestamp: a.timestamp, method: a.method }))
        };
      });

      console.log('Sessions with attendance:', sessionsWithAttendance.map(s => ({
        title: s.title,
        hasAttendance: s.attendance.length > 0
      })));

      setSessions(sessionsWithAttendance);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Attendance Status</h2>
        <p className="text-sm text-gray-500 mt-1">View your attendance history</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Marked At</TableHead>
              <TableHead>Method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No attendance records found
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const attended = session.attendance && session.attendance.length > 0;
                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.title}</TableCell>
                    <TableCell>{new Date(session.start_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {attended ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-[#16A34A]" />
                          <Badge variant="success">Present</Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle size={16} className="text-[#EF4444]" />
                          <Badge variant="danger">Absent</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {attended ? new Date(session.attendance[0].timestamp).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      {attended ? (
                        <Badge variant={session.attendance[0].method === 'face' ? 'success' : 'info'}>
                          {session.attendance[0].method}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
