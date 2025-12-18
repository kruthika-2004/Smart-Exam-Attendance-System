import { Student } from '../lib/database';

export interface CSVColumnMapping {
  name?: string;
  usn?: string;
  email?: string;
  phone?: string;
  branch?: string;
  semester?: string;
}

/**
 * Parse CSV text into array of objects with headers as keys
 */
export function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const data: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
export function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function parseCSVFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      const rows = lines.map(line => parseCSVLine(line));
      
      resolve(rows);
    };
    
    reader.onerror = () => reject(new Error('Failed to read CSV file'));
    reader.readAsText(file);
  });
}

export function mapCSVToStudents(
  csvData: string[][] | any[],
  mapping: CSVColumnMapping
): Omit<Student, 'id' | 'created_at'>[] {
  if (csvData.length < 1) {
    throw new Error('CSV file must have at least one data row');
  }

  // Handle both array of arrays and array of objects
  let headers: string[];
  let dataRows: any[];
  
  if (csvData.length > 0 && Array.isArray(csvData[0])) {
    // Array of arrays format
    headers = csvData[0] as string[];
    dataRows = csvData.slice(1);
  } else {
    // Array of objects format (from parseCSV)
    const firstRow = csvData[0] as any;
    headers = Object.keys(firstRow);
    dataRows = csvData as any[];
  }
  
  // Find column indices
  const nameIndex = mapping.name ? headers.indexOf(mapping.name) : -1;
  const usnIndex = mapping.usn ? headers.indexOf(mapping.usn) : -1;
  const emailIndex = mapping.email ? headers.indexOf(mapping.email) : -1;
  const phoneIndex = mapping.phone ? headers.indexOf(mapping.phone) : -1;
  const branchIndex = mapping.branch ? headers.indexOf(mapping.branch) : -1;
  const semesterIndex = mapping.semester ? headers.indexOf(mapping.semester) : -1;

  if (nameIndex === -1 || usnIndex === -1 || emailIndex === -1) {
    throw new Error('Required columns (name, usn, email) must be mapped');
  }

  const students: Omit<Student, 'id' | 'created_at'>[] = [];

  for (const row of dataRows) {
    if (Array.isArray(row) && (row.length === 0 || row.every((cell: any) => !String(cell).trim()))) continue; // Skip empty rows
    
    // Handle both array format and object format
    let name: string, usn: string, email: string;
    
    if (Array.isArray(row)) {
      // Array format
      name = String(row[nameIndex] || '').trim();
      usn = String(row[usnIndex] || '').trim();
      email = String(row[emailIndex] || '').trim();
    } else {
      // Object format
      name = String((row as any)[mapping.name || 'name'] || '').trim();
      usn = String((row as any)[mapping.usn || 'usn'] || '').trim();
      email = String((row as any)[mapping.email || 'email'] || '').trim();
    }

    if (!name || !usn || !email) {
      const rowStr = Array.isArray(row) ? row.join(',') : JSON.stringify(row);
      console.warn(`Skipping row with missing required fields: ${rowStr}`);
      continue;
    }

    // Extract other fields
    let phone: string | undefined;
    let branch: string;
    let semester: number;
    
    if (Array.isArray(row)) {
      phone = phoneIndex >= 0 ? String(row[phoneIndex] || '').trim() : undefined;
      branch = branchIndex >= 0 ? String(row[branchIndex] || '').trim() : 'Unknown';
      semester = semesterIndex >= 0 ? parseInt(String(row[semesterIndex] || '1')) || 1 : 1;
    } else {
      phone = mapping.phone ? String((row as any)[mapping.phone] || '').trim() : undefined;
      branch = mapping.branch ? String((row as any)[mapping.branch] || '').trim() : 'Unknown';
      semester = mapping.semester ? parseInt(String((row as any)[mapping.semester] || '1')) || 1 : 1;
    }

    students.push({
      name,
      usn,
      email,
      phone: phone || undefined,
      branch,
      semester
    });
  }

  return students;
}

