import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { localDB, Student, Class, Session, Attendance } from '../lib/database';
import { computeFaceDescriptor } from '../utils/faceRecognition';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function Chatbot() {
  const { user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message when chat opens
  useEffect(() => {
    if (isOpen) {
      const welcomeMessage: Message = {
        id: '1',
        text: user 
          ? `Hello${role === 'admin' ? ' Admin' : role === 'student' ? ' Student' : ''}! I can help you with information about your classes, sessions, students, and attendance. What would you like to know?`
          : 'Hello! I\'m here to help. Please log in to get personalized assistance.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    } else {
      // Reset messages when chat closes
      setMessages([]);
    }
  }, [isOpen, user, role]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processQuery = async (query: string): Promise<string> => {
    const lowerQuery = query.toLowerCase().trim();

    try {
      // Descriptor queries (admin only)
      if ((lowerQuery.includes('descriptor') || lowerQuery.includes('compute') || lowerQuery.includes('face recognition')) && (role === 'admin' || role === 'teacher')) {
        if (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('need')) {
          const allStudents = await localDB.select<Student>('students', {});
          const studentsNeedingDescriptors = allStudents.filter(s => s.photo_url && (!s.descriptor || s.descriptor.length === 0));
          const studentsWithDescriptors = allStudents.filter(s => s.descriptor && s.descriptor.length > 0);
          return `Descriptor Status:\n• Students needing descriptors: ${studentsNeedingDescriptors.length}\n• Students with computed descriptors: ${studentsWithDescriptors.length}\n• Total students: ${allStudents.length}`;
        }
        if (lowerQuery.includes('compute') || lowerQuery.includes('calculate')) {
          const allStudents = await localDB.select<Student>('students', {});
          const studentsNeedingDescriptors = allStudents.filter(s => s.photo_url && (!s.descriptor || s.descriptor.length === 0));
          
          if (studentsNeedingDescriptors.length === 0) {
            return 'All students with photos already have descriptors computed!';
          }
          
          return `I can help compute descriptors for ${studentsNeedingDescriptors.length} student(s). This may take a while. Type "compute all descriptors" to start, or "compute descriptors for [student name]" for a specific student.`;
        }
        if (lowerQuery.includes('compute all') || lowerQuery.includes('compute descriptors for all')) {
          const allStudents = await localDB.select<Student>('students', {});
          const studentsNeedingDescriptors = allStudents.filter(s => s.photo_url && (!s.descriptor || s.descriptor.length === 0));
          
          if (studentsNeedingDescriptors.length === 0) {
            return 'All students with photos already have descriptors computed!';
          }
          
          let successCount = 0;
          let failedCount = 0;
          const failedStudents: string[] = [];
          
          for (const student of studentsNeedingDescriptors) {
            try {
              const descriptor = await computeFaceDescriptor(student.photo_url);
              if (descriptor) {
                await localDB.update<Student>('students', { eq: { id: student.id } }, {
                  descriptor: Array.from(descriptor),
                  descriptor_computed_at: new Date().toISOString()
                });
                successCount++;
              } else {
                failedCount++;
                failedStudents.push(student.name);
              }
            } catch (error) {
              failedCount++;
              failedStudents.push(student.name);
            }
          }
          
          if (successCount > 0) {
            return `✅ Successfully computed descriptors for ${successCount} student(s)!\n${failedCount > 0 ? `⚠️ Failed for ${failedCount} student(s): ${failedStudents.slice(0, 5).join(', ')}${failedStudents.length > 5 ? '...' : ''}` : ''}`;
          } else {
            return `❌ Could not compute descriptors. This might be because:\n• Face recognition models are not loaded\n• Photos don't contain detectable faces\n• Network issues loading models\n\nPlease check the browser console for details.`;
          }
        }
        // Compute for specific student
        if (lowerQuery.includes('compute descriptors for')) {
          const nameMatch = query.match(/compute descriptors for (.+)/i);
          if (nameMatch) {
            const searchName = nameMatch[1].trim();
            const students = await localDB.select<Student>('students', {});
            const matchingStudent = students.find(s => 
              s.name.toLowerCase().includes(searchName.toLowerCase()) ||
              s.usn.toLowerCase().includes(searchName.toLowerCase()) ||
              s.email.toLowerCase().includes(searchName.toLowerCase())
            );
            
            if (!matchingStudent) {
              return `Student "${searchName}" not found.`;
            }
            
            if (!matchingStudent.photo_url) {
              return `Student "${matchingStudent.name}" doesn't have a photo uploaded.`;
            }
            
            if (matchingStudent.descriptor && matchingStudent.descriptor.length > 0) {
              return `Student "${matchingStudent.name}" already has a descriptor computed.`;
            }
            
            try {
              const descriptor = await computeFaceDescriptor(matchingStudent.photo_url);
              if (descriptor) {
                await localDB.update<Student>('students', { eq: { id: matchingStudent.id } }, {
                  descriptor: Array.from(descriptor),
                  descriptor_computed_at: new Date().toISOString()
                });
                return `✅ Successfully computed descriptor for ${matchingStudent.name}!`;
              } else {
                return `❌ Could not compute descriptor for ${matchingStudent.name}. The photo might not contain a detectable face, or face recognition models may not be loaded.`;
              }
            } catch (error: any) {
              return `❌ Error computing descriptor: ${error.message}`;
            }
          }
        }
      }

      // Statistics queries
      if (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total')) {
        if (lowerQuery.includes('student')) {
          const count = await localDB.count('students');
          return `There are ${count} student${count !== 1 ? 's' : ''} in the system.`;
        }
        if (lowerQuery.includes('class')) {
          const count = await localDB.count('classes');
          return `There are ${count} class${count !== 1 ? 'es' : ''} in the system.`;
        }
        if (lowerQuery.includes('session')) {
          const count = await localDB.count('sessions');
          return `There are ${count} session${count !== 1 ? 's' : ''} in the system.`;
        }
        if (lowerQuery.includes('attendance')) {
          const count = await localDB.count('attendance');
          return `There are ${count} attendance record${count !== 1 ? 's' : ''} in the system.`;
        }
      }

      // Student queries
      if (lowerQuery.includes('student') && user) {
        if (role === 'student') {
          const students = await localDB.select<Student>('students', {
            eq: { email: user.email }
          });
          if (students.length > 0) {
            const student = students[0];
            return `Your student information:\n• Name: ${student.name}\n• USN: ${student.usn}\n• Branch: ${student.branch}\n• Semester: ${student.semester}\n• Email: ${student.email}`;
          }
        } else if (role === 'admin' || role === 'teacher') {
          if (lowerQuery.includes('need descriptor') || lowerQuery.includes('missing descriptor')) {
            const allStudents = await localDB.select<Student>('students', {});
            const studentsNeedingDescriptors = allStudents.filter(s => s.photo_url && (!s.descriptor || s.descriptor.length === 0));
            if (studentsNeedingDescriptors.length === 0) {
              return 'All students with photos have descriptors computed! ✅';
            }
            const studentList = studentsNeedingDescriptors.slice(0, 20).map(s => `• ${s.name} (${s.usn}) - ${s.branch}`).join('\n');
            return `Students needing descriptors (${studentsNeedingDescriptors.length}):\n${studentList}${studentsNeedingDescriptors.length > 20 ? `\n\n(Showing first 20 of ${studentsNeedingDescriptors.length})` : ''}`;
          }
          if (lowerQuery.includes('list') || lowerQuery.includes('all')) {
            const students = await localDB.select<Student>('students', {
              orderBy: { column: 'name', ascending: true },
              limit: 10
            });
            if (students.length === 0) {
              return 'No students found in the system.';
            }
            const studentList = students.map(s => `• ${s.name} (${s.usn}) - ${s.branch}`).join('\n');
            return `Here are the students:\n${studentList}${students.length === 10 ? '\n\n(Showing first 10 students)' : ''}`;
          }
        }
      }

      // Class queries
      if (lowerQuery.includes('class')) {
        if (lowerQuery.includes('list') || lowerQuery.includes('all')) {
          const classes = await localDB.select<Class>('classes', {
            orderBy: { column: 'created_at', ascending: false }
          });
          if (classes.length === 0) {
            return 'No classes found in the system.';
          }
          const classList = classes.map(c => `• ${c.branch_name} - ${c.section_name}${c.academic_year ? ` (${c.academic_year})` : ''}`).join('\n');
          return `Here are the classes:\n${classList}`;
        }
      }

      // Session queries
      if (lowerQuery.includes('session')) {
        if (lowerQuery.includes('upcoming') || lowerQuery.includes('future')) {
          const sessions = await localDB.select<Session>('sessions', {
            eq: { status: 'upcoming' },
            orderBy: { column: 'start_at', ascending: true }
          });
          if (sessions.length === 0) {
            return 'No upcoming sessions found.';
          }
          const sessionList = sessions.slice(0, 5).map(s => {
            const date = new Date(s.start_at);
            return `• ${s.title} - ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
          }).join('\n');
          return `Upcoming sessions:\n${sessionList}`;
        }
        if (lowerQuery.includes('live') || lowerQuery.includes('current')) {
          const sessions = await localDB.select<Session>('sessions', {
            eq: { status: 'live' }
          });
          if (sessions.length === 0) {
            return 'No live sessions currently.';
          }
          const sessionList = sessions.map(s => `• ${s.title}`).join('\n');
          return `Live sessions:\n${sessionList}`;
        }
        if (lowerQuery.includes('list') || lowerQuery.includes('all')) {
          const sessions = await localDB.select<Session>('sessions', {
            orderBy: { column: 'start_at', ascending: false },
            limit: 10
          });
          if (sessions.length === 0) {
            return 'No sessions found.';
          }
          const sessionList = sessions.map(s => {
            const date = new Date(s.start_at);
            return `• ${s.title} (${s.status}) - ${date.toLocaleDateString()}`;
          }).join('\n');
          return `Recent sessions:\n${sessionList}`;
        }
      }

      // Attendance queries
      if (lowerQuery.includes('attendance') && user) {
        if (role === 'student') {
          const students = await localDB.select<Student>('students', {
            eq: { email: user.email }
          });
          if (students.length > 0) {
            const student = students[0];
            const attendanceRecords = await localDB.select<Attendance>('attendance', {
              eq: { student_id: student.id }
            });
            const totalSessions = await localDB.count('sessions');
            const attendanceCount = attendanceRecords.length;
            const percentage = totalSessions > 0 ? Math.round((attendanceCount / totalSessions) * 100) : 0;
            return `Your attendance:\n• Present: ${attendanceCount} out of ${totalSessions} sessions\n• Attendance Rate: ${percentage}%`;
          }
        } else if (role === 'admin' || role === 'teacher') {
          const totalAttendance = await localDB.count('attendance');
          return `Total attendance records: ${totalAttendance}`;
        }
      }

      // Help queries
      if (lowerQuery.includes('help') || lowerQuery.includes('what can you')) {
        const helpText = `I can help you with:\n• Statistics (students, classes, sessions, attendance)\n• Student information\n• Class listings\n• Session information (upcoming, live, past)\n• Attendance queries`;
        const adminHelp = role === 'admin' || role === 'teacher' 
          ? `\n• Face descriptor computation and status\n\nTry asking:\n• "How many students need descriptors?"\n• "Compute all descriptors"\n• "Compute descriptors for [student name]"`
          : '';
        return helpText + adminHelp + `\n\nGeneral queries:\n• "How many students are there?"\n• "List all classes"\n• "Show upcoming sessions"\n• "What's my attendance?" (for students)`;
      }

      // Default response
      return `I understand you're asking about "${query}". I can help with information about students, classes, sessions, and attendance. Try asking specific questions like:\n• "How many students are there?"\n• "List all classes"\n• "Show upcoming sessions"\n• Or ask for help to see all available commands.`;
    } catch (error) {
      console.error('Error processing query:', error);
      return 'Sorry, I encountered an error while processing your request. Please try again.';
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const query = inputValue;
    setInputValue('');

    // Show typing indicator
    const typingMessage: Message = {
      id: `typing-${Date.now()}`,
      text: '...',
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, typingMessage]);

    // Process query and get response
    const response = await processQuery(query);

    // Remove typing indicator and add actual response
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== typingMessage.id);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date()
      };
      return [...filtered, botMessage];
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#0B6CF9] text-white rounded-full shadow-lg hover:bg-[#0A5CD7] transition-all duration-200 flex items-center justify-center z-40 hover:scale-110 active:scale-95"
        aria-label="Open chatbot"
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-[#0B6CF9] text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <h3 className="font-semibold">Chat Support</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close chatbot"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender === 'user'
                      ? 'bg-[#0B6CF9] text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="px-4"
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

