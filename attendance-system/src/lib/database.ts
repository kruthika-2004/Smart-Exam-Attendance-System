import Dexie, { Table } from 'dexie';
import { generateUUID } from '../utils/uuid';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  password: string; // In a real app, this would be hashed
  created_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Class {
  id: string;
  branch_name: string;
  section_name: string;
  academic_year?: string;
  description?: string;
  created_at: string;
  created_by: string;
}

export interface Student {
  id: string;
  user_id?: string;
  name: string;
  usn: string;
  email: string;
  phone?: string;
  branch: string;
  semester: number;
  photo_url?: string;
  descriptor?: number[];
  descriptor_computed_at?: string;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  class_id: string;
  start_at: string;
  duration_minutes: number;
  status: 'upcoming' | 'live' | 'ended';
  notes?: string;
  created_at: string;
  created_by: string;
  ended_at?: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  timestamp: string;
  method: 'face' | 'manual';
  confidence?: number;
  device_id?: string;
  marked_by: string;
  marks?: number; // Marks out of 100
  created_at: string;
}

export interface ClassStudent {
  id: string;
  class_id: string;
  student_id: string;
  created_at: string;
}

class LocalDatabase extends Dexie {
  users!: Table<User>;
  userRoles!: Table<UserRoleRecord>;
  students!: Table<Student>;
  classes!: Table<Class>;
  sessions!: Table<Session>;
  attendance!: Table<Attendance>;
  classStudents!: Table<ClassStudent>;

  constructor() {
    super('FaceXamDB');
    this.version(1).stores({
      users: 'id, email',
      userRoles: 'id, user_id, role',
      students: 'id, user_id, usn, email',
      classes: 'id, created_by',
      sessions: 'id, class_id, created_by, start_at',
      attendance: 'id, session_id, student_id, timestamp'
    });
    this.version(2).stores({
      users: 'id, email',
      userRoles: 'id, user_id, role',
      students: 'id, user_id, usn, email',
      classes: 'id, created_by',
      sessions: 'id, class_id, created_by, start_at',
      attendance: 'id, session_id, student_id, timestamp',
      classStudents: 'id, class_id, student_id'
    }).upgrade(async () => {
      // Migration from version 1 to 2 - classStudents table will be created automatically
    });
    this.version(3).stores({
      users: 'id, email',
      userRoles: 'id, user_id, role',
      students: 'id, user_id, usn, email',
      classes: 'id, created_by',
      sessions: 'id, class_id, created_by, start_at, status',
      attendance: 'id, session_id, student_id, timestamp',
      classStudents: 'id, class_id, student_id'
    }).upgrade(async () => {
      // Migration from version 2 to 3 - add status index to sessions
      // The index will be created automatically
    });
  }
}

export const db = new LocalDatabase();

// Configuration for remote server mode
const getServerUrl = (): string | null => {
  return localStorage.getItem('facexam_server_url') || null;
};

const setServerUrl = (url: string | null) => {
  if (url) {
    localStorage.setItem('facexam_server_url', url);
  } else {
    localStorage.removeItem('facexam_server_url');
  }
};

export const getServerInfo = async (): Promise<{ port: number; networkAddresses: string[]; accessUrl: string } | null> => {
  const serverUrl = getServerUrl();
  if (!serverUrl) return null;
  
  try {
    const response = await fetch(`${serverUrl}/api/info`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching server info:', error);
  }
  return null;
};

// Check if server is available
const checkServerHealth = async (): Promise<boolean> => {
  const serverUrl = getServerUrl();
  if (!serverUrl) return false;
  
  try {
    const response = await fetch(`${serverUrl}/api/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

// Remote API helpers
const remoteDB = {
  async select<T>(tableName: string, filters?: any): Promise<T[]> {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');
    
    const response = await fetch(`${serverUrl}/api/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableName, filters })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    
    return await response.json();
  },

  async selectSingle<T>(tableName: string, filters?: any): Promise<T | null> {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');
    
    const response = await fetch(`${serverUrl}/api/selectSingle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableName, filters })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    
    return await response.json();
  },

  async insert<T>(tableName: string, data: T | T[]): Promise<void> {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');
    
    const response = await fetch(`${serverUrl}/api/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableName, data })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Server error: ${response.statusText}`);
    }
  },

  async update<T>(tableName: string, filters: any, updates: Partial<T>): Promise<void> {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');
    
    const response = await fetch(`${serverUrl}/api/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableName, filters, updates })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Server error: ${response.statusText}`);
    }
  },

  async delete(tableName: string, filters: any): Promise<void> {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');
    
    const response = await fetch(`${serverUrl}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableName, filters })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Server error: ${response.statusText}`);
    }
  },

  async count(tableName: string, filters?: any): Promise<number> {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');
    
    const response = await fetch(`${serverUrl}/api/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: tableName, filters })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    
    return await response.json();
  }
};

