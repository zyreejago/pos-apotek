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
  ...(process.env.DB_SOCKET_PATH && { socketPath: process.env.DB_SOCKET_PATH }),
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

    // Products Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        stock INT DEFAULT 0,
        price DECIMAL(10, 2) DEFAULT 0,
        unit VARCHAR(50),
        expired_date DATE,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns/rename columns if needed
    try {
      await connection.query(`ALTER TABLE products CHANGE price cost_price DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {
      // Ignore if column doesn't exist or already renamed
    }
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN selling_price DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN unit VARCHAR(50)`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN expired_date DATE`);
    } catch (e) {}

    // Transactions Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        outlet_id INT,
        total_amount DECIMAL(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL
      )
    `);

    // Transaction Items Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Suppliers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inventory History Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        type ENUM('sale', 'restock', 'opname', 'adjustment') NOT NULL,
        quantity_change INT NOT NULL,
        previous_stock INT NOT NULL,
        new_stock INT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Add outlet_id to users if not exists
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN outlet_id INT DEFAULT NULL`);
    } catch (e) {
      // Ignore if column already exists
    }

    // Add status to users if not exists
    try {
      await connection.query(`ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'`);
    } catch (e) {
      // Ignore if column already exists
    }

    // Seed Suppliers
    const [suppliers] = await connection.query('SELECT * FROM suppliers');
    if (suppliers.length === 0) {
      const supplierNames = [
        'PT. Intan Surya Prima Abadi',
        'PT. Buana Saraswati',
        'PT. Budhi Kurniawan Sejati',
        'PT. JAVAS BALI LESTARI',
        'PT. SAKAJAJA MAKMUR ABADI',
        'PT. Mulia Abdi Sentosa',
        'PT. SEHAT INTI PERMATA',
        'PT. SAPTA SARI TAMA',
        'PT. Marga Nusantara Jaya',
        'PT. AMARA PERKASA MEDIKA'
      ];

      for (const name of supplierNames) {
        await connection.query(
          'INSERT INTO suppliers (name, contact_person, phone, address) VALUES (?, ?, ?, ?)',
          [name, 'John Doe', '08123456789', 'Jl. Supplier No. 1']
        );
      }
      console.log('Seeded suppliers');
    }

    // Seed Data
    // Check if valid data exists (Sanmol Tab with valid expiry and correct casing)
    const [validProducts] = await connection.query('SELECT * FROM products WHERE BINARY name = ? AND expired_date IS NOT NULL', ['Sanmol Tab']);
    
    // If not found (or invalid/wrong casing), clear and seed everything
    if (validProducts.length === 0) {
      console.log('Seeding new medicine products and transactions...');
      
      // Clear existing
      await connection.query('DELETE FROM products');
      await connection.query('DELETE FROM transactions');
      
      const newProducts = [
        { name: 'Sanmol Tab', stock: 150, expired: '2027-05-01', cost: 2008, unit: 'STRIP' },
        { name: 'Paracetamol Tab', stock: 200, expired: '2029-05-01', cost: 1859, unit: 'STRIP' },
        { name: 'Imboost Force Kaplet', stock: 120, expired: '2028-02-01', cost: 6238, unit: 'KAPLET' },
        { name: 'Vicee Orange', stock: 500, expired: '2027-03-01', cost: 646, unit: 'TABLET' },
        { name: 'Amlodipine 5mg Tab', stock: 100, expired: '2027-01-06', cost: 2558, unit: 'STRIP' },
        { name: 'Cetirizine 10 mg Tab', stock: 100, expired: '2027-04-01', cost: 2470, unit: 'STRIP' },
        { name: 'Paramex Tab', stock: 75, expired: '2027-01-04', cost: 2344, unit: 'STRIP' },
        { name: 'Enervon C', stock: 75, expired: '2027-03-30', cost: 4609, unit: 'STRIP' },
        { name: 'Ambroxol Tab', stock: 100, expired: '2028-06-01', cost: 1207, unit: 'STRIP' },
        { name: 'Metformin Tab', stock: 80, expired: '2027-04-01', cost: 2173, unit: 'STRIP' },
        { name: 'Demacolin Tab', stock: 150, expired: '2028-11-01', cost: 5200, unit: 'STRIP' },
        { name: 'Tera-F Tab', stock: 50, expired: '2028-03-01', cost: 4520, unit: 'STRIP' },
        { name: 'Fasidol Tab', stock: 80, expired: '2029-06-01', cost: 2890, unit: 'STRIP' },
        { name: 'Hufagripp Flu', stock: 12, expired: '2028-04-01', cost: 21770, unit: 'BOTOL' },
        { name: 'Kool Fever Anak', stock: 56, expired: '2027-12-01', cost: 5947, unit: 'SACHET' },
        { name: 'Test Pack One Med', stock: 50, expired: '2028-01-01', cost: 1520, unit: 'STRIP' },
        { name: 'Caviplex Tab', stock: 60, expired: '2027-01-08', cost: 6934, unit: 'STRIP' },
        { name: 'Micoral Cr', stock: 52, expired: '2028-05-01', cost: 4460, unit: 'TUBE' },
        { name: 'Ketokonazole Cr', stock: 24, expired: '2027-06-01', cost: 5100, unit: 'TUBE' },
        { name: 'Sutra Ok 3 S', stock: 75, expired: '2029-10-01', cost: 7414, unit: 'STRIP' }
      ];

      for (const p of newProducts) {
        // Calculate selling price (approx 20-30% margin, rounded to nearest 100)
        const margin = 1.25;
        let selling = Math.ceil((p.cost * margin) / 100) * 100;
        
        await connection.query(
          'INSERT INTO products (name, stock, cost_price, selling_price, unit, expired_date, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [p.name, p.stock, p.cost, selling, p.unit, p.expired, 'Medicine']
        );
      }
      console.log('Seeded new medicine products');
      
      // Seed Transactions for December 2025
      console.log('Seeding December 2025 transactions...');
      const outletIds = [1, 2]; // Assuming IDs 1 and 2 exist from outlets seed
       
      // Generate for each day in December 2025
      for (let day = 1; day <= 31; day++) {
        // Create 1-5 random transactions per day
        const numTrans = Math.floor(Math.random() * 5) + 1;
         
        for (let i = 0; i < numTrans; i++) {
          const outletId = outletIds[Math.floor(Math.random() * outletIds.length)];
          // Random total amount between 50,000 and 500,000
          const amount = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
           
          // Create date string YYYY-MM-DD HH:MM:SS
          // Note: Months are 0-indexed in JS Date, so 11 is December
          const date = new Date(2025, 11, day, Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0);
           
          await connection.query(
            'INSERT INTO transactions (outlet_id, total_amount, transaction_date) VALUES (?, ?, ?)',
            [outletId, amount, date]
          );
        }
      }
      console.log('Seeded transactions for Dec 2025');
    }

    const [outlets] = await connection.query('SELECT * FROM outlets');
    if (outlets.length === 0) {
      await connection.query(`
        INSERT INTO outlets (name, location) VALUES 
        ('Cabang XYZ', 'Baktiseraga'),
        ('Cabang ABC', 'Banyuning')
      `);
      console.log('Seeded outlets');
    }



    // Seed Cashiers (Users)
    const [cashiers] = await connection.query('SELECT * FROM users WHERE role = ?', ['cashier']);
    if (cashiers.length === 0) {
       const pwd = await bcrypt.hash('123456', 10);
       // Get outlet IDs
       const [allOutlets] = await connection.query('SELECT id FROM outlets');
       if (allOutlets.length >= 2) {
           await connection.query('INSERT INTO users (username, password, role, outlet_id) VALUES (?, ?, ?, ?)', ['kasir1', pwd, 'cashier', allOutlets[0].id]);
           await connection.query('INSERT INTO users (username, password, role, outlet_id) VALUES (?, ?, ?, ?)', ['kasir2', pwd, 'cashier', allOutlets[0].id]);
           await connection.query('INSERT INTO users (username, password, role, outlet_id) VALUES (?, ?, ?, ?)', ['kasir3', pwd, 'cashier', allOutlets[1].id]);
       }
       console.log('Seeded cashiers');
    }

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

    // Migration: Rename Modules
    try {
      await connection.query("UPDATE role_permissions SET module = 'Peramalan Stok' WHERE module = 'Recommendations Stock'");
      await connection.query("UPDATE role_permissions SET module = 'Management Pengguna' WHERE module = 'Management Cashier'");
    } catch (e) {
      // Ignore if fails, or maybe log it
      console.log('Migration of module names skipped or failed:', e.message);
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

const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    if (req.user.role === 'superadmin') return next();
    
    try {
      const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', [req.user.role]);
      if (roles.length === 0) return res.status(403).json({ message: 'Forbidden' });
      
      const roleId = roles[0].id;
      const [perms] = await pool.query(
        'SELECT allowed FROM role_permissions WHERE role_id = ? AND module = ? AND action = ?',
        [roleId, moduleName, action]
      );
      
      if (perms.length > 0 && perms[0].allowed) {
        next();
      } else {
        res.status(403).json({ message: 'Forbidden' });
      }
    } catch (e) {
      console.error('Permission check error:', e);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

const RBAC_MODULES = [
  'Management Product',
  'Management Stock',
  'Outlets',
  'Transactions',
  'Management Pengguna',
  'Sales Report',
  'Peramalan Stok',
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

app.delete('/api/rbac/roles/:id', authenticate, requireSuperadmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ID' });
  try {
    // Prevent deleting superadmin role (assuming id 1 is superadmin or by name)
    // Let's check if it is 'superadmin' role name, but here we just check ID 1 for simplicity or query
    const [role] = await pool.query('SELECT name FROM roles WHERE id = ?', [id]);
    if (role.length === 0) return res.status(404).json({ message: 'Role not found' });
    if (role[0].name.toLowerCase() === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete superadmin role' });
    }

    await pool.query('DELETE FROM roles WHERE id = ?', [id]);
    await pool.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    res.json({ message: 'Role deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/rbac/permissions', authenticate, async (req, res) => {
  const roleId = parseInt(req.query.roleId, 10);
  const roleName = req.query.roleName;

  if (!roleId && !roleName) return res.status(400).json({ message: 'roleId or roleName required' });
  
  try {
    let targetRoleId = roleId;

    // If roleName provided, look up ID
    if (!targetRoleId && roleName) {
      const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
      if (roles.length > 0) {
        targetRoleId = roles[0].id;
      } else {
        // If role not found in roles table, return all false (or handle default)
        // For superadmin, maybe we want to return all true? 
        // But usually superadmin should be in roles table too if managed via RBAC.
        // If hardcoded superadmin user exists but not in roles table, we might have issues.
        // For now, let's assume roles exist.
        return res.json(RBAC_MODULES.map(m => ({
          module: m,
          create: false, edit: false, delete: false, show: false
        })));
      }
    }

    const [rows] = await pool.query('SELECT module, action, allowed FROM role_permissions WHERE role_id = ?', [targetRoleId]);
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
  const { roleId, module, action, allowed, permissions } = req.body;
  
  // Handle Bulk Update
  if (permissions && Array.isArray(permissions)) {
    if (!roleId) return res.status(400).json({ message: 'roleId is required' });
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Clear existing permissions for this role (optional strategy, but safer is upsert)
      // Or just loop upsert
      for (const p of permissions) {
        // p = { module, create, edit, delete, show }
        // We need to convert this to individual rows
        const actions = ['create', 'edit', 'delete', 'show'];
        for (const act of actions) {
          if (p[act] !== undefined) {
             await connection.query(
              'INSERT INTO role_permissions (role_id, module, action, allowed) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)',
              [roleId, p.module, act, p[act] ? 1 : 0]
            );
          }
        }
      }
      
      await connection.commit();
      res.json({ message: 'Permissions updated successfully' });
    } catch (e) {
      await connection.rollback();
      res.status(500).json({ message: 'Server error' });
    } finally {
      connection.release();
    }
    return;
  }

  // Handle Single Update (Legacy support if needed)
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
app.get('/api/outlets', authenticate, async (req, res) => {
  try {
    const [outlets] = await pool.query('SELECT * FROM outlets ORDER BY name ASC');
    res.json(outlets);
  } catch (error) {
    console.error('Error fetching outlets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users with pagination and search
app.get('/api/users', authenticate, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  try {
    const connection = await pool.getConnection();

    let query = 'SELECT u.id, u.username, u.role, u.outlet_id, u.status, u.created_at, o.name as outlet_name FROM users u LEFT JOIN outlets o ON u.outlet_id = o.id';
    let countQuery = 'SELECT COUNT(*) as total FROM users u';
    let params = [];

    if (search) {
      const searchCondition = ' WHERE u.username LIKE ? OR u.role LIKE ?';
      query += searchCondition;
      countQuery += searchCondition;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [users] = await connection.query(query, params);
    
    // Get total count for pagination
    const [countResult] = await connection.query(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
    const total = countResult[0].total;

    connection.release();

    res.json({
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user
app.post('/api/users', authenticate, checkPermission('Management Pengguna', 'create'), async (req, res) => {
  const { username, password, role, outlet_id, status } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  // Prevent creating superadmin if not superadmin
  if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot create superadmin' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role, outlet_id, status) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, role, outlet_id || null, status || 'active']
    );
    res.status(201).json({ id: result.insertId, username, role, outlet_id, status: status || 'active' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username already exists' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user
app.put('/api/users/:id', authenticate, checkPermission('Management Pengguna', 'edit'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, password, role, outlet_id, status } = req.body;

  if (!id) return res.status(400).json({ message: 'Invalid ID' });

  try {
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found' });

    // Prevent modifying superadmin if not superadmin
    if (existing[0].role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Cannot modify superadmin' });
    }

    // Prevent escalating role to superadmin
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Cannot promote to superadmin' });
    }

    let query = 'UPDATE users SET username = ?, role = ?, outlet_id = ?, status = ?';
    let params = [username, role, outlet_id || null, status || 'active'];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username already exists' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
app.delete('/api/users/:id', authenticate, checkPermission('Management Pengguna', 'delete'), async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    // Prevent deleting self
    if (req.user.id === id) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    // Check target user role
    const [existing] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting superadmin if not superadmin
    if (existing[0].role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Cannot delete superadmin' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all products with pagination and search
app.get('/api/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  try {
    const connection = await pool.getConnection();

    let query = 'SELECT * FROM products';
    let countQuery = 'SELECT COUNT(*) as total FROM products';
    let params = [];

    if (search) {
      const searchCondition = ' WHERE name LIKE ?';
      query += searchCondition;
      countQuery += searchCondition;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [products] = await connection.query(query, params);
    
    // Get total count for pagination
    const [countResult] = await connection.query(countQuery, search ? [`%${search}%`] : []);
    const total = countResult[0].total;

    connection.release();

    res.json({
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new product
app.post('/api/products', async (req, res) => {
  const { name, cost_price, selling_price, stock, category, unit, expired_date } = req.body;
  
  if (!name || !cost_price) {
    return res.status(400).json({ message: 'Name and cost price are required' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO products (name, cost_price, selling_price, stock, category, unit, expired_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, cost_price, selling_price || 0, stock || 0, category || 'General', unit || 'pcs', expired_date || null]
    );
    connection.release();

    res.status(201).json({ 
      id: result.insertId, 
      name, 
      cost_price, 
      selling_price, 
      stock, 
      category, 
      unit, 
      expired_date 
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a product
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cost_price, selling_price, stock, category, unit, expired_date } = req.body;

  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE products SET name = ?, cost_price = ?, selling_price = ?, stock = ?, category = ?, unit = ?, expired_date = ? WHERE id = ?',
      [name, cost_price, selling_price, stock, category, unit, expired_date, id]
    );
    connection.release();

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const connection = await pool.getConnection();
    
    // Check if product exists
    const [rows] = await connection.query('SELECT id FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete the product
    await connection.query('DELETE FROM products WHERE id = ?', [id]);
    
    // Shift IDs: Update all products with ID > deleted ID to be ID - 1
    await connection.query('UPDATE products SET id = id - 1 WHERE id > ?', [id]);
    
    // Reset Auto Increment to the correct next value
    const [maxResult] = await connection.query('SELECT MAX(id) as maxId FROM products');
    const nextId = (maxResult[0].maxId || 0) + 1;
    await connection.query(`ALTER TABLE products AUTO_INCREMENT = ${nextId}`);

    connection.release();

    res.json({ message: 'Product deleted and IDs reordered successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stock Adjustment Endpoint
app.post('/api/inventory/adjust', authenticate, checkPermission('Management Stock', 'edit'), async (req, res) => {
  const { productId, type, quantity, note } = req.body; // type: 'add' | 'reduce'

  if (!productId || !type || !quantity) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get current stock
    const [products] = await connection.query('SELECT stock FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Product not found' });
    }
    const currentStock = products[0].stock;
    let newStock = currentStock;
    let change = 0;

    if (type === 'add') {
      newStock += quantity;
      change = quantity;
    } else if (type === 'reduce') {
      if (currentStock < quantity) {
        connection.release();
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      newStock -= quantity;
      change = -quantity;
    } else {
      connection.release();
      return res.status(400).json({ message: 'Invalid adjustment type' });
    }

    // Update product stock
    await connection.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, productId]);

    // Record history
    await connection.query(
      'INSERT INTO inventory_history (product_id, type, quantity_change, previous_stock, new_stock, note) VALUES (?, ?, ?, ?, ?, ?)',
      [productId, 'adjustment', change, currentStock, newStock, note || 'Manual Adjustment']
    );

    await connection.commit();
    res.json({ message: 'Stock adjusted successfully', newStock });
  } catch (error) {
    await connection.rollback();
    console.error('Error adjusting stock:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// Stock Opname Endpoint
app.post('/api/stock-opname', async (req, res) => {
  const { items, note } = req.body; // items: [{ id, system_stock, actual_stock }]
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Invalid items data' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of items) {
      const { id, system_stock, actual_stock } = item;
      const difference = actual_stock - system_stock;

      if (difference !== 0) {
        // Update product stock
        await connection.query('UPDATE products SET stock = ? WHERE id = ?', [actual_stock, id]);

        // Record history
        await connection.query(
          'INSERT INTO inventory_history (product_id, type, quantity_change, previous_stock, new_stock, note) VALUES (?, ?, ?, ?, ?, ?)',
          [id, 'opname', difference, system_stock, actual_stock, note || 'Stock Opname Adjustment']
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Stock Opname completed successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing Stock Opname:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
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

// Update an outlet
app.put('/api/outlets/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, location, status } = req.body;

  try {
    await pool.query(
      'UPDATE outlets SET name = ?, location = ?, status = ? WHERE id = ?',
      [name, location, status || 'Active', id]
    );
    res.json({ message: 'Outlet updated successfully' });
  } catch (error) {
    console.error('Error updating outlet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an outlet
app.delete('/api/outlets/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if outlet has transactions or users
    const [users] = await pool.query('SELECT id FROM users WHERE outlet_id = ?', [id]);
    if (users.length > 0) {
      return res.status(400).json({ message: 'Cannot delete outlet with assigned users' });
    }

    const [transactions] = await pool.query('SELECT id FROM transactions WHERE outlet_id = ?', [id]);
    if (transactions.length > 0) {
      return res.status(400).json({ message: 'Cannot delete outlet with transactions' });
    }

    await pool.query('DELETE FROM outlets WHERE id = ?', [id]);
    res.json({ message: 'Outlet deleted successfully' });
  } catch (error) {
    console.error('Error deleting outlet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new transaction
app.post('/api/transactions', async (req, res) => {
  const { outlet_id, items, total_amount } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in transaction' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create Transaction Record
    const [transResult] = await connection.query(
      'INSERT INTO transactions (outlet_id, total_amount) VALUES (?, ?)',
      [outlet_id || null, total_amount]
    );
    const transactionId = transResult.insertId;

    // 2. Process Items
    for (const item of items) {
      // Insert into transaction_items
      await connection.query(
        'INSERT INTO transaction_items (transaction_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [transactionId, item.id, item.quantity, item.price]
      );

      // Update Product Stock
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.id]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Transaction successful', id: transactionId });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Transaction failed' });
  } finally {
    connection.release();
  }
});

// Dashboard Stats Endpoint
app.get('/api/dashboard', authenticate, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // 1. Stock Recommendations (Low stock or top selling)
    // For now, let's just get products with low stock (< 50)
    const [stockRecs] = await connection.query(`
      SELECT name, stock as count 
      FROM products 
      ORDER BY stock ASC 
      LIMIT 5
    `);

    // 2. Earnings (Weekly Sales)
    // Aggregate by week for the last 4 weeks
    // Note: This is a simplified query. For production, use proper date grouping.
    const [earnings] = await connection.query(`
      SELECT 
        DATE_FORMAT(transaction_date, 'Week %V') as name, 
        SUM(total_amount) as value 
      FROM transactions 
      GROUP BY name 
      ORDER BY name ASC 
      LIMIT 4
    `);

    // 3. Outlets with Cashiers
    const [outlets] = await connection.query(`
      SELECT o.id, o.name, o.location 
      FROM outlets o
    `);

    // Attach cashiers to outlets
    const outletsWithCashiers = await Promise.all(outlets.map(async (outlet) => {
      const [cashiers] = await connection.query(`
        SELECT username 
        FROM users 
        WHERE outlet_id = ? AND role = 'cashier'
      `, [outlet.id]);
      return {
        ...outlet,
        cashiers: cashiers.map(c => c.username) // In real app, return avatar url too
      };
    }));

    // 4. All Cashiers for Table
    const [allCashiers] = await connection.query(`
      SELECT u.id, u.username, o.name as outlet_name, 'Cashier' as description
      FROM users u
      LEFT JOIN outlets o ON u.outlet_id = o.id
      WHERE u.role = 'cashier'
    `);

    connection.release();

    res.json({
      stockRecommendations: stockRecs,
      earnings: earnings,
      outlets: outletsWithCashiers,
      cashiers: allCashiers
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// === Supplier Endpoints ===

// Get all suppliers
app.get('/api/suppliers', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  try {
    const connection = await pool.getConnection();
    let query = 'SELECT * FROM suppliers';
    let countQuery = 'SELECT COUNT(*) as total FROM suppliers';
    let params = [];

    if (search) {
      query += ' WHERE name LIKE ?';
      countQuery += ' WHERE name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [suppliers] = await connection.query(query, params);
    const [countResult] = await connection.query(countQuery, search ? [`%${search}%`] : []);
    const total = countResult[0].total;

    connection.release();

    res.json({
      data: suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new supplier
app.post('/api/suppliers', async (req, res) => {
  const { name, contact_person, phone, address } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_person, phone, address) VALUES (?, ?, ?, ?)',
      [name, contact_person, phone, address]
    );
    res.status(201).json({ id: result.insertId, name, contact_person, phone, address });
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a supplier
app.put('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, contact_person, phone, address } = req.body;

  try {
    await pool.query(
      'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?',
      [name, contact_person, phone, address, id]
    );
    res.json({ message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a supplier
app.delete('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Financial Report: Profit & Loss
app.get('/api/financial/profit-loss', authenticate, async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year are required' });
  }

  try {
    const connection = await pool.getConnection();

    // 1. Revenue (Pendapatan Penjualan)
    // Month is 1-12 in query, but MySQL MONTH() returns 1-12.
    const [revenueRows] = await connection.query(
      'SELECT SUM(total_amount) as total_sales FROM transactions WHERE MONTH(transaction_date) = ? AND YEAR(transaction_date) = ?',
      [month, year]
    );
    const totalRevenue = revenueRows[0].total_sales || 0;

    // 2. COGS (Harga Pokok Penjualan) from Sales
    // Join transaction_items -> transactions to filter by date
    // Join transaction_items -> products to get cost_price
    const [cogsRows] = await connection.query(`
      SELECT SUM(ti.quantity * p.cost_price) as total_cogs
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN products p ON ti.product_id = p.id
      WHERE MONTH(t.transaction_date) = ? AND YEAR(t.transaction_date) = ?
    `, [month, year]);
    const salesCOGS = cogsRows[0].total_cogs || 0;

    // 3. Opname Difference (Selisih Persediaan)
    // Calculate value of stock changes from opname
    // Note: quantity_change is positive for gain, negative for loss.
    // If we want "Cost" of opname, a negative change (loss) is an expense/cost.
    // The image shows "Harga Pokok Penjualan Dari Opname". Usually this means inventory write-off (loss).
    // If quantity_change is -5, and cost is 1000, value is -5000.
    // We sum this value. If negative, it increases COGS? Or is it listed separately?
    // In standard accounting: COGS = Opening Stock + Purchases - Closing Stock.
    // Here we are doing Sales-based COGS + Variances.
    // If we lost stock (negative change), it's a cost. So we should flip the sign if we treat it as a positive cost value, or just sum it.
    // Let's sum (quantity_change * cost). If result is negative (loss), it reduces profit.
    // The image shows "Harga Pokok Penjualan Dari Opname" as a positive number "Rp. 795.657" (in the example).
    // This implies it's a COST. So a stock LOSS (negative quantity) becomes a positive COST.
    // So we should take -1 * SUM(quantity_change * cost).
    const [opnameRows] = await connection.query(`
      SELECT SUM(ih.quantity_change * p.cost_price) as opname_value
      FROM inventory_history ih
      JOIN products p ON ih.product_id = p.id
      WHERE ih.type = 'opname' AND MONTH(ih.created_at) = ? AND YEAR(ih.created_at) = ?
    `, [month, year]);
    
    // If opname_value is negative (loss of stock), it is a cost. So -(-5000) = 5000 cost.
    // If opname_value is positive (gain of stock), it reduces cost.
    const rawOpnameValue = opnameRows[0].opname_value || 0;
    const opnameCost = -rawOpnameValue; 

    // 4. Expenses (Laba Daki / Lain-lain)
    // We don't have an expenses table yet. We'll return 0 or hardcoded for demo.
    // The image shows "Laba Daki" with a large negative number.
    // Let's just return 0 for now.
    const otherExpenses = 0;

    connection.release();

    res.json({
      period: { month, year },
      revenue: {
        total: totalRevenue,
        details: [
          { label: 'Penjualan Barang', amount: totalRevenue },
          // { label: 'Retur Penjualan', amount: 0 }
        ]
      },
      cogs: {
        total: Number(salesCOGS) + Number(opnameCost),
        details: [
          { label: 'Harga Pokok Penjualan', amount: salesCOGS },
          { label: 'Harga Pokok Penjualan Dari Opname (Selisih Persediaan)', amount: opnameCost }
        ]
      },
      gross_profit: (revenueRows[0].total_sales || 0) - (Number(salesCOGS) + Number(opnameCost)),
      expenses: {
        total: otherExpenses,
        details: [
          { label: 'Biaya Operasional (Demo)', amount: otherExpenses }
        ]
      },
      net_profit: (revenueRows[0].total_sales || 0) - (Number(salesCOGS) + Number(opnameCost)) - otherExpenses
    });
  } catch (error) {
    console.error('Error generating financial report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Transaction Report Endpoint
app.get('/api/reports/transactions', authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Start date and end date are required' });
  }

  try {
    const connection = await pool.getConnection();

    // 1. Get Transactions with Outlet Info
    const [transactions] = await connection.query(`
      SELECT t.id, t.transaction_date, t.total_amount, o.name as outlet_name
      FROM transactions t
      LEFT JOIN outlets o ON t.outlet_id = o.id
      WHERE DATE(t.transaction_date) BETWEEN ? AND ?
      ORDER BY t.transaction_date DESC
    `, [startDate, endDate]);

    // 2. Get Items for these transactions
    const transactionIds = transactions.map(t => t.id);
    let items = [];
    if (transactionIds.length > 0) {
      const [itemRows] = await connection.query(`
        SELECT ti.transaction_id, ti.quantity, ti.price, p.name as product_name
        FROM transaction_items ti
        JOIN products p ON ti.product_id = p.id
        WHERE ti.transaction_id IN (?)
      `, [transactionIds]);
      items = itemRows;
    }

    // Attach items to transactions
    const transactionsWithItems = transactions.map(t => ({
      ...t,
      items: items.filter(i => i.transaction_id === t.id)
    }));

    // 3. Prepare Chart Data (Daily Sales)
    const chartDataMap = {};
    transactions.forEach(t => {
      const date = new Date(t.transaction_date).toISOString().split('T')[0]; // YYYY-MM-DD
      if (!chartDataMap[date]) {
        chartDataMap[date] = 0;
      }
      chartDataMap[date] += Number(t.total_amount);
    });

    const chartData = Object.keys(chartDataMap).sort().map(date => ({
      date,
      total: chartDataMap[date]
    }));

    connection.release();

    res.json({
      transactions: transactionsWithItems,
      chartData
    });

  } catch (error) {
    console.error('Error generating transaction report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Balance Sheet Endpoint
app.get('/api/reports/balance', authenticate, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // 1. Total Assets
    // Cash: Sum of all transactions (simplified "Cash on Hand" from sales)
    const [cashRows] = await connection.query('SELECT SUM(total_amount) as total_cash FROM transactions');
    const cash = Number(cashRows[0].total_cash || 0);

    // Inventory: Sum of stock * cost_price
    const [inventoryRows] = await connection.query('SELECT SUM(stock * cost_price) as total_inventory FROM products');
    const inventory = Number(inventoryRows[0].total_inventory || 0);
    
    // Receivables (Piutang): 0 for now (no credit sales tracking yet)
    const receivables = 0;

    const totalAssets = cash + inventory + receivables;

    // 2. Liabilities
    // Payables (Hutang Usaha): 0 for now (no purchase tracking yet)
    const payables = 0;
    // Consignment Debt: 0 for now
    const consignmentDebt = 0;
    
    const totalLiabilities = payables + consignmentDebt;

    // 3. Equity
    // Retained Earnings (Laba Ditahan): Total Sales - Total COGS
    // We need Total COGS for all time.
    const [cogsRows] = await connection.query(`
      SELECT SUM(ti.quantity * p.cost_price) as total_cogs
      FROM transaction_items ti
      JOIN products p ON ti.product_id = p.id
    `);
    const totalCOGS = Number(cogsRows[0].total_cogs || 0);
    
    // Retained Earnings = Revenue - COGS - Expenses (ignoring expenses for now as table doesn't exist)
    const retainedEarnings = cash - totalCOGS;

    // Initial Equity (Ekuitas Awal)
    // To make it balance: Assets = Liabilities + Equity
    // Equity = Initial Equity + Retained Earnings
    // Initial Equity = Assets - Liabilities - Retained Earnings
    // Initial Equity = (Cash + Inventory) - (0) - (Cash - COGS) = Inventory + COGS
    const initialEquity = totalAssets - totalLiabilities - retainedEarnings;

    connection.release();

    res.json({
      assets: {
        cash,
        inventory,
        receivables,
        total: totalAssets
      },
      liabilities: {
        payables,
        consignmentDebt,
        total: totalLiabilities
      },
      equity: {
        initial: initialEquity,
        capitalChanges: 0, // Penambahan/Pengurangan Modal
        retainedEarnings,
        total: initialEquity + retainedEarnings
      }
    });

  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
