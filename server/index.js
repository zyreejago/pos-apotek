const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'skripsi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create table if not exists
const initDB = async () => {
  try {
    const connection = await pool.getConnection();
    
    // Outlets Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS outlets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        module VARCHAR(100) NOT NULL,
        action ENUM('create','edit','delete','show') NOT NULL,
        allowed TINYINT(1) DEFAULT 0,
        UNIQUE KEY unique_role_perm (role_id, module, action),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);

    // Seed Superadmin
    const [users] = await connection.query('SELECT * FROM users WHERE username = ?', ['superadmin']);
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      try {
        await connection.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['superadmin', hashedPassword, 'superadmin']);
        console.log('Superadmin created: superadmin / password123');
      } catch (insertError) {
        if (insertError.code === 'ER_DUP_ENTRY') {
          console.log('Superadmin already exists (handled race condition)');
        } else {
          throw insertError;
        }
      }
    }

    console.log('Database initialized: tables ready');
    connection.release();
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

initDB();

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

const requireSuperadmin = (req, res, next) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });
  next();
};

const RBAC_MODULES = [
  'Management Product',
  'Management Stock',
  'Outlets',
  'Transactions',
  'Management Cashier',
  'Sales Report',
  'Recommendations Stock',
  'Substitutions',
  'Suppliers',
  'Stock Opname',
  'System Settings'
];

app.get('/api/rbac/modules', authenticate, (req, res) => {
  res.json(RBAC_MODULES);
});

app.get('/api/rbac/roles', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM roles ORDER BY name ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/rbac/roles', authenticate, requireSuperadmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  try {
    const [result] = await pool.query('INSERT INTO roles (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Role exists' });
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/rbac/permissions', authenticate, async (req, res) => {
  const roleId = parseInt(req.query.roleId, 10);
  if (!roleId) return res.status(400).json({ message: 'roleId required' });
  try {
    const [rows] = await pool.query('SELECT module, action, allowed FROM role_permissions WHERE role_id = ?', [roleId]);
    const actions = ['create','edit','delete','show'];
    const result = RBAC_MODULES.map(m => {
      const item = { module: m };
      actions.forEach(a => {
        const r = rows.find(x => x.module === m && x.action === a);
        item[a] = r ? !!r.allowed : false;
      });
      return item;
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/rbac/permissions', authenticate, requireSuperadmin, async (req, res) => {
  const { roleId, module, action, allowed } = req.body;
  if (!roleId || !module || !action) return res.status(400).json({ message: 'Invalid payload' });
  try {
    await pool.query(
      'INSERT INTO role_permissions (role_id, module, action, allowed) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)',
      [roleId, module, action, allowed ? 1 : 0]
    );
    res.json({ roleId, module, action, allowed: !!allowed });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all outlets
app.get('/api/outlets', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM outlets ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching outlets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new outlet
app.post('/api/outlets', async (req, res) => {
  const { name, location } = req.body;
  if (!name || !location) {
    return res.status(400).json({ message: 'Name and location are required' });
  }
  
  try {
    const [result] = await pool.query(
      'INSERT INTO outlets (name, location) VALUES (?, ?)',
      [name, location]
    );
    
    const newOutlet = {
      id: result.insertId,
      name,
      location,
      status: 'Active'
    };
    
    res.status(201).json(newOutlet);
  } catch (error) {
    console.error('Error adding outlet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
