module.exports = function registerProfileRoutes(app, pool, bcrypt, authenticate) {
  // Get current user profile
  app.get('/api/profile', authenticate, async (req, res) => {
    try {
      const [users] = await pool.query(
        'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(users[0]);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Update profile details (username, email)
  app.put('/api/profile', authenticate, async (req, res) => {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required' });
    }

    try {
      // Check if username/email already exists for other users
      const [existing] = await pool.query(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username, email, req.user.id]
      );

      if (existing.length > 0) {
        return res.status(409).json({ message: 'Username or Email already exists' });
      }

      await pool.query(
        'UPDATE users SET username = ?, email = ? WHERE id = ?',
        [username, email, req.user.id]
      );

      res.json({ message: 'Profile updated successfully', user: { username, email } });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Change password
  app.put('/api/profile/password', authenticate, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
      // Get current user's password hash
      const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);

      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = users[0];

      // Verify old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Password lama salah' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};
