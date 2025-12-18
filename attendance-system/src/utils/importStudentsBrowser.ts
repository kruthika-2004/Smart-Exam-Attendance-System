import * as XLSX from 'xlsx';
import { localDB, Student, User, UserRoleRecord, Class, ClassStudent } from '../lib/database';

interface StudentData {
  name?: string;
  usn?: string;
  email?: string;
  phone?: string;
  branch?: string;
  semester?: number;
  [key: string]: any;
}

export async function importStudentsFromExcelFile(
  file: File,
  imageFiles: File[]
): Promise<{ credentials: Array<{ email: string; password: string; name: string; usn: string; class: string }>; classes: Class[] }> {
  // Read Excel file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: StudentData[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} students in Excel file`);

  // Sort image files by number
  const sortedImages = [...imageFiles].sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  console.log(`Found ${sortedImages.length} images`);

  // Create 2 classes
  const class1: Class = {
    id: generateUUID(),
    branch_name: 'Computer Science',
    section_name: 'A',
    academic_year: '2024-2025',
    description: 'Class A - First half of students',
    created_at: new Date().toISOString(),
    created_by: 'system'
  };

  const class2: Class = {
    id: generateUUID(),
    branch_name: 'Computer Science',
    section_name: 'B',
    academic_year: '2024-2025',
    description: 'Class B - Second half of students',
    created_at: new Date().toISOString(),
    created_by: 'system'
  };

  // Check if classes already exist before creating
  const existingClasses = await localDB.select<Class>('classes', {});
  const class1Exists = existingClasses.some(c => 
    c.branch_name === class1.branch_name && c.section_name === class1.section_name
  );
  const class2Exists = existingClasses.some(c => 
    c.branch_name === class2.branch_name && c.section_name === class2.section_name
  );
  
  if (!class1Exists) {
    await localDB.insert('classes', class1);
    console.log('Created class 1');
  } else {
    const existing = existingClasses.find(c => 
      c.branch_name === class1.branch_name && c.section_name === class1.section_name
    );
    if (existing) {
      class1.id = existing.id;
      console.log('Using existing class 1');
    }
  }
  
  if (!class2Exists) {
    await localDB.insert('classes', class2);
    console.log('Created class 2');
  } else {
    const existing = existingClasses.find(c => 
      c.branch_name === class2.branch_name && c.section_name === class2.section_name
    );
    if (existing) {
      class2.id = existing.id;
      console.log('Using existing class 2');
    }
  }

  const credentials: Array<{ email: string; password: string; name: string; usn: string; class: string }> = [];

  // Process each student
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const studentData = row;

    // Extract data (handle different column name variations)
    const name = studentData.name || studentData.Name || studentData.NAME || '';
    const usn = studentData.usn || studentData.USN || studentData.Usn || '';
    const email = studentData.email || studentData.Email || studentData.EMAIL || 
                  `${usn.toLowerCase().replace(/\s+/g, '')}@student.demo` || 
                  `student${i + 1}@demo.com`;
    const phone = studentData.phone || studentData.Phone || studentData.PHONE || '';
    const branch = studentData.branch || studentData.Branch || studentData.BRANCH || 'Computer Science';
    const semester = studentData.semester || studentData.Semester || studentData.SEMESTER || 3;

    if (!name || !usn) {
      console.warn(`Skipping row ${i + 1}: Missing name or USN`);
      continue;
    }

    // Generate simple password (first 4 chars of name + last 4 digits of USN, or default)
    const password = generatePassword(name, usn, i);

    // Check if user already exists
    let existingUser = await localDB.selectSingle<User>('users', { eq: { email } });
    let userId: string;
    
    if (existingUser) {
      userId = existingUser.id;
      console.log(`User already exists: ${email}`);
    } else {
      userId = generateUUID();
      const user: User = {
        id: userId,
        email,
        password,
        created_at: new Date().toISOString()
      };
      await localDB.insert('users', user);
    }

    // Check if user role already exists
    const existingRole = await localDB.selectSingle<UserRoleRecord>('userRoles', {
      eq: { user_id: userId, role: 'student' }
    });
    
    if (!existingRole) {
      const userRole: UserRoleRecord = {
        id: generateUUID(),
        user_id: userId,
        role: 'student',
        created_at: new Date().toISOString()
      };
      await localDB.insert('userRoles', userRole);
    }

    // Load and convert image to base64
    let photoUrl = '';
    const imageIndex = i < sortedImages.length ? i : i % sortedImages.length;
    const imageFile = sortedImages[imageIndex];
    
    if (imageFile) {
      try {
        const base64 = await fileToBase64(imageFile);
        photoUrl = base64;
      } catch (error) {
        console.warn(`Could not load image ${imageFile.name} for ${name}`);
      }
    }

    // Check if student already exists (by email or USN)
    let existingStudent = await localDB.selectSingle<Student>('students', { eq: { email } });
    if (!existingStudent) {
      existingStudent = await localDB.selectSingle<Student>('students', { eq: { usn: usn.toUpperCase() } });
    }
    
    let studentId: string;
    if (existingStudent) {
      studentId = existingStudent.id;
      // Update existing student if needed
      await localDB.update<Student>('students', { eq: { id: studentId } }, {
        user_id: userId,
        name,
        usn,
        email,
        phone: phone || undefined,
        branch,
        semester: typeof semester === 'number' ? semester : parseInt(String(semester)) || 3,
        photo_url: photoUrl || existingStudent.photo_url || undefined
      });
      console.log(`Updated existing student: ${name} (${usn})`);
    } else {
      studentId = generateUUID();
      const student: Student = {
        id: studentId,
        user_id: userId,
        name,
        usn,
        email,
        phone: phone || undefined,
        branch,
        semester: typeof semester === 'number' ? semester : parseInt(String(semester)) || 3,
        photo_url: photoUrl || undefined,
        created_at: new Date().toISOString()
      };
      await localDB.insert('students', student);
    }

    // Assign to class (split between 2 classes)
    const assignedClass = i < Math.ceil(data.length / 2) ? class1 : class2;
    
    // Check if classStudent relationship already exists
    const existingClassStudent = await localDB.selectSingle<ClassStudent>('classStudents', {
      eq: { class_id: assignedClass.id, student_id: studentId }
    });
    
    if (!existingClassStudent) {
      const classStudent: ClassStudent = {
        id: generateUUID(),
        class_id: assignedClass.id,
        student_id: studentId,
        created_at: new Date().toISOString()
      };
      await localDB.insert('classStudents', classStudent);
    }

    credentials.push({
      email,
      password,
      name,
      usn,
      class: `${assignedClass.branch_name} - ${assignedClass.section_name}`
    });

    console.log(`Imported: ${name} (${usn}) - ${email}`);
  }

  return {
    credentials,
    classes: [class1, class2]
  };
}