// Helper functions to simulate Supabase-like API
// This now supports both local (IndexedDB) and remote (HTTP API) modes
export const localDB = {
  // Get current mode
  isRemoteMode(): boolean {
    return getServerUrl() !== null;
  },

  getServerUrl(): string | null {
    return getServerUrl();
  },

  setServerUrl(url: string | null) {
    setServerUrl(url);
  },

  async checkServerConnection(): Promise<boolean> {
    return await checkServerHealth();
  },
  // Auth helpers
  async getCurrentUser(): Promise<User | null> {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return null;
    
    if (this.isRemoteMode()) {
      return await remoteDB.selectSingle<User>('users', { eq: { id: userId } });
    }
    
    return await db.users.get(userId) || null;
  },

  async setCurrentUser(userId: string | null) {
    if (userId) {
      localStorage.setItem('current_user_id', userId);
    } else {
      localStorage.removeItem('current_user_id');
    }
  },

  // User operations
  async signIn(email: string, password: string): Promise<User> {
    let user: User | null;
    
    if (this.isRemoteMode()) {
      user = await remoteDB.selectSingle<User>('users', { eq: { email } });
    } else {
      user = await db.users.where('email').equals(email).first() || null;
    }
    
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password');
    }
    await this.setCurrentUser(user.id);
    return user;
  },

  async signUp(email: string, password: string, role: UserRole): Promise<User> {
    // Check if user already exists
    let existingUser: User | null;
    if (this.isRemoteMode()) {
      existingUser = await remoteDB.selectSingle<User>('users', { eq: { email } });
    } else {
      existingUser = await db.users.where('email').equals(email).first() || null;
    }
    
    if (existingUser) {
      throw new Error('User already exists');
    }

    const userId = generateUUID();
    const now = new Date().toISOString();

    const user: User = {
      id: userId,
      email,
      password, // In production, hash this
      created_at: now
    };

    if (this.isRemoteMode()) {
      await remoteDB.insert('users', user);
    } else {
      await db.users.add(user);
    }

    const userRole: UserRoleRecord = {
      id: generateUUID(),
      user_id: userId,
      role,
      created_at: now
    };

    if (this.isRemoteMode()) {
      await remoteDB.insert('userRoles', userRole);
    } else {
      await db.userRoles.add(userRole);
    }
    
    await this.setCurrentUser(userId);
    return user;
  },

  async signOut() {
    await this.setCurrentUser(null);
  },

  async getUserRole(userId: string): Promise<UserRole | null> {
    let roleRecord: UserRoleRecord | null;
    
    if (this.isRemoteMode()) {
      roleRecord = await remoteDB.selectSingle<UserRoleRecord>('userRoles', { eq: { user_id: userId } });
    } else {
      roleRecord = await db.userRoles.where('user_id').equals(userId).first() || null;
    }
    
    return roleRecord?.role || null;
  },

  // Generic query helpers
  async select<T>(
    tableName: 'users' | 'userRoles' | 'students' | 'classes' | 'sessions' | 'attendance' | 'classStudents',
    filters?: {
      eq?: { [key: string]: any };
      in?: { [key: string]: any[] };
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    }
  ): Promise<T[]> {
    // Use remote mode if server URL is configured
    if (this.isRemoteMode()) {
      try {
        return await remoteDB.select<T>(tableName, filters);
      } catch (error: any) {
        console.error('Remote query failed, falling back to local:', error);
        // Fallback to local on error
      }
    }
    
    // Local IndexedDB mode
    const table = db.table(tableName);
    let query: any = table.toCollection();

    // Apply filters - use indexed queries when possible
    if (filters?.eq) {
      const eqEntries = Object.entries(filters.eq);
      if (eqEntries.length > 0) {
        const [firstKey, firstValue] = eqEntries[0];
        // Try to use indexed query if the key is indexed
        try {
          query = table.where(firstKey).equals(firstValue);
        } catch (indexError) {
          // Fallback to filter if index doesn't exist
          console.warn(`Index not found for ${tableName}.${firstKey}, using filter instead`);
          query = table.toCollection().filter((item: any) => item[firstKey] === firstValue);
        }
        
        // Apply remaining filters
        for (let i = 1; i < eqEntries.length; i++) {
          const [key, value] = eqEntries[i];
          query = query.filter((item: any) => item[key] === value);
        }
      }
    }

    let results: any[] = [];
    try {
      results = await query.toArray();
    } catch (error) {
      console.error(`Error querying ${tableName}:`, error);
      return [];
    }

    // Apply 'in' filters
    if (filters?.in) {
      for (const [key, values] of Object.entries(filters.in)) {
        results = results.filter((item: any) => values.includes(item[key]));
      }
    }

    // Apply ordering
    if (filters?.orderBy) {
      const { column, ascending = true } = filters.orderBy;
      results.sort((a: any, b: any) => {
        const aVal = a[column];
        const bVal = b[column];
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results as T[];
  },

  async selectSingle<T>(
    tableName: 'users' | 'userRoles' | 'students' | 'classes' | 'sessions' | 'attendance' | 'classStudents',
    filters?: { eq?: { [key: string]: any } }
  ): Promise<T | null> {
    if (this.isRemoteMode()) {
      try {
        return await remoteDB.selectSingle<T>(tableName, filters);
      } catch (error: any) {
        console.error('Remote query failed, falling back to local:', error);
      }
    }
    
    const results = await this.select<T>(tableName, filters);
    return results[0] || null;
  },

  async insert<T extends { id?: string }>(
    tableName: 'users' | 'userRoles' | 'students' | 'classes' | 'sessions' | 'attendance' | 'classStudents',
    data: T | T[]
  ): Promise<void> {
    const items = Array.isArray(data) ? data : [data];
    const itemsWithIds = items.map(item => ({
      ...item,
      id: item.id || generateUUID()
    }));
    
    if (this.isRemoteMode()) {
      try {
        await remoteDB.insert(tableName, itemsWithIds);
        return;
      } catch (error: any) {
        console.error('Remote insert failed, falling back to local:', error);
      }
    }
    
    // Local IndexedDB mode
    const table = db.table(tableName);
    for (const item of itemsWithIds) {
      await table.put(item as any);
    }
  },

  async update<T>(
    tableName: 'users' | 'userRoles' | 'students' | 'classes' | 'sessions' | 'attendance' | 'classStudents',
    filters: { eq: { [key: string]: any } },
    updates: Partial<T>
  ): Promise<void> {
    if (this.isRemoteMode()) {
      try {
        await remoteDB.update(tableName, filters, updates);
        return;
      } catch (error: any) {
        console.error('Remote update failed, falling back to local:', error);
      }
    }
    
    // Local IndexedDB mode
    const results = await this.select<any>(tableName, filters);
    for (const item of results) {
      await db.table(tableName).update(item.id, updates);
    }
  },

  async delete(
    tableName: 'users' | 'userRoles' | 'students' | 'classes' | 'sessions' | 'attendance' | 'classStudents',
    filters: { eq: { [key: string]: any } }
  ): Promise<void> {
    if (this.isRemoteMode()) {
      try {
        await remoteDB.delete(tableName, filters);
        return;
      } catch (error: any) {
        console.error('Remote delete failed, falling back to local:', error);
      }
    }
    
    // Local IndexedDB mode
    const results = await this.select<any>(tableName, filters);
    const ids = results.map(item => item.id);
    await db.table(tableName).bulkDelete(ids);
  },

  async count(
    tableName: 'users' | 'userRoles' | 'students' | 'classes' | 'sessions' | 'attendance' | 'classStudents',
    filters?: { eq?: { [key: string]: any } }
  ): Promise<number> {
    if (this.isRemoteMode()) {
      try {
        return await remoteDB.count(tableName, filters);
      } catch (error: any) {
        console.error('Remote count failed, falling back to local:', error);
      }
    }
    
    // Local IndexedDB mode
    try {
      const results = await this.select<any>(tableName, filters || {});
      return results.length;
    } catch (error) {
      console.error(`Error counting ${tableName}:`, error);
      return 0;
    }
  }
};

