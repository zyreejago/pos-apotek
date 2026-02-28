module.exports = function registerTransactionRoutes(app, pool, authenticate) {
  app.post('/api/transactions', async (req, res) => {
    const { outlet_id, items, total_amount, tax_amount, discount_amount, subtotal } =
      req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in transaction' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [transResult] = await connection.query(
        'INSERT INTO transactions (outlet_id, total_amount, tax_amount, discount_amount, subtotal) VALUES (?, ?, ?, ?, ?)',
        [outlet_id || null, total_amount, tax_amount || 0, discount_amount || 0, subtotal || 0]
      );
      const transactionId = transResult.insertId;

      for (const item of items) {
        await connection.query(
          'INSERT INTO transaction_items (transaction_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [transactionId, item.id, item.quantity, item.price]
        );

        await connection.query(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.id]
        );
      }

      await connection.commit();
      res
        .status(201)
        .json({ message: 'Transaction successful', id: transactionId });
    } catch (error) {
      await connection.rollback();
      console.error('Error creating transaction:', error);
      res.status(500).json({ message: 'Transaction failed' });
    } finally {
      connection.release();
    }
  });

  app.get('/api/dashboard', authenticate, async (req, res) => {
    try {
      const connection = await pool.getConnection();

      const [stockRecs] = await connection.query(`
      SELECT name, stock as count 
      FROM products 
      ORDER BY stock ASC 
      LIMIT 5
    `);

      const [earnings] = await connection.query(`
      SELECT 
        DATE_FORMAT(transaction_date, 'Week %V') as name, 
        SUM(total_amount) as value 
      FROM transactions 
      GROUP BY name 
      ORDER BY name ASC 
      LIMIT 4
    `);

      const [outlets] = await connection.query(`
      SELECT o.id, o.name, o.location 
      FROM outlets o
    `);

      const outletsWithCashiers = await Promise.all(
        outlets.map(async (outlet) => {
          const [cashiers] = await connection.query(
            `
        SELECT username 
        FROM users 
        WHERE outlet_id = ? AND role = 'cashier'
      `,
            [outlet.id]
          );
          return {
            ...outlet,
            cashiers: cashiers.map((c) => c.username),
          };
        })
      );

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
        cashiers: allCashiers,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};

