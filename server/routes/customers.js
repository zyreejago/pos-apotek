module.exports = function registerCustomerRoutes(app, pool, authenticate) {
  app.get('/api/customers/search', authenticate, async (req, res) => {
    try {
      const { phone } = req.query;
      if (!phone) return res.status(400).json({ message: 'Phone is required' });

      const [rows] = await pool.query(
        'SELECT * FROM customers WHERE phone = ?',
        [phone]
      );

      if (rows.length > 0) {
        return res.json({ found: true, customer: rows[0] });
      }
      res.json({ found: false, customer: null });
    } catch (error) {
      console.error('Error searching customer:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/customers', authenticate, async (req, res) => {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

      const [result] = await pool.query(
        'INSERT INTO customers (name, phone) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [name, phone]
      );

      const id = result.insertId || (await pool.query('SELECT id FROM customers WHERE phone = ?', [phone]))[0][0].id;
      res.status(201).json({ id, name, phone });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};
