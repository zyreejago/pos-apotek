module.exports = function registerSettingsRoutes(app, pool, authenticate) {
  app.get('/api/settings', authenticate, async (req, res) => {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.query('SELECT * FROM system_settings');
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
};