function generatePassword(name: string, usn: string, index: number): string {
  // Try to extract numbers from USN
  const usnNumbers = usn.match(/\d+/g)?.join('') || '';
  const last4 = usnNumbers.slice(-4) || String(index + 1).padStart(4, '0');
  const namePart = name.substring(0, 4).toLowerCase().replace(/\s+/g, '') || 'stud';
  return `${namePart}${last4}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function generateCredentialsDocument(
  credentials: Array<{ email: string; password: string; name: string; usn: string; class: string }>,
  classes: Class[]
): string {
  const class1 = classes[0];
  const class2 = classes[1];
  const class1Students = credentials.filter(c => c.class.includes('A'));
  const class2Students = credentials.filter(c => c.class.includes('B'));

  let doc = `# Student Credentials\n\n`;
  doc += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
  doc += `**Total Students:** ${credentials.length}\n\n`;
  doc += `---\n\n`;

  doc += `## ${class1.branch_name} - ${class1.section_name} (${class1Students.length} students)\n\n`;
  doc += `| Name | USN | Email | Password |\n`;
  doc += `|------|-----|-------|----------|\n`;
  class1Students.forEach(c => {
    doc += `| ${c.name} | ${c.usn} | ${c.email} | ${c.password} |\n`;
  });

  doc += `\n---\n\n`;
  doc += `## ${class2.branch_name} - ${class2.section_name} (${class2Students.length} students)\n\n`;
  doc += `| Name | USN | Email | Password |\n`;
  doc += `|------|-----|-------|----------|\n`;
  class2Students.forEach(c => {
    doc += `| ${c.name} | ${c.usn} | ${c.email} | ${c.password} |\n`;
  });

  doc += `\n---\n\n`;
  doc += `## Quick Reference\n\n`;
  doc += `### All Credentials (CSV format)\n\n`;
  doc += `Email,Password,Name,USN,Class\n`;
  credentials.forEach(c => {
    doc += `${c.email},${c.password},"${c.name}",${c.usn},${c.class}\n`;
  });

  return doc;
}

