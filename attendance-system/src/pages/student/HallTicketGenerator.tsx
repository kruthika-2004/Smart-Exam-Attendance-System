import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { localDB, Student, Session, Class } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

type SessionWithClass = Session & {
  class?: Class;
};

export function HallTicketGenerator() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [ongoingSessions, setOngoingSessions] = useState<SessionWithClass[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const [formData, setFormData] = useState({
    subjectCode: '',
    examDate: '',
    examTime: ''
  });

  useEffect(() => {
    if (user) {
      fetchStudentData();
      fetchOngoingSessions();
    }
  }, [user]);

  const fetchStudentData = async () => {
    try {
      if (!user) return;
      let data = await localDB.selectSingle<Student>('students', {
        eq: { user_id: user.id }
      });
      
      // Fallback: try by email if user_id lookup fails
      if (!data) {
        data = await localDB.selectSingle<Student>('students', {
          eq: { email: user.email }
        });
      }
      
      setStudent(data);
    } catch (error: any) {
      showToast(error.message || 'Error fetching student data', 'error');
    }
  };

  const fetchOngoingSessions = async () => {
    try {
      if (!user) return;
      
      // Get student data first
      let studentData = await localDB.selectSingle<Student>('students', {
        eq: { user_id: user.id }
      });
      
      if (!studentData) {
        studentData = await localDB.selectSingle<Student>('students', {
          eq: { email: user.email }
        });
      }
      
      if (!studentData) {
        console.log('Student not found, cannot fetch sessions');
        return;
      }

      // Get all classes this student belongs to
      const classStudents = await localDB.select('classStudents', {
        eq: { student_id: studentData.id }
      });
      
      if (classStudents.length === 0) {
        console.log('Student not enrolled in any classes');
        return;
      }

      const classIds = classStudents.map((cs: any) => cs.class_id);
      
      // Get all sessions
      const allSessions = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: true }
      });
      
      // Filter sessions: ongoing (live/upcoming) and belonging to student's classes
      const ongoing = allSessions.filter(
        (s) => 
          (s.status === 'live' || s.status === 'upcoming') && 
          classIds.includes(s.class_id)
      );
      
      // Fetch class data for each session
      const sessionsWithClass: SessionWithClass[] = await Promise.all(
        ongoing.map(async (session) => {
          const classData = await localDB.selectSingle<Class>('classes', {
            eq: { id: session.class_id }
          });
          return { ...session, class: classData || undefined };
        })
      );
      
      setOngoingSessions(sessionsWithClass);
    } catch (error: any) {
      console.error('Error fetching ongoing sessions:', error);
      showToast('Error fetching ongoing sessions', 'error');
    }
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    
    if (!sessionId) {
      // Clear form if no session selected
      setFormData({
        subjectCode: '',
        examDate: '',
        examTime: ''
      });
      return;
    }
    
    const session = ongoingSessions.find(s => s.id === sessionId);
    if (session) {
      const startDate = new Date(session.start_at);
      const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = startDate.toTimeString().split(' ')[0].slice(0, 5); // HH:MM
      
      // Use session title as subject code, or class name if title is empty
      const subjectCode = session.title || 
        (session.class ? `${session.class.branch_name} - ${session.class.section_name}` : '');
      
      setFormData({
        subjectCode,
        examDate: dateStr,
        examTime: timeStr
      });
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) {
      showToast('Student data not found', 'error');
      return;
    }
    
    // Generate QR code
    try {
      const qrData = JSON.stringify({
        usn: student.usn,
        name: student.name,
        subjectCode: formData.subjectCode,
        examDate: formData.examDate,
        examTime: formData.examTime
      });
      const qrUrl = await QRCode.toDataURL(qrData, { width: 200 });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
    
    setShowPreview(true);
  };

  const ticketRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!student || !ticketRef.current) return;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Add header
      pdf.setFontSize(24);
      pdf.setTextColor(11, 108, 249); // #0B6CF9
      pdf.text('FaceXam', pdfWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Examination Hall Ticket', pdfWidth / 2, 30, { align: 'center' });

      // Student info
      pdf.setFontSize(12);
      let yPos = 50;
      pdf.text(`Name: ${student.name}`, 20, yPos);
      yPos += 8;
      pdf.text(`USN: ${student.usn}`, 20, yPos);
      yPos += 8;
      pdf.text(`Branch: ${student.branch}`, 20, yPos);
      yPos += 8;
      pdf.text(`Semester: ${student.semester}`, 20, yPos);
      yPos += 8;
      pdf.text(`Subject Code: ${formData.subjectCode}`, 20, yPos);
      yPos += 8;
      pdf.text(`Exam Date: ${new Date(formData.examDate).toLocaleDateString()}`, 20, yPos);
      yPos += 8;
      pdf.text(`Exam Time: ${formData.examTime}`, 20, yPos);

      // Add photo if available
      if (student.photo_url) {
        try {
          const img = new Image();
          img.src = student.photo_url;
          await new Promise((resolve) => {
            img.onload = () => {
              const imgWidth = 40;
              const imgHeight = 50;
              pdf.addImage(student.photo_url!, 'JPEG', pdfWidth - 60, 45, imgWidth, imgHeight);
              resolve(null);
            };
            img.onerror = resolve;
          });
        } catch (e) {
          console.error('Error adding image:', e);
        }
      }

      // Generate QR code
      try {
        const qrData = JSON.stringify({
          usn: student.usn,
          name: student.name,
          subjectCode: formData.subjectCode,
          examDate: formData.examDate,
          examTime: formData.examTime
        });
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 60 });
        pdf.addImage(qrDataUrl, 'PNG', pdfWidth - 60, 150, 40, 40);
      } catch (e) {
        console.error('Error generating QR code:', e);
      }

      // Signatures
      yPos = pdfHeight - 40;
      pdf.text('Student Signature', 20, yPos);
      pdf.text('Authorized Signature', pdfWidth - 60, yPos);
      pdf.line(20, yPos + 2, 80, yPos + 2);
      pdf.line(pdfWidth - 60, yPos + 2, pdfWidth - 20, yPos + 2);

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        'This is a computer-generated hall ticket. Please carry a valid ID proof to the examination hall.',
        pdfWidth / 2,
        pdfHeight - 10,
        { align: 'center' }
      );

      pdf.save(`hall_ticket_${student.usn}_${formData.subjectCode}.pdf`);
      showToast('Hall ticket downloaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error generating PDF', 'error');
    }
  };

  if (!student) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#0F172A]">Hall Ticket Generator</h2>
        <p className="text-sm text-gray-500 mt-1">Generate and download your exam hall ticket</p>
      </div>

      {!showPreview ? (
        <Card>
          <CardHeader>
            <CardTitle>Enter Exam Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              {ongoingSessions.length > 0 ? (
                <>
                  <Select
                    label="Select Ongoing Session"
                    options={ongoingSessions.map(s => ({
                      value: s.id,
                      label: `${s.title || 'Session'} - ${s.class ? `${s.class.branch_name} ${s.class.section_name}` : ''} (${new Date(s.start_at).toLocaleString()})`
                    }))}
                    value={selectedSessionId}
                    onChange={(e) => handleSessionChange(e.target.value)}
                    required
                  />
                  {selectedSessionId && (
                    <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
                      <p><strong>Subject:</strong> {formData.subjectCode}</p>
                      <p><strong>Date:</strong> {formData.examDate ? new Date(formData.examDate).toLocaleDateString() : ''}</p>
                      <p><strong>Time:</strong> {formData.examTime}</p>
                    </div>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={!selectedSessionId}
                  >
                    Generate Hall Ticket
                  </Button>
                </>
              ) : (
                <div className="text-sm text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">
                  No ongoing sessions available. Please contact your administrator to create a session.
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-8">
              <div ref={ticketRef} className="border-4 border-gray-300 p-8 bg-white">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-[#0B6CF9] mb-2">FaceXam</h1>
                  <h2 className="text-xl font-semibold">Examination Hall Ticket</h2>
                </div>

                <div className="grid grid-cols-3 gap-8 mb-8">
                  <div className="col-span-2 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-semibold">{student.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">USN</p>
                        <p className="font-semibold font-mono">{student.usn}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Branch</p>
                        <p className="font-semibold">{student.branch}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Semester</p>
                        <p className="font-semibold">{student.semester}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Subject Code</p>
                        <p className="font-semibold">{formData.subjectCode}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Exam Date</p>
                        <p className="font-semibold">
                          {new Date(formData.examDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Exam Time</p>
                        <p className="font-semibold">{formData.examTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-32 h-40 bg-gray-200 rounded flex items-center justify-center mb-4">
                      {student.photo_url ? (
                        <img
                          src={student.photo_url}
                          alt="Student"
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400 text-sm">Photo</span>
                      )}
                    </div>
                    {qrCodeUrl && (
                      <div className="mt-4">
                        <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24" />
                        <p className="text-xs text-gray-500 text-center mt-2">QR Code</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6 mt-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Student Signature</p>
                      <div className="w-48 border-b border-gray-400"></div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Authorized Signature</p>
                      <div className="w-48 border-b border-gray-400"></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-xs text-gray-500 text-center">
                  <p>This is a computer-generated hall ticket. Please carry a valid ID proof to the examination hall.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={() => setShowPreview(false)} variant="secondary" className="flex-1">
              Back to Form
            </Button>
            <Button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2">
              <Download size={18} />
              Download PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
