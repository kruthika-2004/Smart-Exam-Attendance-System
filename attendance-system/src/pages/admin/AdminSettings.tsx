import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Input } from '../../components/ui/Input';
import { localDB, Student, Attendance, Session, Class, User, getServerInfo } from '../../lib/database';
import { exportStudents, exportAttendance, exportSessions } from '../../utils/csvExport';
import { importStudentsFromExcelFile, generateCredentialsDocument } from '../../utils/importStudentsBrowser';
import { autoImportStudentsFromData } from '../../utils/autoImportStudents';
import { Download, Upload, FileText, Trash2, Server, Wifi, WifiOff } from 'lucide-react';

export function AdminSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const excelFileRef = useRef<HTMLInputElement>(null);
  const imagesFileRef = useRef<HTMLInputElement>(null);

  const handleExportStudents = async () => {
    setLoading('students');
    try {
      const students = await localDB.select<Student>('students');
      await exportStudents(students);
      showToast('Students exported successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error exporting students', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleExportAttendance = async () => {
    setLoading('attendance');
    try {
      const [attendance, students] = await Promise.all([
        localDB.select<Attendance>('attendance'),
        localDB.select<Student>('students')
      ]);
      await exportAttendance(attendance, students);
      showToast('Attendance records exported successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error exporting attendance', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleRemoveDuplicates = async () => {
    setLoading('cleanup');
    try {
      let removedCount = 0;

      // Remove duplicate users (keep first, remove others with same email)
      const allUsers = await localDB.select<User>('users', {});
      const userMap = new Map<string, User>();
      const duplicateUsers: User[] = [];
      
      allUsers.forEach(user => {
        const emailKey = user.email.toLowerCase();
        if (userMap.has(emailKey)) {
          duplicateUsers.push(user);
        } else {
          userMap.set(emailKey, user);
        }
      });
      
      for (const dupUser of duplicateUsers) {
        await localDB.delete('users', { eq: { id: dupUser.id } });
        removedCount++;
      }
      console.log(`Removed ${duplicateUsers.length} duplicate users`);

      // Remove duplicate classes (keep first, remove others with same branch_name + section_name)
      const allClasses = await localDB.select<Class>('classes', {});
      const classMap = new Map<string, Class>();
      const duplicateClasses: Class[] = [];
      
      allClasses.forEach(cls => {
        const key = `${cls.branch_name}-${cls.section_name}`.toLowerCase();
        if (classMap.has(key)) {
          duplicateClasses.push(cls);
        } else {
          classMap.set(key, cls);
        }
      });
      
      for (const dupClass of duplicateClasses) {
        // First, delete associated sessions and classStudents
        const sessions = await localDB.select<Session>('sessions', { eq: { class_id: dupClass.id } });
        for (const session of sessions) {
          await localDB.delete('sessions', { eq: { id: session.id } });
        }
        
        await localDB.delete('classStudents', { eq: { class_id: dupClass.id } });
        await localDB.delete('classes', { eq: { id: dupClass.id } });
        removedCount++;
      }
      console.log(`Removed ${duplicateClasses.length} duplicate classes`);

      // Remove duplicate students (keep first, remove others with same email or USN)
      const allStudents = await localDB.select<Student>('students', {});
      const studentByEmail = new Map<string, Student>();
      const studentByUSN = new Map<string, Student>();
      const duplicateStudents: Student[] = [];
      
      allStudents.forEach(student => {
        const emailKey = student.email.toLowerCase();
        const usnKey = student.usn.toUpperCase();
        
        if (studentByEmail.has(emailKey) || studentByUSN.has(usnKey)) {
          duplicateStudents.push(student);
        } else {
          studentByEmail.set(emailKey, student);
          studentByUSN.set(usnKey, student);
        }
      });
      
      for (const dupStudent of duplicateStudents) {
        // Delete associated attendance and classStudents
        await localDB.delete('attendance', { eq: { student_id: dupStudent.id } });
        await localDB.delete('classStudents', { eq: { student_id: dupStudent.id } });
        await localDB.delete('students', { eq: { id: dupStudent.id } });
        removedCount++;
      }
      console.log(`Removed ${duplicateStudents.length} duplicate students`);

      showToast(`Cleanup complete! Removed ${removedCount} duplicate records.`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Error removing duplicates', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleExportSessions = async () => {
    setLoading('sessions');
    try {
      const [sessions, classes] = await Promise.all([
        localDB.select<Session>('sessions'),
        localDB.select<Class>('classes')
      ]);
      await exportSessions(sessions, classes);
      showToast('Sessions exported successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error exporting sessions', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage application settings and exports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="secondary"
            className="w-full justify-start gap-3"
            onClick={handleExportStudents}
            disabled={loading !== null}
          >
            <Download size={18} />
            {loading === 'students' ? 'Exporting...' : 'Export All Students (CSV)'}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start gap-3"
            onClick={handleExportAttendance}
            disabled={loading !== null}
          >
            <Download size={18} />
            {loading === 'attendance' ? 'Exporting...' : 'Export All Attendance Records (CSV)'}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start gap-3"
            onClick={handleExportSessions}
            disabled={loading !== null}
          >
            <Download size={18} />
            {loading === 'sessions' ? 'Exporting...' : 'Export All Sessions (CSV)'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="secondary"
            className="w-full justify-start gap-3"
            onClick={async () => {
              setLoading('auto-import');
              try {
                await autoImportStudentsFromData();
                showToast('Students imported successfully! Credentials document downloaded.', 'success');
              } catch (error: any) {
                showToast(error.message || 'Error importing. Please use manual import.', 'error');
                setIsImportModalOpen(true);
              } finally {
                setLoading(null);
              }
            }}
            disabled={loading !== null}
          >
            <Upload size={18} />
            {loading === 'auto-import' ? 'Importing...' : 'Auto Import from src/data'}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start gap-3"
            onClick={() => setIsImportModalOpen(true)}
            disabled={loading !== null}
          >
            <FileText size={18} />
            Manual Import (Upload Files)
          </Button>
          <p className="text-xs text-gray-500">
            Auto import loads from src/data folder. Manual import allows you to upload Excel file and photos. Students will be automatically split into 2 classes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Cleanup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm('This will remove duplicate users, classes, and students. This action cannot be undone. Continue?')) {
                handleRemoveDuplicates();
              }
            }}
            disabled={loading !== null}
          >
            <Trash2 size={18} />
            {loading === 'cleanup' ? 'Removing duplicates...' : 'Remove Duplicate Records'}
          </Button>
          <p className="text-xs text-gray-500">
            Removes duplicate users (same email), classes (same branch + section), and students (same email or USN). Keeps the first occurrence of each.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network Server Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ServerConnectionSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network Server Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ServerConnectionSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Face Recognition Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Face recognition settings will be available in a future update.</p>
        </CardContent>
      </Card>

      <ImportStudentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        excelFileRef={excelFileRef}
        imagesFileRef={imagesFileRef}
        loading={loading}
        setLoading={setLoading}
        showToast={showToast}
      />
    </div>
  );
}

function ImportStudentsModal({
  isOpen,
  onClose,
  excelFileRef,
  imagesFileRef,
  loading,
  setLoading,
  showToast
}: {
  isOpen: boolean;
  onClose: () => void;
  excelFileRef: React.RefObject<HTMLInputElement>;
  imagesFileRef: React.RefObject<HTMLInputElement>;
  loading: string | null;
  setLoading: (value: string | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showToast('Please select an Excel file (.xlsx or .xls)', 'error');
        return;
      }
      setExcelFile(file);
    }
  };

  const handleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => 
      file.type.startsWith('image/')
    );
    setImageFiles(imageFiles);
    showToast(`Selected ${imageFiles.length} images`, 'success');
  };

  const handleImport = async () => {
    if (!excelFile) {
      showToast('Please select an Excel file', 'error');
      return;
    }

    setLoading('import');
    try {
      const result = await importStudentsFromExcelFile(excelFile, imageFiles);
      
      // Generate and download credentials document
      const credentialsDoc = generateCredentialsDocument(result.credentials, result.classes);
      const blob = new Blob([credentialsDoc], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `STUDENT_CREDENTIALS_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        `Successfully imported ${result.credentials.length} students into 2 classes. Credentials document downloaded.`,
        'success'
      );
      
      // Reset form
      setExcelFile(null);
      setImageFiles([]);
      if (excelFileRef.current) excelFileRef.current.value = '';
      if (imagesFileRef.current) imagesFileRef.current.value = '';
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Error importing students', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Students from Excel" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Excel File (Required)
          </label>
          <input
            ref={excelFileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0B6CF9] file:text-white hover:file:bg-[#0A5CD7]"
          />
          {excelFile && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {excelFile.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student Photos (Optional - Select multiple)
          </label>
          <input
            ref={imagesFileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0B6CF9] file:text-white hover:file:bg-[#0A5CD7]"
          />
          {imageFiles.length > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {imageFiles.length} images
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Students will be automatically:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Created with email addresses and simple passwords</li>
              <li>Split into 2 classes (Computer Science - A and B)</li>
              <li>Assigned photos if provided</li>
              <li>A credentials document will be downloaded automatically</li>
            </ul>
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading === 'import'}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!excelFile || loading === 'import'}
            className="flex-1"
          >
            {loading === 'import' ? 'Importing...' : 'Import Students'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ServerConnectionSettings() {
  const { showToast } = useToast();
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ port: number; networkAddresses: string[]; accessUrl: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const url = localDB.getServerUrl();
    if (url) {
      setServerUrl(url);
      checkConnection(url);
    }
  }, []);

  const checkConnection = async (url: string) => {
    setChecking(true);
    try {
      const connected = await localDB.checkServerConnection();
      setIsConnected(connected);
      if (connected) {
        const info = await getServerInfo();
        setServerInfo(info);
      } else {
        setServerInfo(null);
      }
    } catch (error) {
      setIsConnected(false);
      setServerInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    if (!serverUrl.trim()) {
      showToast('Please enter a server URL', 'error');
      return;
    }

    // Remove trailing slash
    const url = serverUrl.trim().replace(/\/$/, '');
    
    try {
      // Temporarily set the URL to check connection
      localDB.setServerUrl(url);
      const connected = await localDB.checkServerConnection();
      if (!connected) {
        localDB.setServerUrl(null); // Reset on failure
        showToast('Cannot connect to server. Please check the URL and ensure the server is running.', 'error');
        return;
      }

      setIsConnected(true);
      const info = await getServerInfo();
      setServerInfo(info);
      showToast('Connected to server successfully!', 'success');
    } catch (error: any) {
      localDB.setServerUrl(null); // Reset on failure
      showToast(error.message || 'Failed to connect to server', 'error');
      setIsConnected(false);
    }
  };

  const handleDisconnect = () => {
    localDB.setServerUrl(null);
    setServerUrl('');
    setIsConnected(false);
    setServerInfo(null);
    showToast('Disconnected from server. Using local database.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        {isConnected ? (
          <Wifi className="text-green-600" size={20} />
        ) : (
          <WifiOff className="text-gray-400" size={20} />
        )}
        <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-gray-600'}`}>
          {isConnected ? 'Connected to Network Server' : 'Using Local Database (Offline)'}
        </span>
      </div>

      {serverInfo && isConnected && (
        <div className="p-3 bg-blue-50 rounded-lg text-sm">
          <p className="font-medium text-blue-900 mb-1">Server Information:</p>
          <p className="text-blue-700">Port: {serverInfo.port}</p>
          <p className="text-blue-700">Access URL: {serverInfo.accessUrl}</p>
          {serverInfo.networkAddresses.length > 0 && (
            <p className="text-blue-700 mt-1">
              Network IPs: {serverInfo.networkAddresses.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Input
          label="Server URL"
          placeholder="http://192.168.1.100:3001 or http://localhost:3001"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          disabled={isConnected}
        />
        
        <div className="flex gap-2">
          {!isConnected ? (
            <Button
              onClick={handleConnect}
              disabled={checking || !serverUrl.trim()}
              className="flex items-center gap-2"
            >
              <Server size={18} />
              {checking ? 'Checking...' : 'Connect to Server'}
            </Button>
          ) : (
            <Button
              onClick={handleDisconnect}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <WifiOff size={18} />
              Disconnect
            </Button>
          )}
          
          {isConnected && (
            <Button
              onClick={() => checkConnection(serverUrl)}
              variant="secondary"
              disabled={checking}
              className="flex items-center gap-2"
            >
              {checking ? 'Checking...' : 'Refresh Connection'}
            </Button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>• To share database across network, start the server with: <code className="bg-gray-100 px-1 rounded">npm run server</code></p>
        <p>• Server runs on port 3001 by default</p>
        <p>• Use the server's IP address for other devices on the same network</p>
        <p>• When connected, all devices share the same database</p>
      </div>
    </div>
  );
}
