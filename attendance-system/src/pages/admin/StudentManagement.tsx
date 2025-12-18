import { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { localDB, Student } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, User, Upload, Camera } from 'lucide-react';
import { parseCSV, mapCSVToStudents, CSVColumnMapping } from '../../utils/csvImport';
import { computeFaceDescriptor } from '../../utils/faceRecognition';

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [computingDescriptor, setComputingDescriptor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    usn: '',
    email: '',
    phone: '',
    branch: '',
    semester: 1,
    photo_url: '',
    descriptor: undefined as number[] | undefined
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const data = await localDB.select<Student>('students', {
        orderBy: { column: 'created_at', ascending: false }
      });
      setStudents(data);
    } catch (error: any) {
      showToast(error.message || 'Error fetching students', 'error');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setFormData({ ...formData, photo_url: base64 });
      showToast('Photo uploaded successfully', 'success');
      
      // Compute face descriptor automatically
      try {
        setComputingDescriptor(true);
        const descriptor = await computeFaceDescriptor(base64);
        if (descriptor) {
          setFormData({ ...formData, photo_url: base64, descriptor: Array.from(descriptor) });
          showToast('Face descriptor computed successfully', 'success');
        } else {
          showToast('No face detected in photo. Please use a clear face photo.', 'warning');
        }
      } catch (error: any) {
        console.error('Error computing descriptor:', error);
        showToast('Could not compute face descriptor. Models may not be loaded.', 'warning');
      } finally {
        setComputingDescriptor(false);
      }
    };
    reader.onerror = () => {
      showToast('Error reading photo', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Compute descriptor if photo exists but descriptor doesn't
      let finalData = { ...formData };
      if (formData.photo_url && !formData.descriptor) {
        try {
          setLoading(true);
          const descriptor = await computeFaceDescriptor(formData.photo_url);
          if (descriptor) {
            finalData = { ...formData, descriptor: Array.from(descriptor) };
          }
        } catch (error) {
          console.warn('Could not compute descriptor:', error);
        }
      }

      const studentData: any = {
        name: finalData.name,
        usn: finalData.usn,
        email: finalData.email,
        phone: finalData.phone || undefined,
        branch: finalData.branch,
        semester: finalData.semester,
        photo_url: finalData.photo_url || undefined,
        created_at: editingStudent ? editingStudent.created_at : new Date().toISOString()
      };

      if (finalData.descriptor) {
        studentData.descriptor = finalData.descriptor;
        studentData.descriptor_computed_at = new Date().toISOString();
      }
      
      if (editingStudent) {
        await localDB.update<Student>('students', { eq: { id: editingStudent.id } }, studentData);
        showToast('Student updated successfully', 'success');
        setIsEditModalOpen(false);
      } else {
        await localDB.insert('students', studentData);
        showToast('Student added successfully', 'success');
        setIsModalOpen(false);
      }
      
      setFormData({ name: '', usn: '', email: '', phone: '', branch: '', semester: 1, photo_url: '', descriptor: undefined });
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      showToast(error.message || 'Error saving student', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      usn: student.usn,
      email: student.email,
      phone: student.phone || '',
      branch: student.branch,
      semester: student.semester,
      photo_url: student.photo_url || '',
      descriptor: student.descriptor
    });
    setIsEditModalOpen(true);
  };

  const handleCSVImport = async (file: File, mapping: CSVColumnMapping) => {
    setLoading(true);
    try {
      const csvData = await parseCSV(file);
      const studentsToImport = mapCSVToStudents(csvData, mapping);
      
      if (studentsToImport.length === 0) {
        showToast('No valid students found in CSV', 'error');
        return;
      }

      const studentsWithTimestamps = studentsToImport.map(student => ({
        ...student,
        created_at: new Date().toISOString()
      }));

      await localDB.insert('students', studentsWithTimestamps);
      showToast(`Successfully imported ${studentsWithTimestamps.length} students`, 'success');
      setIsImportModalOpen(false);
      fetchStudents();
    } catch (error: any) {
      showToast(error.message || 'Error importing CSV', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      await localDB.delete('students', { eq: { id } });

      showToast('Student deleted successfully', 'success');
      fetchStudents();
    } catch (error: any) {
      showToast(error.message || 'Error deleting student', 'error');
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.usn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F172A]">Students</h2>
          <p className="text-sm text-gray-500 mt-1">Manage student information and face descriptors</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={async () => {
              const studentsNeedingDescriptors = students.filter(s => s.photo_url && (!s.descriptor || s.descriptor.length === 0));
              if (studentsNeedingDescriptors.length === 0) {
                showToast('All students with photos already have descriptors', 'info');
                return;
              }
              if (!confirm(`Compute descriptors for ${studentsNeedingDescriptors.length} student(s)? This may take a while.`)) {
                return;
              }
              showToast(`Computing descriptors for ${studentsNeedingDescriptors.length} students...`, 'info');
              let successCount = 0;
              for (const student of studentsNeedingDescriptors) {
                try {
                  const descriptor = await computeFaceDescriptor(student.photo_url);
                  if (descriptor) {
                    await localDB.update<Student>('students', { eq: { id: student.id } }, {
                      descriptor: Array.from(descriptor),
                      descriptor_computed_at: new Date().toISOString()
                    });
                    successCount++;
                  }
                } catch (error) {
                  console.error(`Error computing descriptor for ${student.name}:`, error);
                }
              }
              showToast(`Computed descriptors for ${successCount}/${studentsNeedingDescriptors.length} students`, successCount > 0 ? 'success' : 'warning');
              fetchStudents();
            }}
            className="flex items-center gap-2"
          >
            <Camera size={18} />
            Compute All Descriptors
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload size={18} />
            Import CSV
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus size={18} />
            Add Student
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b">
          <Input
            placeholder="Search by name, USN, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>USN</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Descriptor</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <User size={20} className="text-gray-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="font-mono text-xs">{student.usn}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.branch}</TableCell>
                  <TableCell>{student.semester}</TableCell>
                  <TableCell>
                    {student.descriptor && student.descriptor.length > 0 ? (
                      <Badge variant="success">Computed</Badge>
                    ) : (
                      <Badge variant="warning">Not Computed</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {student.photo_url && (!student.descriptor || student.descriptor.length === 0) && (
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={async () => {
                            try {
                              showToast('Computing descriptor... This may take a moment.', 'info');
                              console.log('Computing descriptor for:', student.name);
                              const descriptor = await computeFaceDescriptor(student.photo_url);
                              if (descriptor) {
                                await localDB.update<Student>('students', { eq: { id: student.id } }, {
                                  descriptor: Array.from(descriptor),
                                  descriptor_computed_at: new Date().toISOString()
                                });
                                showToast(`Descriptor computed successfully for ${student.name}`, 'success');
                                fetchStudents();
                              } else {
                                showToast('Could not compute descriptor. Recognition model may not be available. Please check browser console.', 'warning');
                              }
                            } catch (error: any) {
                              console.error('Error computing descriptor:', error);
                              showToast('Error computing descriptor: ' + error.message, 'error');
                            }
                          }}
                          title="Compute Face Descriptor"
                          className="flex items-center gap-1"
                        >
                          <Camera size={16} />
                          <span className="text-xs">Compute</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(student)}>
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(student.id)}>
                        <Trash2 size={16} className="text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Student"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter student name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="USN (University Seat Number)"
            placeholder="Enter USN"
            value={formData.usn}
            onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="student@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            placeholder="Phone number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Branch"
            placeholder="e.g., Computer Science"
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            required
          />
          <Input
            label="Semester"
            type="number"
            min="1"
            max="8"
            value={formData.semester}
            onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
            <div className="flex items-center gap-4">
              {formData.photo_url && (
                <img src={formData.photo_url} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={16} />
                {formData.photo_url ? 'Change Photo' : 'Upload Photo'}
              </Button>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => {
              setIsModalOpen(false);
              setFormData({ name: '', usn: '', email: '', phone: '', branch: '', semester: 1, photo_url: '', descriptor: undefined });
            }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingStudent(null);
          setFormData({ name: '', usn: '', email: '', phone: '', branch: '', semester: 1, photo_url: '', descriptor: undefined });
        }}
        title="Edit Student"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter student name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="USN (University Seat Number)"
            placeholder="Enter USN"
            value={formData.usn}
            onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="student@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            placeholder="Phone number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Branch"
            placeholder="e.g., Computer Science"
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            required
          />
          <Input
            label="Semester"
            type="number"
            min="1"
            max="8"
            value={formData.semester}
            onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
            <div className="flex items-center gap-4">
              {formData.photo_url && (
                <img src={formData.photo_url} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
              )}
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-2"
                onClick={() => editFileInputRef.current?.click()}
              >
                <Camera size={16} />
                {formData.photo_url ? 'Change Photo' : 'Upload Photo'}
              </Button>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => {
              setIsEditModalOpen(false);
              setEditingStudent(null);
              setFormData({ name: '', usn: '', email: '', phone: '', branch: '', semester: 1, photo_url: '', descriptor: undefined });
            }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Updating...' : 'Update Student'}
            </Button>
          </div>
        </form>
      </Modal>

      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleCSVImport}
        loading={loading}
      />
    </div>
  );
}

