module.exports = function registerProductRoutes(app, pool, authenticate, checkPermission) {
  app.get(
    '/api/products',
    authenticate,
    checkPermission('Management Product', 'show'),
    async (req, res) => {
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

      const [countResult] = await connection.query(
        countQuery,
        search ? [`%${search}%`] : []
      );
      const total = countResult[0].total;

      connection.release();

      res.json({
        data: products,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.post(
    '/api/products',
    authenticate,
    checkPermission('Management Product', 'create'),
    async (req, res) => {
    const { name, cost_price, selling_price, stock, category, unit, expired_date } =
      req.body;

    if (!name || !cost_price) {
      return res
        .status(400)
        .json({ message: 'Name and cost price are required' });
    }

    try {
      const connection = await pool.getConnection();
      const [result] = await connection.query(
        'INSERT INTO products (name, cost_price, selling_price, stock, category, unit, expired_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          name,
          cost_price,
          selling_price || 0,
          stock || 0,
          category || 'General',
          unit || 'pcs',
          expired_date || null,
        ]
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
        expired_date,
      });
    } catch (error) {
      console.error('Error adding product:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.put(
    '/api/products/:id',
    authenticate,
    checkPermission('Management Product', 'edit'),
    async (req, res) => {
    const { id } = req.params;
    const { name, cost_price, selling_price, stock, category, unit, expired_date } =
      req.body;

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
    }
  );

  app.delete(
    '/api/products/:id',
    authenticate,
    checkPermission('Management Product', 'delete'),
    async (req, res) => {
    const id = parseInt(req.params.id);

    try {
      const connection = await pool.getConnection();

      const [rows] = await connection.query(
        'SELECT id FROM products WHERE id = ?',
        [id]
      );
      if (rows.length === 0) {
        connection.release();
        return res.status(404).json({ message: 'Product not found' });
      }

      await connection.query('DELETE FROM products WHERE id = ?', [id]);

      await connection.query('UPDATE products SET id = id - 1 WHERE id > ?', [
        id,
      ]);

      const [maxResult] = await connection.query(
        'SELECT MAX(id) as maxId FROM products'
      );
      const nextId = (maxResult[0].maxId || 0) + 1;
      await connection.query(`ALTER TABLE products AUTO_INCREMENT = ${nextId}`);

      connection.release();

      res.json({ message: 'Product deleted and IDs reordered successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.post(
    '/api/inventory/adjust',
    authenticate,
    checkPermission('Management Product', 'edit'),
    async (req, res) => {
      const { productId, type, quantity, note } = req.body;

      if (!productId || !type || !quantity) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [products] = await connection.query(
          'SELECT stock FROM products WHERE id = ?',
          [productId]
        );
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

        await connection.query('UPDATE products SET stock = ? WHERE id = ?', [
          newStock,
          productId,
        ]);

        await connection.query(
          'INSERT INTO inventory_history (product_id, type, quantity_change, previous_stock, new_stock, note) VALUES (?, ?, ?, ?, ?, ?)',
          [
            productId,
            'adjustment',
            change,
            currentStock,
            newStock,
            note || 'Manual Adjustment',
          ]
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
    }
  );

  app.post(
    '/api/stock-opname',
    authenticate,
    checkPermission('Stock Opname', 'create'),
    async (req, res) => {
    const { items, note } = req.body;

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
          await connection.query('UPDATE products SET stock = ? WHERE id = ?', [
            actual_stock,
            id,
          ]);

          await connection.query(
            'INSERT INTO inventory_history (product_id, type, quantity_change, previous_stock, new_stock, note) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              'opname',
              difference,
              system_stock,
              actual_stock,
              note || 'Stock Opname Adjustment',
            ]
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
    }
  );
};
