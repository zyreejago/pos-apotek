
function registerInventoryRoutes(app, pool, authenticate, checkPermission, upload) {
  // Get all batches for a product
  app.get('/api/inventory/batches/:productId', authenticate, async (req, res) => {
    try {
      const { productId } = req.params;
      const [rows] = await pool.query(`
        SELECT b.*, s.name as supplier_name 
        FROM batches b 
        LEFT JOIN suppliers s ON b.supplier_id = s.id 
        WHERE b.product_id = ? 
        ORDER BY b.expired_date ASC, b.id ASC
      `, [productId]);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching batches:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch batches' });
    }
  });

  // Create a new batch
  app.post('/api/inventory/batches', authenticate, checkPermission('Management Product', 'create'), async (req, res) => {
    try {
      const { product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, cost_price, expired_date } = req.body;
      const [result] = await pool.query(`
        INSERT INTO batches (product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, initial_quantity, cost_price, expired_date]);
      
      // Update product's total stock (sum of all batches' remaining quantities)
      await pool.query(`
        UPDATE products 
        SET stock = (SELECT COALESCE(SUM(remaining_quantity), 0) FROM batches WHERE product_id = ?)
        WHERE id = ?
      `, [product_id, product_id]);

      res.json({ success: true, data: { id: result.insertId, ...req.body } });
    } catch (err) {
      console.error('Error creating batch:', err);
      res.status(500).json({ success: false, message: 'Failed to create batch' });
    }
  });

  // Update a batch
  app.put('/api/inventory/batches/:id', authenticate, checkPermission('Management Product', 'edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const { supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date } = req.body;
      await pool.query(`
        UPDATE batches 
        SET supplier_id = ?, batch_number = ?, stock_type = ?, purchase_date = ?, initial_quantity = ?, remaining_quantity = ?, cost_price = ?, expired_date = ?
        WHERE id = ?
      `, [supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date, id]);

      const [batch] = await pool.query('SELECT product_id FROM batches WHERE id = ?', [id]);
      if (batch.length > 0) {
        const product_id = batch[0].product_id;
        await pool.query(`
          UPDATE products 
          SET stock = (SELECT COALESCE(SUM(remaining_quantity), 0) FROM batches WHERE product_id = ?)
          WHERE id = ?
        `, [product_id, product_id]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error updating batch:', err);
      res.status(500).json({ success: false, message: 'Failed to update batch' });
    }
  });

  // Delete a batch
  app.delete('/api/inventory/batches/:id', authenticate, checkPermission('Management Product', 'delete'), async (req, res) => {
    try {
      const { id } = req.params;
      const [batch] = await pool.query('SELECT product_id FROM batches WHERE id = ?', [id]);
      await pool.query('DELETE FROM batches WHERE id = ?', [id]);
      if (batch.length > 0) {
        const product_id = batch[0].product_id;
        await pool.query(`
          UPDATE products 
          SET stock = (SELECT COALESCE(SUM(remaining_quantity), 0) FROM batches WHERE product_id = ?)
          WHERE id = ?
        `, [product_id, product_id]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting batch:', err);
      res.status(500).json({ success: false, message: 'Failed to delete batch' });
    }
  });

  // --- Prescriptions ---
  // Get all prescriptions
  app.get('/api/inventory/prescriptions', authenticate, checkPermission('Resep Dokter', 'show'), async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT p.*, t.id as transaction_id, u.username as entered_by_name 
        FROM prescriptions p 
        LEFT JOIN users u ON p.entered_by = u.id 
        LEFT JOIN transactions t ON p.transaction_id = t.id
        ORDER BY p.created_at DESC
      `);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch prescriptions' });
    }
  });

  // Create a prescription
  app.post('/api/inventory/prescriptions', authenticate, checkPermission('Resep Dokter', 'create'), upload.single('image'), async (req, res) => {
    try {
      const { prescription_code, prescription_date, entered_by, transaction_id, notes } = req.body;
      const image_url = req.file ? `/uploads/${req.file.filename}` : null;
      const [result] = await pool.query(`
        INSERT INTO prescriptions (prescription_code, image_url, prescription_date, entered_by, transaction_id, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [prescription_code, image_url, prescription_date, entered_by, transaction_id, notes]);
      res.json({ success: true, data: { id: result.insertId, prescription_code, image_url, prescription_date, entered_by, transaction_id, notes } });
    } catch (err) {
      console.error('Error creating prescription:', err);
      res.status(500).json({ success: false, message: 'Failed to create prescription' });
    }
  });

  // Update a prescription
  app.put('/api/inventory/prescriptions/:id', authenticate, checkPermission('Resep Dokter', 'edit'), upload.single('image'), async (req, res) => {
    try {
      const { id } = req.params;
      const { prescription_code, prescription_date, entered_by, transaction_id, notes } = req.body;
      
      // Get existing image_url if no new file uploaded
      const [existing] = await pool.query('SELECT image_url FROM prescriptions WHERE id = ?', [id]);
      let image_url = existing[0]?.image_url;
      
      if (req.file) {
        image_url = `/uploads/${req.file.filename}`;
      }
      
      await pool.query(`
        UPDATE prescriptions 
        SET prescription_code = ?, image_url = ?, prescription_date = ?, entered_by = ?, transaction_id = ?, notes = ?
        WHERE id = ?
      `, [prescription_code, image_url, prescription_date, entered_by, transaction_id, notes, id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating prescription:', err);
      res.status(500).json({ success: false, message: 'Failed to update prescription' });
    }
  });

  // Delete a prescription
  app.delete('/api/inventory/prescriptions/:id', authenticate, checkPermission('Resep Dokter', 'delete'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM prescriptions WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting prescription:', err);
      res.status(500).json({ success: false, message: 'Failed to delete prescription' });
    }
  });
}

module.exports = registerInventoryRoutes;
