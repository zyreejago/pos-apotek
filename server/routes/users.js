module.exports = function registerUserRoutes(app, pool, bcrypt, authenticate, checkPermission) {
  // Get all users with pagination and search
  app.get(
    '/api/users',
    authenticate,
    checkPermission('Management Pengguna', 'show'),
    async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    try {
      const connection = await pool.getConnection();

      let query =
        'SELECT u.id, u.username, u.email, u.role, u.outlet_id, u.status, u.created_at, o.name as outlet_name FROM users u LEFT JOIN outlets o ON u.outlet_id = o.id';
      let countQuery = 'SELECT COUNT(*) as total FROM users u';
      let params = [];

      if (search) {
        const searchCondition = ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.role LIKE ?';
        query += searchCondition;
        countQuery += searchCondition;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [users] = await connection.query(query, params);

      // Get total count for pagination
      const [countResult] = await connection.query(
        countQuery,
        search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
      );
      const total = countResult[0].total;

      connection.release();

      res.json({
        data: users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // Create new user
  app.post(
    '/api/users',
    authenticate,
    checkPermission('Management Pengguna', 'create'),
    async (req, res) => {
      const { username, email, password, role, outlet_id, status } = req.body;

      if (!username || !email || !password || !role) {
        return res
          .status(400)
          .json({ message: 'Username, email, password, and role are required' });
      }

      // Prevent creating superadmin if not superadmin
      if (role === 'superadmin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Cannot create superadmin' });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
          'INSERT INTO users (username, email, password, role, outlet_id, status) VALUES (?, ?, ?, ?, ?, ?)',
          [username, email, hashedPassword, role, outlet_id || null, status || 'active']
        );
        res.status(201).json({
          id: result.insertId,
          username,
          email,
          role,
          outlet_id,
          status: status || 'active',
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Username or Email already exists' });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Server error' });
      }
    }
  );

  // Update user
  app.put(
    '/api/users/:id',
    authenticate,
    checkPermission('Management Pengguna', 'edit'),
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { username, email, password, role, outlet_id, status } = req.body;

      if (!id) return res.status(400).json({ message: 'Invalid ID' });

      try {
        // Check if user exists
        const [existing] = await pool.query(
          'SELECT * FROM users WHERE id = ?',
          [id]
        );
        if (existing.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Prevent modifying superadmin if not superadmin
        if (existing[0].role === 'superadmin' && req.user.role !== 'superadmin') {
          return res
            .status(403)
            .json({ message: 'Cannot modify superadmin' });
        }

        // Prevent escalating role to superadmin
        if (role === 'superadmin' && req.user.role !== 'superadmin') {
          return res
            .status(403)
            .json({ message: 'Cannot promote to superadmin' });
        }

        let query =
          'UPDATE users SET username = ?, email = ?, role = ?, outlet_id = ?, status = ?';
        let params = [username, email, role, outlet_id || null, status || 'active'];

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
          return res.status(409).json({ message: 'Username or Email already exists' });
        }
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Server error' });
      }
    }
  );

  // Delete user
  app.delete(
    '/api/users/:id',
    authenticate,
    checkPermission('Management Pengguna', 'delete'),
    async (req, res) => {
      const id = parseInt(req.params.id);

      try {
        // Prevent deleting self
        if (req.user.id === id) {
          return res
            .status(403)
            .json({ message: 'Cannot delete your own account' });
        }

        // Check target user role
        const [existing] = await pool.query(
          'SELECT role FROM users WHERE id = ?',
          [id]
        );
        if (existing.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting superadmin if not superadmin
        if (existing[0].role === 'superadmin' && req.user.role !== 'superadmin') {
          return res
            .status(403)
            .json({ message: 'Cannot delete superadmin' });
        }

        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [
          id,
        ]);

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
      }
    }
  );
};
