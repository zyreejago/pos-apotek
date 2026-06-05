const { createJournalEntry } = require('../utils/journal');

module.exports = function registerProductRoutes(app, pool, authenticate, checkPermission, createAuditTrail) {

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

      // Base query: JOIN with the latest batch per product to get supplier_name and stock_type
      let query = `
        SELECT p.*, 
               lb.supplier_id, 
               s.name AS supplier_name, 
               lb.stock_type
        FROM products p
        LEFT JOIN (
          SELECT b1.* FROM batches b1
          INNER JOIN (
            SELECT product_id, MAX(id) AS max_id FROM batches GROUP BY product_id
          ) b2 ON b1.id = b2.max_id
        ) lb ON p.id = lb.product_id
        LEFT JOIN suppliers s ON lb.supplier_id = s.id
      `;
      let countQuery = 'SELECT COUNT(*) as total FROM products';
      let params = [];

      if (search) {
        query += ' WHERE p.status = "active" AND p.name LIKE ?';
        countQuery += ' WHERE status = "active" AND name LIKE ?';
        params.push(`%${search}%`);
      } else {
        query += ' WHERE p.status = "active"';
        countQuery += ' WHERE status = "active"';
      }

      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
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
    const { name, cost_price, selling_price, stock, category, product_category, unit, expired_date, location_code, purchase_unit, unit_multiplier } =
      req.body;

    if (!name || !cost_price) {
      return res
        .status(400)
        .json({ message: 'Name and cost price are required' });
    }

    // Helper function to format date for MySQL (YYYY-MM-DD)
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    try {
      // Check if this product is being created via "Add to List" with a high value
      // We'll pass a flag from the frontend if it needs approval
      const status = req.body.needsApproval ? 'pending' : 'active';

      const connection = await pool.getConnection();
      const [result] = await connection.query(
        'INSERT INTO products (name, cost_price, selling_price, stock, category, product_category, unit, expired_date, location_code, purchase_unit, unit_multiplier, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          name,
          cost_price,
          selling_price || 0,
          stock || 0,
          category || 'General',
          product_category || 'OBAT',
          unit || 'pcs',
          formatDate(expired_date),
          location_code || null,
          purchase_unit || 'Box',
          unit_multiplier || 1,
          status
        ]
      );
      connection.release();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'create',
        description: `Membuat produk baru: ${name} (Status: ${status})`,
      });

      res.status(201).json({
        id: result.insertId,
        name,
        cost_price,
        selling_price,
        stock,
        category,
        product_category: product_category || 'OBAT',
        unit,
        expired_date,
        location_code,
        purchase_unit: purchase_unit || 'Box',
        unit_multiplier: unit_multiplier || 1,
        status
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
    const { name, cost_price, selling_price, stock, category, product_category, unit, expired_date, location_code, purchase_unit, unit_multiplier } =
      req.body;

    // Helper function to format date for MySQL (YYYY-MM-DD)
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    };

    try {
      const connection = await pool.getConnection();
      
      // Get current product name
      const [currentProduct] = await connection.query('SELECT name FROM products WHERE id = ?', [id]);
      
      await connection.query(
        'UPDATE products SET name = ?, cost_price = ?, selling_price = ?, stock = ?, category = ?, product_category = ?, unit = ?, expired_date = ?, location_code = ?, purchase_unit = ?, unit_multiplier = ? WHERE id = ?',
        [name, cost_price, selling_price, stock, category, product_category || 'OBAT', unit, formatDate(expired_date), location_code || null, purchase_unit || 'Box', unit_multiplier || 1, id]
      );
      connection.release();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'edit',
        description: `Memperbarui produk: ${currentProduct[0]?.name || id} -> ${name}`,
      });

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
        'SELECT id, name FROM products WHERE id = ?',
        [id]
      );
      if (rows.length === 0) {
        connection.release();
        return res.status(404).json({ message: 'Product not found' });
      }

      const productName = rows[0].name;

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

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'delete',
        description: `Menghapus produk: ${productName}`,
      });

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
      const today = new Date().toISOString().split('T')[0];

      for (const item of items) {
        const { id, system_stock, actual_stock } = item;
        const difference = actual_stock - system_stock;

        if (difference !== 0) {
          await connection.query('UPDATE products SET stock = ? WHERE id = ?', [
            actual_stock,
            id,
          ]);

          // Get product cost price
          // Get product cost price, product_category, and name
          const [productResult] = await connection.query('SELECT cost_price, product_category, name FROM products WHERE id = ?', [id]);
          const costPrice = productResult[0]?.cost_price || 0;
          const isObat = productResult[0]?.product_category === 'OBAT';
          const persediaanCode = isObat ? '103' : '104';
          const productName = productResult[0]?.name || `Produk #${id}`;
          const differenceValue = difference * costPrice;

          // Create journal entry
          const journalItems = [];
          if (difference > 0) {
            // Stock increased: Debit Persediaan (Obat/Non-Obat), Credit Beban Selisih Stok (527) as negative expense
            journalItems.push(
              { accountCode: persediaanCode, debit: differenceValue },
              { accountCode: '527', credit: differenceValue }
            );
          } else {
            // Stock decreased: Debit Beban Selisih Stok (527), Credit Persediaan (Obat/Non-Obat)
            const absValue = Math.abs(differenceValue);
            journalItems.push(
              { accountCode: '527', debit: absValue },
              { accountCode: persediaanCode, credit: absValue }
            );
          }

          await createJournalEntry(connection, null, today, 
            `Penyesuaian stok opname: ${productName} (${difference > 0 ? '+' : ''}${difference} pcs)`,
            journalItems
          );

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
