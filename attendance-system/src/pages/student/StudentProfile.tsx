import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { localDB, Student } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Phone, BookOpen } from 'lucide-react';

export function StudentProfile() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      fetchStudentData();
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

      if (data) {
        setStudent(data);
        setFormData({
          name: data.name,
          phone: data.phone || ''
        });
      }
    } catch (error: any) {
      showToast(error.message || 'Error fetching profile', 'error');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error('User not authenticated');
      await localDB.update<Student>('students', { eq: { user_id: user.id } }, formData);

      showToast('Profile updated successfully', 'success');
      setIsEditing(false);
      fetchStudentData();
    } catch (error: any) {
      showToast(error.message || 'Error updating profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!student) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500">Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile Information</CardTitle>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm">
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({ name: student.name, phone: student.phone || '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-[#0B6CF9] flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{student.name[0].toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{student.name}</h3>
                  <p className="text-gray-600 font-mono">{student.usn}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Mail className="text-[#0B6CF9]" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium">{student.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Phone className="text-[#16A34A]" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium">{student.phone || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <BookOpen className="text-[#F59E0B]" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Branch</p>
                    <p className="text-sm font-medium">{student.branch}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <User className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Semester</p>
                    <p className="text-sm font-medium">{student.semester}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
