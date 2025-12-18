import * as XLSX from 'xlsx';
import { localDB, Student, User, UserRoleRecord, Class, ClassStudent } from '../lib/database';
import { generateUUID } from './uuid';
import fs from 'fs';
import path from 'path';

interface StudentData {
  name?: string;
  usn?: string;
  email?: string;
  phone?: string;
  branch?: string;
  semester?: number;
  [key: string]: any;
}

export async function importStudentsFromExcel() {
  const excelPath = path.join(process.cwd(), 'src/data/Copy of test(1).xlsx');
  const imagesPath = path.join(process.cwd(), 'src/data/test_pics');
  
  // Read Excel file
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: StudentData[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} students in Excel file`);

  // Get image files
  const imageFiles = fs.readdirSync(imagesPath).filter(file => 
    /\.(jpg|jpeg|png)$/i.test(file)
  ).sort((a, b) => {
    // Sort by number in filename
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  console.log(`Found ${imageFiles.length} images`);

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

  await localDB.insert('classes', [class1, class2]);
  console.log('Created 2 classes');

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

    // Create user account
    const userId = generateUUID();
    const user: User = {
      id: userId,
      email,
      password,
      created_at: new Date().toISOString()
    };

    await localDB.insert('users', user);

    // Create user role
    const userRole: UserRoleRecord = {
      id: generateUUID(),
      user_id: userId,
      role: 'student',
      created_at: new Date().toISOString()
    };

    await localDB.insert('userRoles', userRole);

    // Load and convert image to base64
    let photoUrl = '';
    const imageIndex = i < imageFiles.length ? i : i % imageFiles.length;
    const imageFile = imageFiles[imageIndex];
    
    if (imageFile) {
      try {
        const imagePath = path.join(imagesPath, imageFile);
        const imageBuffer = fs.readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(imageFile).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        photoUrl = `data:${mimeType};base64,${base64}`;
      } catch (error) {
        console.warn(`Could not load image ${imageFile} for ${name}`);
      }
    }

    // Create student record
    const student: Student = {
      id: generateUUID(),
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

    // Assign to class (split between 2 classes)
    const assignedClass = i < Math.ceil(data.length / 2) ? class1 : class2;
    const classStudent: ClassStudent = {
      id: generateUUID(),
      class_id: assignedClass.id,
      student_id: student.id,
      created_at: new Date().toISOString()
    };

    await localDB.insert('classStudents', classStudent);

    credentials.push({
      email,
      password,
      name,
      usn,
      class: `${assignedClass.branch_name} - ${assignedClass.section_name}`
    });

    console.log(`Imported: ${name} (${usn}) - ${email}`);
  }

  // Generate credentials document
  const credentialsDoc = generateCredentialsDocument(credentials, class1, class2);
  const docPath = path.join(process.cwd(), 'STUDENT_CREDENTIALS.md');
  fs.writeFileSync(docPath, credentialsDoc);
  console.log(`\nCredentials saved to: ${docPath}`);

  return {
    studentsImported: credentials.length,
    classesCreated: 2,
    credentialsPath: docPath
  };
}

function generatePassword(name: string, usn: string, index: number): string {
  // Try to extract numbers from USN
  const usnNumbers = usn.match(/\d+/g)?.join('') || '';
  const last4 = usnNumbers.slice(-4) || String(index + 1).padStart(4, '0');
  const namePart = name.substring(0, 4).toLowerCase().replace(/\s+/g, '') || 'stud';
  return `${namePart}${last4}`;
}

function generateCredentialsDocument(
  credentials: Array<{ email: string; password: string; name: string; usn: string; class: string }>,
  class1: Class,
  class2: Class
): string {
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

