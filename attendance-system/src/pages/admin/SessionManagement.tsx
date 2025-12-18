import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { localDB, Session, Class } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Play, Clock, Calendar, ExternalLink, Eye, Trash2, Users, CheckCircle, Download, Upload } from 'lucide-react';
import { Attendance, Student } from '../../lib/database';
import { exportSessionAttendance } from '../../utils/csvExport';

interface SessionManagementProps {
  onNavigateToAttendance?: (sessionId: string) => void;
}

type TabFilter = 'ongoing' | 'past';

export function SessionManagement({ onNavigateToAttendance }: SessionManagementProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('ongoing');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<{
    class: Class | null;
    attendanceCount: number;
    totalStudents: number;
    attendanceRecords: Array<Attendance & { student: Student | null }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [uploadingMarks, setUploadingMarks] = useState<string | null>(null);
  const marksFileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const { showToast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    class_id: '',
    start_at: '',
    duration_minutes: 60,
    notes: ''
  });

  useEffect(() => {
    fetchSessions();
    fetchClasses();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: false }
      });
      setSessions(data);
    } catch (error: any) {
      showToast(error.message || 'Error fetching sessions', 'error');
    }
  };

  const fetchClasses = async () => {
    try {
      const data = await localDB.select<Class>('classes', {
        orderBy: { column: 'branch_name', ascending: true }
      });
      setClasses(data);
    } catch (error: any) {
      showToast(error.message || 'Error fetching classes', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error('User not authenticated');
      const sessionData = {
        ...formData,
        status: 'upcoming' as const,
        created_at: new Date().toISOString(),
        created_by: user.id
      };
      await localDB.insert('sessions', sessionData);

      showToast('Session created successfully', 'success');
      setIsModalOpen(false);
      setFormData({ title: '', class_id: '', start_at: '', duration_minutes: 60, notes: '' });
      fetchSessions();
    } catch (error: any) {
      showToast(error.message || 'Error creating session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge variant="success">Live</Badge>;
      case 'upcoming':
        return <Badge variant="info">Upcoming</Badge>;
      case 'ended':
        return <Badge variant="default">Ended</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFilteredSessions = () => {
    let filtered: Session[] = [];
    
    // Filter by tab (status)
    switch (activeTab) {
      case 'ongoing':
        filtered = sessions.filter(s => s.status === 'live' || s.status === 'upcoming');
        break;
      case 'past':
        filtered = sessions.filter(s => s.status === 'ended');
        break;
    }
    
    // Apply search filter (only for past sessions)
    if (activeTab === 'past' && searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        (s.notes && s.notes.toLowerCase().includes(query))
      );
    }
    
    // Apply class filter (only for past sessions)
    if (activeTab === 'past' && selectedClassFilter) {
      filtered = filtered.filter(s => s.class_id === selectedClassFilter);
    }
    
    return filtered;
  };

  const filteredSessions = getFilteredSessions();

  const handleViewDetails = async (session: Session) => {
    setViewingSession(session);
    setIsViewModalOpen(true);
    setLoadingDetails(true);

    try {
      // Load class details
      const classData = await localDB.selectSingle<Class>('classes', {
        eq: { id: session.class_id }
      });

      // Load attendance records
      const attendanceRecords = await localDB.select<Attendance>('attendance', {
        eq: { session_id: session.id }
      });

      // Load student details for each attendance record
      const attendanceWithStudents = await Promise.all(
        attendanceRecords.map(async (record) => {
          const student = await localDB.selectSingle<Student>('students', {
            eq: { id: record.student_id }
          });
          return { ...record, student };
        })
      );

      // Get total students in class
      const classStudents = await localDB.select('classStudents', {
        eq: { class_id: session.class_id }
      });
      const totalStudents = classStudents.length;

      setSessionDetails({
        class: classData,
        attendanceCount: attendanceRecords.length,
        totalStudents,
        attendanceRecords: attendanceWithStudents
      });
    } catch (error: any) {
      showToast(error.message || 'Error loading session details', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDownloadAttendanceWithMarks = async (session: Session) => {
    try {
      const [attendance, students] = await Promise.all([
        localDB.select<Attendance>('attendance', { eq: { session_id: session.id } }),
        localDB.select<Student>('students', {})
      ]);
      
      await exportSessionAttendance(session.id, attendance, students, true);
      showToast('Attendance list with marks downloaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error downloading attendance', 'error');
    }
  };

  // Helper function to parse CSV line properly (handles quoted fields with commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const handleUploadMarks = async (session: Session, file: File) => {
    try {
      setUploadingMarks(session.id);
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }
      
      // Parse CSV header using proper CSV parsing
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
      console.log('📊 CSV Headers:', headers);
      
      const usnIndex = headers.findIndex(h => h.toLowerCase() === 'usn');
      const marksIndex = headers.findIndex(h => h.toLowerCase().includes('marks'));
      
      if (usnIndex === -1) {
        throw new Error(`CSV must contain a USN column. Found columns: ${headers.join(', ')}`);
      }
      if (marksIndex === -1) {
        throw new Error(`CSV must contain a Marks column. Found columns: ${headers.join(', ')}`);
      }
      
      // Get all students and attendance for this session
      const [allStudents, attendanceRecords] = await Promise.all([
        localDB.select<Student>('students', {}),
        localDB.select<Attendance>('attendance', { eq: { session_id: session.id } })
      ]);
      
      console.log('📊 Session attendance records:', {
        sessionId: session.id,
        attendanceCount: attendanceRecords.length,
        studentIds: attendanceRecords.map(a => a.student_id)
      });
      
      // Create maps for lookup
      const studentMap = new Map(allStudents.map(s => [s.usn.toLowerCase().trim(), s]));
      
      // Handle multiple students with same USN - create a map that stores arrays
      const studentMapMultiple = new Map<string, Student[]>();
      allStudents.forEach(s => {
        const usnKey = s.usn.toLowerCase().trim();
        if (!studentMapMultiple.has(usnKey)) {
          studentMapMultiple.set(usnKey, []);
        }
        studentMapMultiple.get(usnKey)!.push(s);
      });
      
      // Create attendance map by student_id
      const attendanceMap = new Map(attendanceRecords.map(a => [a.student_id, a]));
      
      // Also create a map by USN for easier lookup
      const attendanceByUSN = new Map<string, Attendance>();
      attendanceRecords.forEach(att => {
        const student = allStudents.find(s => s.id === att.student_id);
        if (student) {
          attendanceByUSN.set(student.usn.toLowerCase().trim(), att);
        }
      });
      
      // Also create a map by student name for fallback
      const studentByNameMap = new Map(allStudents.map(s => [s.name.toLowerCase().trim(), s]));
      
      let updatedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
        
        if (values.length <= Math.max(usnIndex, marksIndex)) {
          console.warn(`Row ${i + 1}: Not enough columns`);
          continue;
        }
        
        const usn = values[usnIndex]?.toLowerCase().trim();
        const marksStr = values[marksIndex]?.trim();
        
        if (!usn || !marksStr || marksStr === '') {
          console.warn(`Row ${i + 1}: Missing USN or marks`);
          continue;
        }
        
        // Find student by USN
        let student = studentMap.get(usn);
        
        // If multiple students with same USN, find the one with attendance
        if (!student) {
          const studentsWithUSN = studentMapMultiple.get(usn);
          if (studentsWithUSN && studentsWithUSN.length > 0) {
            // Find the student that has attendance for this session
            student = studentsWithUSN.find(s => attendanceMap.has(s.id)) || studentsWithUSN[0];
          }
        }
        
        // If not found, try to find by name (fallback)
        if (!student && values[0]) {
          const name = values[0].toLowerCase().trim();
          student = studentByNameMap.get(name);
        }
        
        if (!student) {
          const errorMsg = `Row ${i + 1}: Student with USN "${usn}" not found`;
          console.warn(errorMsg);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }
        
        // Find attendance record - try multiple methods
        let attendance = attendanceMap.get(student.id);
        
        // If not found by student_id, try by USN
        if (!attendance) {
          attendance = attendanceByUSN.get(usn);
        }
        
        // If still not found, search all attendance records for this student
        if (!attendance) {
          attendance = attendanceRecords.find(a => a.student_id === student!.id);
          if (attendance) {
            attendanceMap.set(student.id, attendance);
            attendanceByUSN.set(usn, attendance);
          }
        }
        
        if (!attendance) {
          const errorMsg = `Row ${i + 1}: No attendance record found for student ${student.name} (USN: ${usn}, ID: ${student.id})`;
          console.warn(errorMsg);
          console.warn('Available attendance student IDs:', Array.from(attendanceMap.keys()));
          console.warn('Available attendance USNs:', Array.from(attendanceByUSN.keys()));
          console.warn('All students with this USN:', studentMapMultiple.get(usn)?.map(s => ({ id: s.id, name: s.name })));
          errors.push(errorMsg);
          errorCount++;
          continue;
        }
        
        const marks = parseFloat(marksStr);
        if (isNaN(marks) || marks < 0 || marks > 100) {
          const errorMsg = `Row ${i + 1}: Invalid marks value "${marksStr}" for student ${student.name}. Must be a number between 0-100.`;
          console.warn(errorMsg);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }
        
        // Update attendance record with marks
        await localDB.update<Attendance>('attendance', { eq: { id: attendance.id } }, {
          marks: Math.round(marks)
        });
        
        console.log(`✅ Updated marks for ${student.name} (USN: ${usn}): ${Math.round(marks)}`);
        updatedCount++;
      }
      
      if (updatedCount > 0) {
        const message = `Marks updated successfully for ${updatedCount} student(s)${errorCount > 0 ? `. ${errorCount} error(s) occurred.` : ''}`;
        showToast(message, 'success');
        if (errors.length > 0) {
          console.error('Upload errors:', errors);
        }
        fetchSessions();
        if (viewingSession?.id === session.id) {
          handleViewDetails(session);
        }
      } else {
        const errorDetails = errors.length > 0 ? `\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}` : '';
        showToast(`No marks were updated. Please check the CSV format.${errorDetails}`, 'warning');
      }
    } catch (error: any) {
      console.error('Error uploading marks:', error);
      showToast(error.message || 'Error uploading marks', 'error');
    } finally {
      setUploadingMarks(null);
      // Reset file input
      const input = marksFileInputRefs.current.get(session.id);
      if (input) {
        input.value = '';
      }
    }
  };

  const handleDelete = async (session: Session) => {
    try {
      // Confirm deletion
      if (!confirm(`Are you sure you want to delete the session "${session.title}"? This action cannot be undone.`)) {
        return;
      }

      // Delete associated attendance records first
      const attendanceRecords = await localDB.select<Attendance>('attendance', {
        eq: { session_id: session.id }
      });

      // Delete all attendance records for this session
      for (const record of attendanceRecords) {
        await localDB.delete('attendance', { eq: { id: record.id } });
      }

      // Delete session
      await localDB.delete('sessions', { eq: { id: session.id } });
      showToast('Session deleted successfully', 'success');
      fetchSessions();
    } catch (error: any) {
      showToast(error.message || 'Error deleting session', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F172A]">Sessions</h2>
          <p className="text-sm text-gray-500 mt-1">Manage attendance sessions</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus size={18} />
          Create Session
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('ongoing')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'ongoing'
              ? 'border-[#0B6CF9] text-[#0B6CF9]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Ongoing ({sessions.filter(s => s.status === 'live' || s.status === 'upcoming').length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'past'
              ? 'border-[#0B6CF9] text-[#0B6CF9]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Past ({sessions.filter(s => s.status === 'ended').length})
        </button>
      </div>

      {/* Search and Filter (only for Past tab) */}
      {activeTab === 'past' && (
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              label="Search Sessions"
              placeholder="Search by title or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-64">
            <Select
              label="Filter by Class"
              options={[
                { value: '', label: 'All Classes' },
                ...classes.map(c => ({ value: c.id, label: `${c.branch_name} - ${c.section_name}` }))
              ]}
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
            />
          </div>
        </div>
      )}

      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">
              {activeTab === 'ongoing'
                ? 'No ongoing sessions.'
                : searchQuery || selectedClassFilter
                ? 'No sessions found matching your search/filter criteria.'
                : 'No past sessions.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{session.title}</CardTitle>
                  {getStatusBadge(session.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} />
                  {new Date(session.start_at).toLocaleDateString()} at {new Date(session.start_at).toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock size={16} />
                  Duration: {session.duration_minutes} minutes
                </div>
                {session.notes && (
                  <p className="text-sm text-gray-600">{session.notes}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {session.status === 'live' || session.status === 'upcoming' ? (
                    <Button
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => onNavigateToAttendance?.(session.id)}
                    >
                      <ExternalLink size={16} />
                      Attendance Link
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleViewDetails(session)}
                    className="flex items-center gap-2"
                  >
                    <Eye size={16} />
                    View
                  </Button>
                  {session.status === 'ended' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadAttendanceWithMarks(session)}
                        className="flex items-center gap-2"
                      >
                        <Download size={16} />
                        Download with Marks
                      </Button>
                      <div className="relative">
                        <input
                          ref={(el) => {
                            if (el) {
                              marksFileInputRefs.current.set(session.id, el);
                            } else {
                              marksFileInputRefs.current.delete(session.id);
                            }
                          }}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUploadMarks(session, file);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => marksFileInputRefs.current.get(session.id)?.click()}
                          disabled={uploadingMarks === session.id}
                          className="flex items-center gap-2"
                        >
                          <Upload size={16} />
                          {uploadingMarks === session.id ? 'Uploading...' : 'Upload Marks'}
                        </Button>
                      </div>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDelete(session)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Delete
                  </Button>
                  {session.status === 'live' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (!confirm('End this session?')) return;
                        try {
                          await localDB.update<Session>('sessions', { eq: { id: session.id } }, {
                            status: 'ended',
                            ended_at: new Date().toISOString()
                          });
                          showToast('Session ended successfully', 'success');
                          fetchSessions();
                        } catch (error: any) {
                          showToast(error.message || 'Error ending session', 'error');
                        }
                      }}
                    >
                      End Session
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Session"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Session Title"
            placeholder="e.g., Math - Semester A"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <Select
            label="Class"
            options={classes.map(c => ({ value: c.id, label: `${c.branch_name} - ${c.section_name}` }))}
            value={formData.class_id}
            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            required
          />
          <Input
            label="Start Date & Time"
            type="datetime-local"
            value={formData.start_at}
            onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
            required
          />
          <Input
            label="Duration (minutes)"
            type="number"
            min="15"
            value={formData.duration_minutes}
            onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
            required
          />
          <Input
            label="Notes (Optional)"
            placeholder="Session notes or instructions"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingSession(null);
          setSessionDetails(null);
        }}
        title="Session Details"
        size="lg"
      >
        {loadingDetails ? (
          <div className="py-8 text-center">
            <div className="w-8 h-8 border-4 border-[#0B6CF9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading session details...</p>
          </div>
        ) : viewingSession && sessionDetails ? (
          <div className="space-y-6">
            {/* Session Info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">{viewingSession.title}</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(viewingSession.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-500">Start Time</p>
                    <p className="font-medium">
                      {new Date(viewingSession.start_at).toLocaleDateString()} at{' '}
                      {new Date(viewingSession.start_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="font-medium">{viewingSession.duration_minutes} minutes</p>
                  </div>
                </div>
                {viewingSession.ended_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Ended At</p>
                      <p className="font-medium">
                        {new Date(viewingSession.ended_at).toLocaleDateString()} at{' '}
                        {new Date(viewingSession.ended_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {viewingSession.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{viewingSession.notes}</p>
                </div>
              )}
            </div>

            {/* Class Info */}
            {sessionDetails.class && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-[#0F172A] mb-3">Class Information</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-500">Branch:</span>{' '}
                    <span className="font-medium">{sessionDetails.class.branch_name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">Section:</span>{' '}
                    <span className="font-medium">{sessionDetails.class.section_name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">Academic Year:</span>{' '}
                    <span className="font-medium">{sessionDetails.class.academic_year}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Attendance Stats */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-[#0F172A] mb-3">Attendance Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={20} className="text-blue-600" />
                    <p className="text-sm text-gray-600">Total Students</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{sessionDetails.totalStudents}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle size={20} className="text-green-600" />
                    <p className="text-sm text-gray-600">Present</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{sessionDetails.attendanceCount}</p>
                </div>
              </div>
              {sessionDetails.totalStudents > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Attendance Rate: {((sessionDetails.attendanceCount / sessionDetails.totalStudents) * 100).toFixed(1)}%
                </p>
              )}
            </div>

            {/* Attendance List */}
            {sessionDetails.attendanceRecords.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-[#0F172A] mb-3">
                  Attendance Records ({sessionDetails.attendanceRecords.length})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {sessionDetails.attendanceRecords.map((record) => (
                    <div
                      key={record.id}
                      className="bg-gray-50 p-3 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {record.student?.name || 'Unknown Student'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {record.student?.usn || 'N/A'} • {new Date(record.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={record.method === 'face' ? 'success' : 'default'}>
                          {record.method === 'face' ? 'Face' : 'Manual'}
                        </Badge>
                        {record.confidence && (
                          <span className="text-xs text-gray-500">
                            {(record.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingSession(null);
                  setSessionDetails(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
              {viewingSession && (
                <Button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    onNavigateToAttendance?.(viewingSession.id);
                  }}
                  className="flex-1 flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  Open Attendance
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p>No session details available</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
