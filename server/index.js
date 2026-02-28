const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const registerUserRoutes = require('./routes/users');
const registerOutletRoutes = require('./routes/outlets');
const registerProductRoutes = require('./routes/products');
const registerSettingsRoutes = require('./routes/settings');
const registerTransactionRoutes = require('./routes/transactions');
const registerSupplierRoutes = require('./routes/suppliers');
const registerReportRoutes = require('./routes/reports');

dotenv.config();

const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

app.use(cors());
app.use(express.json());

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

// Register feature routes
registerUserRoutes(app, pool, bcrypt, authenticate, checkPermission);
registerOutletRoutes(app, pool, authenticate);
registerProductRoutes(app, pool, authenticate, checkPermission);
registerSettingsRoutes(app, pool, authenticate);
registerTransactionRoutes(app, pool, authenticate);
registerSupplierRoutes(app, pool);
registerReportRoutes(app, pool, authenticate);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
