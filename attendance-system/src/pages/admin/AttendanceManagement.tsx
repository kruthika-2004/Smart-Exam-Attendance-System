import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { localDB, Session, Attendance, Student, ClassStudent } from '../../lib/database';
import { exportSessionAttendance } from '../../utils/csvExport';
import { loadFaceApiModels, findBestMatch, compareDescriptors } from '../../utils/faceRecognition';
import { generateUUID } from '../../utils/uuid';
import { useAuth } from '../../contexts/AuthContext';
import * as faceapi from 'face-api.js';
import { Camera, Users, Download, Upload, Image as ImageIcon } from 'lucide-react';

type AttendanceWithStudent = Attendance & {
  students: Student;
};

type StudentAttendanceStatus = {
  student: Student;
  attendance?: Attendance;
  status: 'present' | 'absent';
};

export function AttendanceManagement() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [attendance, setAttendance] = useState<AttendanceWithStudent[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<StudentAttendanceStatus[]>([]);
  const [processingImage, setProcessingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchAttendance(selectedSession);
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const data = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: false }
      });
      setSessions(data);
      if (data && data.length > 0) {
        setSelectedSession(data[0].id);
      }
    } catch (error: any) {
      showToast(error.message || 'Error fetching sessions', 'error');
    }
  };

  const fetchAttendance = async (sessionId: string) => {
    try {
      // Get the session to find the class
      const session = await localDB.selectSingle<Session>('sessions', {
        eq: { id: sessionId }
      });
      
      if (!session) {
        showToast('Session not found', 'error');
        return;
      }

      // Get all students in the class
      const classStudents = await localDB.select<ClassStudent>('classStudents', {
        eq: { class_id: session.class_id }
      });
      
      // Get all attendance records for this session
      const attendanceRecords = await localDB.select<Attendance>('attendance', {
        eq: { session_id: sessionId },
        orderBy: { column: 'timestamp', ascending: false }
      });
      
      // Create a map of student_id -> attendance record
      const attendanceMap = new Map<string, Attendance>();
      attendanceRecords.forEach(record => {
        attendanceMap.set(record.student_id, record);
      });
      
      // Fetch all students and create status list
      const allStudents = await Promise.all(
        classStudents.map(async (cs) => {
          const student = await localDB.selectSingle<Student>('students', {
            eq: { id: cs.student_id }
          });
          return student;
        })
      );
      
      // Create student status list
      const statuses: StudentAttendanceStatus[] = allStudents
        .filter(s => s !== null)
        .map(student => ({
          student: student!,
          attendance: attendanceMap.get(student!.id),
          status: attendanceMap.has(student!.id) ? 'present' : 'absent'
        }))
        .sort((a, b) => a.student.name.localeCompare(b.student.name));
      
      setStudentStatuses(statuses);
      
      // Also keep the old attendance list for export
      const attendanceWithStudents = await Promise.all(
        attendanceRecords.map(async (record) => {
          const student = await localDB.selectSingle<Student>('students', {
            eq: { id: record.student_id }
          });
          return {
            ...record,
            students: student!
          };
        })
      );
      
      setAttendance(attendanceWithStudents);
    } catch (error: any) {
      showToast(error.message || 'Error fetching attendance', 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentSession) {
      showToast('Please select a session first', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    setProcessingImage(true);
    
    try {
      // Show preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Load face-api models
      showToast('Loading face recognition models...', 'info');
      await loadFaceApiModels();

      // Create image element
      const img = await faceapi.fetchImage(URL.createObjectURL(file));
      
      showToast('Detecting faces in image...', 'info');

      // Detect all faces in the image
      const detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        showToast('No faces detected in the image', 'warning');
        setProcessingImage(false);
        return;
      }

      showToast(`Found ${detections.length} face(s). Matching with students...`, 'info');

      // Get session and class students
      const session = await localDB.selectSingle<Session>('sessions', {
        eq: { id: currentSession.id }
      });

      if (!session) {
        showToast('Session not found', 'error');
        setProcessingImage(false);
        return;
      }

      // Get all students in the class
      const classStudents = await localDB.select<ClassStudent>('classStudents', {
        eq: { class_id: session.class_id }
      });

      const studentIds = classStudents.map(cs => cs.student_id);
      const students = await Promise.all(
        studentIds.map(async (id) => {
          return await localDB.selectSingle<Student>('students', { eq: { id } });
        })
      );

      // Filter students with descriptors
      const studentsWithDescriptors = students
        .filter(s => s !== null && s.descriptor && s.descriptor.length > 0)
        .map(s => ({
          student: s!,
          descriptor: new Float32Array(s!.descriptor!)
        }));

      if (studentsWithDescriptors.length === 0) {
        showToast('No students with face descriptors found. Please compute descriptors first.', 'warning');
        setProcessingImage(false);
        return;
      }

      // Get existing attendance to avoid duplicates
      const existingAttendance = await localDB.select<Attendance>('attendance', {
        eq: { session_id: currentSession.id }
      });
      const markedStudentIds = new Set(existingAttendance.map(a => a.student_id));

      // Match each detected face with students
      let markedCount = 0;
      let alreadyMarkedCount = 0;
      const markedStudents: string[] = [];

      for (const detection of detections) {
        if (!detection.descriptor) continue;

        // Find best match
        const studentDescriptors = studentsWithDescriptors.map(s => ({
          studentId: s.student.id,
          descriptor: s.descriptor
        }));

        const match = findBestMatch(detection.descriptor, studentDescriptors, 0.65);

        if (match && match.confidence >= 0.65) {
          const student = studentsWithDescriptors.find(s => s.student.id === match.studentId)?.student;
          
          if (student) {
            // Check if already marked
            if (markedStudentIds.has(student.id)) {
              alreadyMarkedCount++;
              continue;
            }

            // Mark attendance
            const attendanceRecord: Attendance = {
              id: generateUUID(),
              session_id: currentSession.id,
              student_id: student.id,
              timestamp: new Date().toISOString(),
              method: 'face',
              confidence: match.confidence,
              marked_by: user?.id || 'system',
              created_at: new Date().toISOString()
            };

            await localDB.insert('attendance', attendanceRecord);
            markedStudentIds.add(student.id);
            markedStudents.push(student.name);
            markedCount++;
          }
        }
      }

      // Refresh attendance data
      await fetchAttendance(currentSession.id);

      // Show results
      if (markedCount > 0) {
        showToast(
          `Marked attendance for ${markedCount} student(s): ${markedStudents.join(', ')}`,
          'success'
        );
      } else if (alreadyMarkedCount > 0) {
        showToast(
          `All detected students are already marked (${alreadyMarkedCount} face(s))`,
          'info'
        );
      } else {
        showToast(
          'No matching students found. Please ensure students have computed face descriptors.',
          'warning'
        );
      }

      // Clear preview after a delay
      setTimeout(() => {
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);

    } catch (error: any) {
      console.error('Error processing image:', error);
      showToast(error.message || 'Error processing image. Please try again.', 'error');
    } finally {
      setProcessingImage(false);
    }
  };

  const currentSession = sessions.find(s => s.id === selectedSession);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Attendance Management</h2>
        <p className="text-sm text-gray-500 mt-1">View and manage session attendance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Sessions</h3>
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedSession === session.id
                      ? 'bg-[#0B6CF9] text-white'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{session.title}</span>
                    {session.status === 'live' && (
                      <Badge variant="success">Live</Badge>
                    )}
                  </div>
                  <span className="text-xs opacity-80">
                    {new Date(session.start_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {currentSession ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">{currentSession.title}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(currentSession.start_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#0B6CF9]">
                      {studentStatuses.filter(s => s.status === 'present').length} / {studentStatuses.length}
                    </p>
                    <p className="text-sm text-gray-500">Present</p>
                  </div>
                </div>

                {imagePreview && (
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <ImageIcon size={20} className="text-gray-600" />
                      <span className="font-medium text-gray-700">Uploaded Image Preview</span>
                    </div>
                    <img 
                      src={imagePreview} 
                      alt="Upload preview" 
                      className="max-w-full max-h-64 rounded border border-gray-300"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between mb-6">
                  {currentSession.status === 'live' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                      <Camera className="text-[#0B6CF9]" size={24} />
                      <div>
                        <p className="font-medium text-[#0B6CF9]">Live Session Active</p>
                        <p className="text-sm text-gray-600">Face recognition is currently running</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processingImage || !currentSession}
                      className="flex items-center gap-2"
                    >
                      <Upload size={18} />
                      {processingImage ? 'Processing...' : 'Upload Photo'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const allStudents = await localDB.select<Student>('students');
                          await exportSessionAttendance(currentSession.id, attendance.map(a => a as Attendance), allStudents);
                          showToast('Attendance exported successfully', 'success');
                        } catch (error: any) {
                          showToast(error.message || 'Error exporting attendance', 'error');
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download size={18} />
                      Export CSV
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>USN</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Marked At</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentStatuses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          <Users size={48} className="mx-auto mb-2 text-gray-300" />
                          <p>No students in this class</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      studentStatuses.map((status) => (
                        <TableRow key={status.student.id}>
                          <TableCell className="font-medium">{status.student.name}</TableCell>
                          <TableCell className="font-mono text-xs">{status.student.usn}</TableCell>
                          <TableCell>
                            <Badge variant={status.status === 'present' ? 'success' : 'default'}>
                              {status.status === 'present' ? 'Present' : 'Absent'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {status.attendance 
                              ? new Date(status.attendance.timestamp).toLocaleString()
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {status.attendance ? (
                              <Badge variant={status.attendance.method === 'face' ? 'success' : 'info'}>
                                {status.attendance.method}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {status.attendance?.confidence 
                              ? `${(status.attendance.confidence * 100).toFixed(1)}%` 
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Select a session to view attendance</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
