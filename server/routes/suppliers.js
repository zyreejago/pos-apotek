module.exports = function registerSupplierRoutes(app, pool, authenticate, checkPermission, createAuditTrail) {
  app.get(
    '/api/suppliers',
    authenticate,
    checkPermission('Suppliers', 'show'),
    async (req, res) => {
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
      const [countResult] = await connection.query(
        countQuery,
        search ? [`%${search}%`] : []
      );
      const total = countResult[0].total;

      connection.release();

      res.json({
        data: suppliers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.post(
    '/api/suppliers',
    authenticate,
    checkPermission('Suppliers', 'create'),
    async (req, res) => {
    const { name, contact_person, phone, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    try {
      const [result] = await pool.query(
        'INSERT INTO suppliers (name, contact_person, phone, address) VALUES (?, ?, ?, ?)',
        [name, contact_person, phone, address]
      );

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Suppliers',
        action: 'create',
        description: `Membuat supplier baru: ${name}`,
      });

      res
        .status(201)
        .json({ id: result.insertId, name, contact_person, phone, address });
    } catch (error) {
      console.error('Error adding supplier:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.put(
    '/api/suppliers/:id',
    authenticate,
    checkPermission('Suppliers', 'edit'),
    async (req, res) => {
    const { id } = req.params;
    const { name, contact_person, phone, address } = req.body;

    try {
      // Get current supplier name
      const [currentSupplier] = await pool.query('SELECT name FROM suppliers WHERE id = ?', [id]);
      
      await pool.query(
        'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?',
        [name, contact_person, phone, address, id]
      );

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Suppliers',
        action: 'edit',
        description: `Memperbarui supplier: ${currentSupplier[0]?.name || id} -> ${name}`,
      });

      res.json({ message: 'Supplier updated successfully' });
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.delete(
    '/api/suppliers/:id',
    authenticate,
    checkPermission('Suppliers', 'delete'),
    async (req, res) => {
    const { id } = req.params;

    try {
      // Get current supplier name
      const [currentSupplier] = await pool.query('SELECT name FROM suppliers WHERE id = ?', [id]);
      
      await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Suppliers',
        action: 'delete',
        description: `Menghapus supplier: ${currentSupplier[0]?.name || id}`,
      });

      res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );
};