function CSVImportModal({ isOpen, onClose, onImport, loading }: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, mapping: CSVColumnMapping) => void;
  loading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CSVColumnMapping>({});

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      const csvData = await parseCSV(selectedFile);
      if (csvData.length > 0) {
        setCsvHeaders(csvData[0]);
        setFile(selectedFile);
      }
    } catch (error: any) {
      alert('Error reading CSV: ' + error.message);
    }
  };

  const handleImport = () => {
    if (!file) return;
    onImport(file, mapping);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Students from CSV" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0B6CF9] file:text-white hover:file:bg-[#0A5CD7]"
          />
        </div>

        {csvHeaders.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Map CSV Columns</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Name *</label>
                <select
                  value={mapping.name || ''}
                  onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">USN *</label>
                <select
                  value={mapping.usn || ''}
                  onChange={(e) => setMapping({ ...mapping, usn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email *</label>
                <select
                  value={mapping.email || ''}
                  onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Phone</label>
                <select
                  value={mapping.phone || ''}
                  onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Branch</label>
                <select
                  value={mapping.branch || ''}
                  onChange={(e) => setMapping({ ...mapping, branch: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Semester</label>
                <select
                  value={mapping.semester || ''}
                  onChange={(e) => setMapping({ ...mapping, semester: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
                >
                  <option value="">Select column...</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || !mapping.name || !mapping.usn || !mapping.email || loading}
            className="flex-1"
          >
            {loading ? 'Importing...' : 'Import Students'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
