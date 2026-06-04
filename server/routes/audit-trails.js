const express = require('express');

// Create a new audit trail (for internal use, usually called by other routes)
const createAuditTrail = async (pool, { user_id, username, role, module, action, description, ip_address, user_agent }) => {
  try {
    await pool.query(
      'INSERT INTO audit_trails (user_id, username, role, module, action, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, username, role, module, action, description, ip_address, user_agent]
    );
  } catch (error) {
    console.error('Error creating audit trail:', error);
  }
};

const registerAuditTrailRoutes = function(app, pool, authenticate, checkPermission) {
  const router = express.Router();

  // Get all audit trails (with pagination and filters)
  router.get('/', authenticate, checkPermission('Audit Trail', 'show'), async (req, res) => {
    try {
      const { page = 1, limit = 20, module, user_id, start_date, end_date } = req.query;
      const offset = (page - 1) * limit;
      
      let query = 'SELECT * FROM audit_trails WHERE 1=1';
      const params = [];
      
      if (module) {
        query += ' AND module = ?';
        params.push(module);
      }
      if (user_id) {
        query += ' AND user_id = ?';
        params.push(user_id);
      }
      if (start_date) {
        query += ' AND created_at >= ?';
        params.push(start_date);
      }
      if (end_date) {
        query += ' AND created_at <= ?';
        params.push(end_date);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
      
      const [rows] = await pool.query(query, params);
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM audit_trails WHERE 1=1';
      const countParams = [];
      
      if (module) {
        countQuery += ' AND module = ?';
        countParams.push(module);
      }
      if (user_id) {
        countQuery += ' AND user_id = ?';
        countParams.push(user_id);
      }
      if (start_date) {
        countQuery += ' AND created_at >= ?';
        countParams.push(start_date);
      }
      if (end_date) {
        countQuery += ' AND created_at <= ?';
        countParams.push(end_date);
      }
      
      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0].total;
      
      res.json({
        data: rows,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching audit trails:', error);
      res.status(500).json({ error: 'Failed to fetch audit trails' });
    }
  });

  // Get a single audit trail by ID
  router.get('/:id', authenticate, checkPermission('Audit Trail', 'show'), async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM audit_trails WHERE id = ?', [req.params.id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Audit trail not found' });
      }
      
      res.json(rows[0]);
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
  });

  // Add the router to the app
  app.use('/api/audit-trails', router);
};

module.exports = { registerAuditTrailRoutes, createAuditTrail };
