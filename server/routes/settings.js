module.exports = function registerSettingsRoutes(app, pool, authenticate) {
  app.get('/api/settings', authenticate, async (req, res) => {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.query('SELECT * FROM system_settings ORDER BY setting_key ASC');
      connection.release();

      const settings = {};
      rows.forEach((row) => {
        settings[row.setting_key] = row.setting_value;
      });

      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/settings', authenticate, async (req, res) => {
    const { setting_key, setting_value } = req.body;

    if (!setting_key || setting_value === undefined) {
      return res.status(400).json({ message: 'setting_key and setting_value are required' });
    }

    try {
      const connection = await pool.getConnection();
      await connection.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
        [setting_key, String(setting_value)]
      );
      connection.release();
      res.status(201).json({ message: 'Setting created successfully' });
    } catch (error) {
      console.error('Error creating setting:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Setting key already exists' });
      }
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.put('/api/settings', authenticate, async (req, res) => {
    const { ppn_rate, discount_rate } = req.body;

    try {
      const connection = await pool.getConnection();

      if (ppn_rate !== undefined) {
        await connection.query(
          'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          ['ppn_rate', ppn_rate, ppn_rate]
        );
      }

      if (discount_rate !== undefined) {
        await connection.query(
          'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          ['discount_rate', discount_rate, discount_rate]
        );
      }

      connection.release();
      res.json({ message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.put('/api/settings/:key', authenticate, async (req, res) => {
    const { key } = req.params;
    const { setting_value } = req.body;

    if (setting_value === undefined) {
      return res.status(400).json({ message: 'setting_value is required' });
    }

    try {
      const connection = await pool.getConnection();
      const [result] = await connection.query(
        'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
        [String(setting_value), key]
      );
      connection.release();

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Setting not found' });
      }
      res.json({ message: 'Setting updated successfully' });
    } catch (error) {
      console.error('Error updating setting:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.delete('/api/settings/:key', authenticate, async (req, res) => {
    const { key } = req.params;

    try {
      const connection = await pool.getConnection();
      const [result] = await connection.query(
        'DELETE FROM system_settings WHERE setting_key = ?',
        [key]
      );
      connection.release();

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Setting not found' });
      }
      res.json({ message: 'Setting deleted successfully' });
    } catch (error) {
      console.error('Error deleting setting:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};

