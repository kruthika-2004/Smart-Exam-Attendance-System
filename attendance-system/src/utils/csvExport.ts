import { Student, Attendance, Session, Class } from '../lib/database';

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportStudents(students: Student[]) {
  const exportData = students.map(student => ({
    Name: student.name,
    USN: student.usn,
    Email: student.email,
    Phone: student.phone || '',
    Branch: student.branch,
    Semester: student.semester,
    'Created At': new Date(student.created_at).toLocaleString()
  }));
  
  exportToCSV(exportData, `students_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportAttendance(attendance: Attendance[], students: Student[]) {
  const studentMap = new Map(students.map(s => [s.id, s]));
  
  const exportData = attendance.map(record => {
    const student = studentMap.get(record.student_id);
    return {
      'Student Name': student?.name || 'Unknown',
      USN: student?.usn || 'N/A',
      'Session ID': record.session_id,
      'Marked At': new Date(record.timestamp).toLocaleString(),
      Method: record.method,
      Confidence: record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A',
      'Marked By': record.marked_by
    };
  });
  
  exportToCSV(exportData, `attendance_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportSessions(sessions: Session[], classes: Class[]) {
  const classMap = new Map(classes.map(c => [c.id, c]));
  
  const exportData = sessions.map(session => {
    const classData = classMap.get(session.class_id);
    return {
      Title: session.title,
      Class: classData ? `${classData.branch_name} - ${classData.section_name}` : 'Unknown',
      'Start Time': new Date(session.start_at).toLocaleString(),
      'Duration (minutes)': session.duration_minutes,
      Status: session.status,
      Notes: session.notes || '',
      'Created At': new Date(session.created_at).toLocaleString()
    };
  });
  
  exportToCSV(exportData, `sessions_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportSessionAttendance(sessionId: string, attendance: Attendance[], students: Student[], includeMarks: boolean = false) {
  const studentMap = new Map(students.map(s => [s.id, s]));
  
  const exportData = attendance
    .filter(record => record.session_id === sessionId)
    .map(record => {
      const student = studentMap.get(record.student_id);
      const baseData: any = {
        'Student Name': student?.name || 'Unknown',
        USN: student?.usn || 'N/A',
        Email: student?.email || 'N/A',
        Branch: student?.branch || 'N/A',
        Semester: student?.semester || 'N/A',
        'Marked At': new Date(record.timestamp).toLocaleString(),
        Method: record.method,
        Confidence: record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A'
      };
      
      if (includeMarks) {
        baseData['Marks (out of 100)'] = record.marks !== undefined && record.marks !== null ? record.marks : '';
      }
      
      return baseData;
    });
  
  const filename = includeMarks 
    ? `session_attendance_with_marks_${sessionId}_${new Date().toISOString().split('T')[0]}.csv`
    : `session_attendance_${sessionId}_${new Date().toISOString().split('T')[0]}.csv`;
  
  exportToCSV(exportData, filename);
}

