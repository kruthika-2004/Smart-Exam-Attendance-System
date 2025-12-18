import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // For base64 images

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'facexam.db');

// Initialize SQLite database (shared across network)
let SQL;
let db;

async function initDatabase() {
  SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log(`📦 Database loaded from: ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log(`📦 New database created at: ${DB_PATH}`);
  }
  
  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role TEXT,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      usn TEXT,
      email TEXT,
      phone TEXT,
      branch TEXT,
      semester INTEGER,
      photo_url TEXT,
      descriptor TEXT,
      descriptor_computed_at TEXT,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      branch_name TEXT,
      section_name TEXT,
      academic_year TEXT,
      description TEXT,
      created_at TEXT,
      created_by TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      class_id TEXT,
      start_at TEXT,
      duration_minutes INTEGER,
      status TEXT,
      notes TEXT,
      created_at TEXT,
      created_by TEXT,
      ended_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      student_id TEXT,
      timestamp TEXT,
      method TEXT,
      confidence REAL,
      device_id TEXT,
      marked_by TEXT,
      marks INTEGER,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS class_students (
      id TEXT PRIMARY KEY,
      class_id TEXT,
      student_id TEXT,
      created_at TEXT,
      UNIQUE(class_id, student_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
    CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
    CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);
  `);
  
  // Save database after initialization
  saveDatabase();
  console.log('✅ Database tables initialized');
}

function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Initialize database
await initDatabase();

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'FaceXam API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      info: '/api/info',
      select: '/api/select (POST)',
      insert: '/api/insert (POST)',
      update: '/api/update (POST)',
      delete: '/api/delete (POST)',
      count: '/api/count (POST)'
    },
    note: 'This is an API server. Access the frontend application on port 5173.'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'FaceXam Server is running',
    database: DB_PATH,
    timestamp: new Date().toISOString()
  });
});

// Get server info
app.get('/api/info', async (req, res) => {
  try {
    const os = await import('os');
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }
    
    res.json({
      port: PORT,
      database: DB_PATH,
      networkAddresses: addresses,
      accessUrl: addresses.length > 0 ? `http://${addresses[0]}:${PORT}` : `http://localhost:${PORT}`
    });
  } catch (err) {
    res.json({
      port: PORT,
      database: DB_PATH,
      networkAddresses: [],
      accessUrl: `http://localhost:${PORT}`
    });
  }
});

// Generic select endpoint
app.post('/api/select', (req, res) => {
  try {
    const { table, filters } = req.body;
    
    // Map table names
    const tableMap = {
      'users': 'users',
      'userRoles': 'user_roles',
      'students': 'students',
      'classes': 'classes',
      'sessions': 'sessions',
      'attendance': 'attendance',
      'classStudents': 'class_students'
    };
    
    const dbTable = tableMap[table] || table;
    let query = `SELECT * FROM ${dbTable}`;
    const params = [];
    
    if (filters?.eq) {
      const conditions = Object.entries(filters.eq).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    if (filters?.orderBy) {
      const direction = filters.orderBy.ascending !== false ? 'ASC' : 'DESC';
      query += ` ORDER BY ${filters.orderBy.column} ${direction}`;
    }
    
    if (filters?.limit) {
      query += ` LIMIT ${filters.limit}`;
    }
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();
    res.json(results);
  } catch (error) {
    console.error('Select error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Select single endpoint
app.post('/api/selectSingle', (req, res) => {
  try {
    const { table, filters } = req.body;
    
    const tableMap = {
      'users': 'users',
      'userRoles': 'user_roles',
      'students': 'students',
      'classes': 'classes',
      'sessions': 'sessions',
      'attendance': 'attendance',
      'classStudents': 'class_students'
    };
    
    const dbTable = tableMap[table] || table;
    let query = `SELECT * FROM ${dbTable}`;
    const params = [];
    
    if (filters?.eq) {
      const conditions = Object.entries(filters.eq).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    query += ' LIMIT 1';
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    res.json(result);
  } catch (error) {
    console.error('SelectSingle error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Count endpoint
app.post('/api/count', (req, res) => {
  try {
    const { table, filters } = req.body;
    
    const tableMap = {
      'users': 'users',
      'userRoles': 'user_roles',
      'students': 'students',
      'classes': 'classes',
      'sessions': 'sessions',
      'attendance': 'attendance',
      'classStudents': 'class_students'
    };
    
    const dbTable = tableMap[table] || table;
    let query = `SELECT COUNT(*) as count FROM ${dbTable}`;
    const params = [];
    
    if (filters?.eq) {
      const conditions = Object.entries(filters.eq).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    let count = 0;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      count = row.count || 0;
    }
    stmt.free();
    res.json(count);
  } catch (error) {
    console.error('Count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generic insert endpoint
app.post('/api/insert', (req, res) => {
  try {
    const { table, data } = req.body;
    
    const tableMap = {
      'users': 'users',
      'userRoles': 'user_roles',
      'students': 'students',
      'classes': 'classes',
      'sessions': 'sessions',
      'attendance': 'attendance',
      'classStudents': 'class_students'
    };
    
    const dbTable = tableMap[table] || table;
    const items = Array.isArray(data) ? data : [data];
    
    for (const item of items) {
      const keys = Object.keys(item);
      const values = Object.values(item);
      const placeholders = keys.map(() => '?').join(', ');
      const query = `INSERT OR REPLACE INTO ${dbTable} (${keys.join(', ')}) VALUES (${placeholders})`;
      const stmt = db.prepare(query);
      stmt.bind(values);
      stmt.step();
      stmt.free();
    }
    
    // Save database after insert
    saveDatabase();
    
    res.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Insert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generic update endpoint
app.post('/api/update', (req, res) => {
  try {
    const { table, filters, updates } = req.body;
    
    const tableMap = {
      'users': 'users',
      'userRoles': 'user_roles',
      'students': 'students',
      'classes': 'classes',
      'sessions': 'sessions',
      'attendance': 'attendance',
      'classStudents': 'class_students'
    };
    
    const dbTable = tableMap[table] || table;
    const updateClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);
    
    let query = `UPDATE ${dbTable} SET ${updateClause}`;
    const params = [...updateValues];
    
    if (filters?.eq) {
      const conditions = Object.entries(filters.eq).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    stmt.step();
    const changes = db.getRowsModified();
    stmt.free();
    
    // Save database after update
    saveDatabase();
    
    res.json({ success: true, changes });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generic delete endpoint
app.post('/api/delete', (req, res) => {
  try {
    const { table, filters } = req.body;
    
    const tableMap = {
      'users': 'users',
      'userRoles': 'user_roles',
      'students': 'students',
      'classes': 'classes',
      'sessions': 'sessions',
      'attendance': 'attendance',
      'classStudents': 'class_students'
    };
    
    const dbTable = tableMap[table] || table;
    let query = `DELETE FROM ${dbTable}`;
    const params = [];
    
    if (filters?.eq) {
      const conditions = Object.entries(filters.eq).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    stmt.step();
    const changes = db.getRowsModified();
    stmt.free();
    
    // Save database after delete
    saveDatabase();
    
    res.json({ success: true, changes });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FaceXam Server running on port ${PORT}`);
  console.log(`📡 Access from network: http://[YOUR_IP]:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
