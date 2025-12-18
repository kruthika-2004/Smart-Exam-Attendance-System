import { localDB } from '../lib/database';

export async function setupDemoAccounts() {
  const results = {
    admin: { success: false, message: '' },
    student: { success: false, message: '' }
  };

  try {
    // Check if admin already exists
    const existingAdmin = await localDB.selectSingle('users', {
      eq: { email: 'admin@facexam.demo' }
    });

    if (existingAdmin) {
      results.admin.message = 'Admin account already exists';
      results.admin.success = true;
    } else {
      const adminUser = await localDB.signUp('admin@facexam.demo', 'admin123', 'admin');
      results.admin.success = true;
      results.admin.message = 'Admin account created';
    }
  } catch (error: any) {
    results.admin.message = error.message;
  }

  try {
    // Check if student already exists
    const existingStudent = await localDB.selectSingle('users', {
      eq: { email: 'student@facexam.demo' }
    });

    if (existingStudent) {
      results.student.message = 'Student account already exists';
      results.student.success = true;
    } else {
      const studentUser = await localDB.signUp('student@facexam.demo', 'student123', 'student');
      
      // Create student record
      await localDB.insert('students', {
        user_id: studentUser.id,
        name: 'Demo Student',
        usn: 'DEMO2024001',
        email: 'student@facexam.demo',
        branch: 'Computer Science',
        semester: 3,
        created_at: new Date().toISOString()
      });

      results.student.success = true;
      results.student.message = 'Student account created';
    }
  } catch (error: any) {
    results.student.message = error.message;
  }

  return results;
}
