import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { localDB, Class, Student, ClassStudent, Session } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Users, Calendar, Trash2, Search, X, Check } from 'lucide-react';

export function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<{ id: string; name: string; sessionCount: number } | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    branch_name: '',
    section_name: '',
    academic_year: '',
    description: ''
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await localDB.select<Class>('classes', {
        orderBy: { column: 'created_at', ascending: false }
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
      
      if (editingClass) {
        await localDB.update<Class>('classes', { eq: { id: editingClass.id } }, formData);
        showToast('Class updated successfully', 'success');
        setIsEditModalOpen(false);
      } else {
        const classData = {
          ...formData,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await localDB.insert('classes', classData);
        showToast('Class created successfully', 'success');
        setIsCreateModalOpen(false);
      }
      
      setFormData({ branch_name: '', section_name: '', academic_year: '', description: '' });
      setEditingClass(null);
      fetchClasses();
    } catch (error: any) {
      showToast(error.message || 'Error saving class', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem);
    setFormData({
      branch_name: classItem.branch_name,
      section_name: classItem.section_name,
      academic_year: classItem.academic_year || '',
      description: classItem.description || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    // First confirmation
    if (!confirm('Are you sure you want to delete this class? This action cannot be undone.')) return;

    try {
      // Check if class has sessions
      const sessions = await localDB.select('sessions', { eq: { class_id: id } });
      const classItem = classes.find(c => c.id === id);
      
      if (sessions.length > 0) {
        // Show second confirmation modal with session count
        setClassToDelete({
          id,
          name: classItem ? `${classItem.branch_name} - ${classItem.section_name}` : 'this class',
          sessionCount: sessions.length
        });
        setIsDeleteConfirmModalOpen(true);
        return;
      }

      // No sessions, proceed with deletion
      await localDB.delete('classes', { eq: { id } });
      showToast('Class deleted successfully', 'success');
      fetchClasses();
    } catch (error: any) {
      showToast(error.message || 'Error deleting class', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete) return;

    try {
      // Double check sessions still exist
      const sessions = await localDB.select('sessions', { eq: { class_id: classToDelete.id } });
      if (sessions.length > 0) {
        showToast(
          `Cannot delete class. Please delete ${sessions.length} session(s) first, then try again.`,
          'error'
        );
        setIsDeleteConfirmModalOpen(false);
        setClassToDelete(null);
        return;
      }

      await localDB.delete('classes', { eq: { id: classToDelete.id } });
      showToast('Class deleted successfully', 'success');
      setIsDeleteConfirmModalOpen(false);
      setClassToDelete(null);
      fetchClasses();
    } catch (error: any) {
      showToast(error.message || 'Error deleting class', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F172A]">Classes</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your classes and sections</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus size={18} />
          Create Class
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">No classes yet. Create your first class to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <Card key={classItem.id}>
              <CardHeader>
                <CardTitle>{classItem.branch_name} - {classItem.section_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {classItem.academic_year && (
                  <p className="text-sm text-gray-600">Academic Year: {classItem.academic_year}</p>
                )}
                {classItem.description && (
                  <p className="text-sm text-gray-600">{classItem.description}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => {
                      setSelectedClass(classItem);
                      setIsStudentModalOpen(true);
                    }}
                  >
                    <Users size={16} />
                    Students
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => {
                      setSelectedClass(classItem);
                      setIsSessionModalOpen(true);
                    }}
                  >
                    <Calendar size={16} />
                    Sessions
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleEdit(classItem)}>
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(classItem.id)}>
                    <Trash2 size={16} className="text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Class"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Branch Name"
            placeholder="e.g., Computer Science"
            value={formData.branch_name}
            onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
            required
          />
          <Input
            label="Section Name"
            placeholder="e.g., A, B, C"
            value={formData.section_name}
            onChange={(e) => setFormData({ ...formData, section_name: e.target.value })}
            required
          />
          <Input
            label="Academic Year (Optional)"
            placeholder="e.g., 2024-2025"
            value={formData.academic_year}
            onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
          />
          <Input
            label="Description (Optional)"
            placeholder="Brief description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingClass(null);
          setFormData({ branch_name: '', section_name: '', academic_year: '', description: '' });
        }}
        title="Edit Class"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Branch Name"
            placeholder="e.g., Computer Science"
            value={formData.branch_name}
            onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
            required
          />
          <Input
            label="Section Name"
            placeholder="e.g., A, B, C"
            value={formData.section_name}
            onChange={(e) => setFormData({ ...formData, section_name: e.target.value })}
            required
          />
          <Input
            label="Academic Year (Optional)"
            placeholder="e.g., 2024-2025"
            value={formData.academic_year}
            onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
          />
          <Input
            label="Description (Optional)"
            placeholder="Brief description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => {
              setIsEditModalOpen(false);
              setEditingClass(null);
              setFormData({ branch_name: '', section_name: '', academic_year: '', description: '' });
            }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Updating...' : 'Update Class'}
            </Button>
          </div>
        </form>
      </Modal>

      <ClassStudentModal
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setSelectedClass(null);
        }}
        classData={selectedClass}
      />

      <CreateSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setSelectedClass(null);
        }}
        classData={selectedClass}
      />

      <Modal
        isOpen={isDeleteConfirmModalOpen}
        onClose={() => {
          setIsDeleteConfirmModalOpen(false);
          setClassToDelete(null);
        }}
        title="Cannot Delete Class"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium">
              This class cannot be deleted because it has {classToDelete?.sessionCount} active session(s).
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Class:</strong> {classToDelete?.name}
            </p>
            <p className="text-sm text-gray-700">
              To delete this class, you must first delete all associated sessions.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> If you've already deleted the sessions, click "Try Again" to refresh and attempt deletion.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteConfirmModalOpen(false);
                setClassToDelete(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!classToDelete) return;
                // Refresh and try again
                const sessions = await localDB.select('sessions', { eq: { class_id: classToDelete.id } });
                if (sessions.length === 0) {
                  await handleConfirmDelete();
                } else {
                  setClassToDelete({
                    ...classToDelete,
                    sessionCount: sessions.length
                  });
                  showToast(`Still has ${sessions.length} session(s). Please delete them first.`, 'warning');
                }
              }}
              className="flex-1"
            >
              Try Again
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ClassStudentModal({ isOpen, onClose, classData }: {
  isOpen: boolean;
  onClose: () => void;
  classData: Class | null;
}) {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && classData) {
      loadStudents();
      loadClassStudents();
    }
  }, [isOpen, classData]);

  const loadStudents = async () => {
    try {
      const allStudents = await localDB.select<Student>('students', {
        orderBy: { column: 'name', ascending: true }
      });
      setStudents(allStudents);
    } catch (error: any) {
      showToast(error.message || 'Error loading students', 'error');
    }
  };

  const loadClassStudents = async () => {
    if (!classData) return;
    try {
      const classStudents = await localDB.select<ClassStudent>('classStudents', {
        eq: { class_id: classData.id }
      });
      setSelectedStudentIds(new Set(classStudents.map(cs => cs.student_id)));
    } catch (error: any) {
      showToast(error.message || 'Error loading class students', 'error');
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const handleSave = async () => {
    if (!classData) return;
    setLoading(true);
    try {
      // Get current class students
      const currentClassStudents = await localDB.select<ClassStudent>('classStudents', {
        eq: { class_id: classData.id }
      });
      const currentStudentIds = new Set(currentClassStudents.map(cs => cs.student_id));

      // Find students to add
      const toAdd = Array.from(selectedStudentIds).filter(id => !currentStudentIds.has(id));
      // Find students to remove
      const toRemove = currentClassStudents.filter(cs => !selectedStudentIds.has(cs.student_id));

      // Add new associations
      for (const studentId of toAdd) {
        await localDB.insert('classStudents', {
          class_id: classData.id,
          student_id: studentId,
          created_at: new Date().toISOString()
        });
      }

      // Remove old associations
      for (const classStudent of toRemove) {
        await localDB.delete('classStudents', { eq: { id: classStudent.id } });
      }

      showToast(`Successfully updated ${toAdd.length} added, ${toRemove.length} removed`, 'success');
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Error saving students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.usn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBranch = !branchFilter || student.branch === branchFilter;
    const matchesSemester = semesterFilter === '' || student.semester === semesterFilter;

    return matchesSearch && matchesBranch && matchesSemester;
  });

  const branches = Array.from(new Set(students.map(s => s.branch))).sort();
  const semesters = Array.from(new Set(students.map(s => s.semester))).sort();

  if (!classData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Students - ${classData.branch_name} ${classData.section_name}`} size="lg">
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search by name, USN, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
            >
              <option value="">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {selectedStudentIds.size} of {filteredStudents.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedStudentIds.size === filteredStudents.length) {
                setSelectedStudentIds(new Set());
              } else {
                setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
              }
            }}
          >
            {selectedStudentIds.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        {/* Students List */}
        <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No students found
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudentIds.has(student.id);
                return (
                  <button
                    key={student.id}
                    onClick={() => handleToggleStudent(student.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-[#0B6CF9] border-[#0B6CF9]' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#0F172A] truncate">{student.name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="font-mono">{student.usn}</span>
                          <span>•</span>
                          <span>{student.branch}</span>
                          <span>•</span>
                          <span>Sem {student.semester}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-1">{student.email}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            {loading ? 'Saving...' : `Save (${selectedStudentIds.size} selected)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateSessionModal({ isOpen, onClose, classData }: {
  isOpen: boolean;
  onClose: () => void;
  classData: Class | null;
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    class_id: '',
    start_at: '',
    duration_minutes: 60,
    notes: ''
  });

  useEffect(() => {
    if (isOpen && classData) {
      setFormData({
        title: '',
        class_id: classData.id,
        start_at: '',
        duration_minutes: 60,
        notes: ''
      });
    }
  }, [isOpen, classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error('User not authenticated');
      if (!formData.class_id) throw new Error('Class is required');
      
      const sessionData = {
        ...formData,
        status: 'upcoming' as const,
        created_at: new Date().toISOString(),
        created_by: user.id
      };
      
      await localDB.insert('sessions', sessionData);
      showToast('Session created successfully', 'success');
      onClose();
      setFormData({ title: '', class_id: classData?.id || '', start_at: '', duration_minutes: 60, notes: '' });
    } catch (error: any) {
      showToast(error.message || 'Error creating session', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!classData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Create Session - ${classData.branch_name} ${classData.section_name}`}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
            {classData.branch_name} - {classData.section_name}
          </div>
        </div>
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
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Creating...' : 'Create Session'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
