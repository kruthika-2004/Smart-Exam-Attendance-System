import { generateUUID } from './uuid';
import { localDB, Student, User, UserRoleRecord, Class, ClassStudent } from '../lib/database';
import { parseCSV } from './csvImport';

interface StudentData {
  'sl.no'?: string;
  name?: string;
  usn?: string;
  gmail?: string;
  email?: string;
  branch?: string;
  image?: string;
  phone?: string;
  semester?: number;
  [key: string]: any;
}

export async function autoImportStudentsFromData() {
  try {
    // Fetch CSV file
    let csvResponse = await fetch('/data/students.csv');
    if (!csvResponse.ok) {
      throw new Error('Could not load CSV file. Please ensure students.csv is in /public/data/');
    }
    
    const csvText = await csvResponse.text();
    const data: StudentData[] = parseCSV(csvText);
    
    console.log(`Found ${data.length} students in CSV file`);

    // Create a map of image names to base64 data
    const imageMap = new Map<string, string>();
    
    // Load images based on the image column in CSV
    const imageNames = new Set<string>();
    data.forEach(row => {
      if (row.image) {
        imageNames.add(row.image.trim());
      }
    });

    console.log(`Loading ${imageNames.size} unique images...`);

    for (const imgName of Array.from(imageNames)) {
      try {
        let imgResponse = await fetch(`/data/test_pics/${imgName}`);
        if (!imgResponse.ok) {
          console.warn(`Could not load image: ${imgName}`);
          continue;
        }
        const blob = await imgResponse.blob();
        const base64 = await blobToBase64(blob);
        imageMap.set(imgName, base64);
      } catch (e) {
        console.warn(`Error loading ${imgName}:`, e);
      }
    }

    console.log(`Loaded ${imageMap.size} images`);

    // Group students by branch to create classes
    const branchGroups = new Map<string, StudentData[]>();
    data.forEach(student => {
      const branch = (student.branch || 'General').trim();
      if (!branchGroups.has(branch)) {
        branchGroups.set(branch, []);
      }
      branchGroups.get(branch)!.push(student);
    });

    console.log(`Found ${branchGroups.size} branches:`, Array.from(branchGroups.keys()));

    // Create classes for each branch (split into A and B if more than 20 students)
    const classes: Class[] = [];
    const branchClassMap = new Map<string, { classA: Class; classB?: Class }>();

    for (const [branch, students] of branchGroups.entries()) {
      const classA: Class = {
        id: generateUUID(),
        branch_name: branch,
        section_name: 'A',
        academic_year: '2024-2025',
        description: `${branch} - Section A`,
        created_at: new Date().toISOString(),
        created_by: 'system'
      };

      // Check if class already exists
      const existingClasses = await localDB.select<Class>('classes', {});
      const existingClassA = existingClasses.find(c => 
        c.branch_name === classA.branch_name && c.section_name === classA.section_name
      );
      
      if (existingClassA) {
        classA.id = existingClassA.id;
        console.log(`Using existing class: ${branch} - A`);
      } else {
        await localDB.insert('classes', classA);
        console.log(`Created class: ${branch} - A`);
      }
      classes.push(classA);

      // Create class B if there are more than 20 students in this branch
      if (students.length > 20) {
        const classB: Class = {
          id: generateUUID(),
          branch_name: branch,
          section_name: 'B',
          academic_year: '2024-2025',
          description: `${branch} - Section B`,
          created_at: new Date().toISOString(),
          created_by: 'system'
        };

        const existingClassB = existingClasses.find(c => 
          c.branch_name === classB.branch_name && c.section_name === classB.section_name
        );
        
        if (existingClassB) {
          classB.id = existingClassB.id;
          console.log(`Using existing class: ${branch} - B`);
        } else {
          await localDB.insert('classes', classB);
          console.log(`Created class: ${branch} - B`);
        }
        classes.push(classB);
        branchClassMap.set(branch, { classA, classB });
      } else {
        branchClassMap.set(branch, { classA });
      }
    }

    const credentials: Array<{ email: string; password: string; name: string; usn: string; class: string }> = [];

    // Process each student
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Extract data from CSV
      const name = (row.name || '').trim();
      const usn = (row.usn || '').trim().toUpperCase();
      const email = (row.gmail || row.email || '').trim().toLowerCase();
      const branch = (row.branch || 'General').trim();
      const imageName = (row.image || '').trim();
      const phone = (row.phone || '').trim();
      const semester = row.semester ? parseInt(String(row.semester)) : 3;

      if (!name || !usn) {
        console.warn(`Skipping row ${i + 1}: Missing name or USN`);
        continue;
      }

      if (!email) {
        console.warn(`Skipping ${name} (${usn}): Missing email`);
        continue;
      }

      // Generate simple password
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

      // Get image from map
      let photoUrl = '';
      if (imageName && imageMap.has(imageName)) {
        photoUrl = imageMap.get(imageName)!;
      }

      // Check if student already exists (by email or USN)
      let existingStudent = await localDB.selectSingle<Student>('students', { eq: { email } });
      if (!existingStudent) {
        existingStudent = await localDB.selectSingle<Student>('students', { eq: { usn } });
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
          semester,
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
          semester,
          photo_url: photoUrl || undefined,
          created_at: new Date().toISOString()
        };
        await localDB.insert('students', student);
      }

      // Assign to class based on branch
      const branchClasses = branchClassMap.get(branch);
      if (!branchClasses) {
        console.warn(`No class found for branch: ${branch}`);
        continue;
      }

      // If branch has both A and B, split students between them
      let assignedClass: Class;
      if (branchClasses.classB) {
        // Split: first half to A, second half to B
        const branchStudents = branchGroups.get(branch) || [];
        const studentIndex = branchStudents.findIndex(s => 
          (s.usn || '').trim().toUpperCase() === usn
        );
        const midPoint = Math.ceil(branchStudents.length / 2);
        assignedClass = studentIndex < midPoint ? branchClasses.classA : branchClasses.classB;
      } else {
        assignedClass = branchClasses.classA;
      }
    
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

      console.log(`Imported: ${name} (${usn}) - ${email} - ${assignedClass.branch_name} ${assignedClass.section_name}`);
    }

    // Generate credentials document
    const credentialsDoc = generateCredentialsDocument(credentials, classes);
    
    // Download credentials
    const blob = new Blob([credentialsDoc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `STUDENT_CREDENTIALS_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      studentsImported: credentials.length,
      classesCreated: classes.length,
      credentials
    };
  } catch (error: any) {
    console.error('Import error:', error);
    throw error;
  }
}

function generatePassword(name: string, usn: string, index: number): string {
  const usnNumbers = usn.match(/\d+/g)?.join('') || '';
  const last4 = usnNumbers.slice(-4) || String(index + 1).padStart(4, '0');
  const namePart = name.substring(0, 4).toLowerCase().replace(/\s+/g, '') || 'stud';
  return `${namePart}${last4}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function generateCredentialsDocument(
  credentials: Array<{ email: string; password: string; name: string; usn: string; class: string }>,
  classes: Class[]
): string {
  // Group credentials by class
  const classGroups = new Map<string, typeof credentials>();
  
  classes.forEach(cls => {
    const classKey = `${cls.branch_name} - ${cls.section_name}`;
    classGroups.set(classKey, credentials.filter(c => c.class === classKey));
  });

  let doc = `# Student Credentials\n\n`;
  doc += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
  doc += `**Total Students:** ${credentials.length}\n\n`;
  doc += `**Total Classes:** ${classes.length}\n\n`;
  doc += `---\n\n`;

  // Generate section for each class
  classes.forEach(cls => {
    const classKey = `${cls.branch_name} - ${cls.section_name}`;
    const classStudents = classGroups.get(classKey) || [];
    
    if (classStudents.length > 0) {
      doc += `## ${classKey} (${classStudents.length} students)\n\n`;
      doc += `| Name | USN | Email | Password |\n`;
      doc += `|------|-----|-------|----------|\n`;
      classStudents.forEach(c => {
        doc += `| ${c.name} | ${c.usn} | ${c.email} | ${c.password} |\n`;
      });
      doc += `\n---\n\n`;
    }
  });

  doc += `## Quick Reference\n\n`;
  doc += `### All Credentials (CSV format)\n\n`;
  doc += `Email,Password,Name,USN,Class\n`;
  credentials.forEach(c => {
    doc += `${c.email},${c.password},"${c.name}",${c.usn},${c.class}\n`;
  });

  return doc;
}
