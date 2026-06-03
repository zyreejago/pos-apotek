
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
      const { product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, cost_price, expired_date, dp_amount, due_date } = req.body;
      
      const formattedPurchaseDate = purchase_date ? purchase_date.substring(0, 10) : null;
      const formattedExpiredDate = expired_date ? expired_date.substring(0, 10) : null;
      const formattedDueDate = due_date ? due_date.substring(0, 10) : null;

      const [result] = await pool.query(`
        INSERT INTO batches (product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date, dp_amount, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [product_id, supplier_id, batch_number, stock_type, formattedPurchaseDate, initial_quantity, initial_quantity, cost_price, formattedExpiredDate, dp_amount ? Number(dp_amount) : null, formattedDueDate]);
      
      // Update product's total stock by adding the new batch's remaining quantity
      await pool.query(`
        UPDATE products 
        SET stock = stock + ?
        WHERE id = ?
      `, [initial_quantity, product_id]);

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
      const { supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date, dp_amount, due_date } = req.body;
      
      // Get the old remaining_quantity first to calculate the difference
      const [oldBatch] = await pool.query('SELECT remaining_quantity, product_id FROM batches WHERE id = ?', [id]);
      if (oldBatch.length === 0) {
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }
      const oldQty = oldBatch[0].remaining_quantity;
      const product_id = oldBatch[0].product_id;

      const formattedPurchaseDate = purchase_date ? purchase_date.substring(0, 10) : null;
      const formattedExpiredDate = expired_date ? expired_date.substring(0, 10) : null;
      const formattedDueDate = due_date ? due_date.substring(0, 10) : null;

      await pool.query(`
        UPDATE batches 
        SET supplier_id = ?, batch_number = ?, stock_type = ?, purchase_date = ?, initial_quantity = ?, remaining_quantity = ?, cost_price = ?, expired_date = ?, dp_amount = ?, due_date = ?
        WHERE id = ?
      `, [supplier_id, batch_number, stock_type, formattedPurchaseDate, initial_quantity, remaining_quantity, cost_price, formattedExpiredDate, dp_amount ? Number(dp_amount) : null, formattedDueDate, id]);
      
      const diff = remaining_quantity - oldQty;
      await pool.query(`
        UPDATE products 
        SET stock = GREATEST(stock + ?, 0)
        WHERE id = ?
      `, [diff, product_id]);

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
      const [batch] = await pool.query('SELECT product_id, remaining_quantity FROM batches WHERE id = ?', [id]);
      if (batch.length > 0) {
        const product_id = batch[0].product_id;
        const qty = batch[0].remaining_quantity;
        await pool.query('DELETE FROM batches WHERE id = ?', [id]);
        await pool.query(`
          UPDATE products 
          SET stock = GREATEST(stock - ?, 0)
          WHERE id = ?
        `, [qty, product_id]);
      } else {
        await pool.query('DELETE FROM batches WHERE id = ?', [id]);
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
