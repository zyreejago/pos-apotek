module.exports = function registerOutletRoutes(app, pool, authenticate) {
  app.get('/api/outlets', authenticate, async (req, res) => {
    try {
      const [outlets] = await pool.query(
        'SELECT * FROM outlets ORDER BY name ASC'
      );
      res.json(outlets);
    } catch (error) {
      console.error('Error fetching outlets:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/outlets', async (req, res) => {
    const { name, location } = req.body;
    if (!name || !location) {
      return res
        .status(400)
        .json({ message: 'Name and location are required' });
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
        status: 'Active',
      };

      res.status(201).json(newOutlet);
    } catch (error) {
      console.error('Error adding outlet:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

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

  app.delete('/api/outlets/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
      const [users] = await pool.query(
        'SELECT id FROM users WHERE outlet_id = ?',
        [id]
      );
      if (users.length > 0) {
        return res
          .status(400)
          .json({ message: 'Cannot delete outlet with assigned users' });
      }

      const [transactions] = await pool.query(
        'SELECT id FROM transactions WHERE outlet_id = ?',
        [id]
      );
      if (transactions.length > 0) {
        return res
          .status(400)
          .json({ message: 'Cannot delete outlet with transactions' });
      }

      await pool.query('DELETE FROM outlets WHERE id = ?', [id]);
      res.json({ message: 'Outlet deleted successfully' });
    } catch (error) {
      console.error('Error deleting outlet:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};

