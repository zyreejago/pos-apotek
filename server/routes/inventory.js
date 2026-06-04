
const { createJournalEntry } = require('../utils/journal');

function registerInventoryRoutes(app, pool, authenticate, checkPermission, upload, createAuditTrail) {
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

  // Get all pending/revision/rejected batches (global) for approval management
  app.get('/api/inventory/pending-batches', authenticate, checkPermission('Approval Faktur', 'show'), async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT b.*, s.name as supplier_name, p.name as product_name, p.status as product_status, p.unit as product_unit, p.purchase_unit as product_purchase_unit, p.unit_multiplier as product_unit_multiplier
        FROM batches b 
        LEFT JOIN suppliers s ON b.supplier_id = s.id 
        LEFT JOIN products p ON b.product_id = p.id
        WHERE b.status IN ('pending', 'revision', 'rejected')
        ORDER BY b.created_at DESC
      `);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching pending batches:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Create a new batch
  app.post('/api/inventory/batches', authenticate, checkPermission('Management Product', 'create'), upload.single('image'), async (req, res) => {
    try {
      const { product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, cost_price, expired_date, dp_amount, due_date, notes } = req.body;
      const image_url = req.file ? `/uploads/${req.file.filename}` : null;

      const formattedPurchaseDate = purchase_date && purchase_date !== '' ? purchase_date.substring(0, 10) : null;
      const formattedExpiredDate = expired_date && expired_date !== '' ? expired_date.substring(0, 10) : null;
      const formattedDueDate = due_date && due_date !== '' ? due_date.substring(0, 10) : null;

      // Approval Logic: Check if total amount > 2,000,000
      const totalAmount = Number(initial_quantity) * Number(cost_price);
      const needsApproval = totalAmount > 2000000;
      const status = needsApproval ? 'pending' : 'approved';

      const [result] = await pool.query(`
        INSERT INTO batches (product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date, dp_amount, due_date, image_url, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product_id, 
        supplier_id && supplier_id !== '' ? Number(supplier_id) : null, 
        batch_number || null, 
        stock_type, 
        formattedPurchaseDate, 
        Number(initial_quantity), 
        Number(initial_quantity), 
        Number(cost_price), 
        formattedExpiredDate, 
        dp_amount && dp_amount !== '' ? Number(dp_amount) : null, 
        formattedDueDate, 
        image_url,
        status,
        notes || null
      ]);
      
      // Update product's total stock only if approved
      if (status === 'approved') {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          await connection.query(`
            UPDATE products 
            SET stock = stock + ?
            WHERE id = ?
          `, [Number(initial_quantity), product_id]);

          // Get product name for journal description
          const [product] = await connection.query('SELECT name FROM products WHERE id = ?', [product_id]);
          const productName = product[0]?.name || `Produk #${product_id}`;

          // Create Journal Entry
          const journalItems = [
            { accountCode: '110', debit: totalAmount } // Persediaan
          ];

          if (stock_type === 'lunas') {
            journalItems.push({ accountCode: '101', credit: totalAmount }); // Kas
          } else if (stock_type === 'dp' && dp_amount) {
            journalItems.push(
              { accountCode: '101', credit: Number(dp_amount) }, // Kas (DP)
              { accountCode: '201', credit: totalAmount - Number(dp_amount) } // Hutang Usaha (Sisa)
            );
          } else {
            journalItems.push({ accountCode: '201', credit: totalAmount }); // Hutang Usaha
          }

          await createJournalEntry(connection, null, formattedPurchaseDate || new Date().toISOString().split('T')[0], 
            `Pembelian stok: ${productName} (${initial_quantity} pcs)`,
            journalItems
          );

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          console.error('Error in batch creation transaction:', error);
          // We don't throw here to ensure the batch record is at least created, 
          // but in production we might want to handle this better.
        } finally {
          connection.release();
        }
      }

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'create',
        description: `Membuat batch baru untuk produk #${product_id} (Status: ${status}, Total: ${totalAmount})`,
      });

      res.json({ success: true, data: { id: result.insertId, ...req.body, status } });
    } catch (err) {
      console.error('Error creating batch:', err);
      res.status(500).json({ success: false, message: 'Failed to create batch' });
    }
  });

  // Update a batch
  app.put('/api/inventory/batches/:id', authenticate, checkPermission('Management Product', 'edit'), upload.single('image'), async (req, res) => {
    try {
      const { id } = req.params;
      const { supplier_id, batch_number, stock_type, purchase_date, initial_quantity, remaining_quantity, cost_price, expired_date, dp_amount, due_date, notes } = req.body;
      
      // Get the old remaining_quantity first to calculate the difference
      const [oldBatch] = await pool.query('SELECT remaining_quantity, product_id, image_url, status FROM batches WHERE id = ?', [id]);
      if (oldBatch.length === 0) {
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }
      const oldQty = oldBatch[0].remaining_quantity;
      const product_id = oldBatch[0].product_id;
      const current_image_url = oldBatch[0].image_url;
      const oldStatus = oldBatch[0].status;
      const new_image_url = req.file ? `/uploads/${req.file.filename}` : null;
      const image_url = new_image_url || current_image_url;

      const formattedPurchaseDate = purchase_date && purchase_date !== '' ? purchase_date.substring(0, 10) : null;
      const formattedExpiredDate = expired_date && expired_date !== '' ? expired_date.substring(0, 10) : null;
      const formattedDueDate = due_date && due_date !== '' ? due_date.substring(0, 10) : null;

      // Re-evaluate approval
      const totalAmount = Number(initial_quantity) * Number(cost_price);
      let status = oldStatus;
      
      if (totalAmount > 2000000) {
        // If it's over 2M, it must be pending (unless already approved, but usually we don't re-approve)
        // or if it was rejected/revision, it goes back to pending
        if (oldStatus !== 'approved') {
          status = 'pending';
        }
      } else {
        // If it's under 2M, it can be approved automatically
        status = 'approved';
      }

      // If status becomes pending or approved, the cashier has updated/corrected the invoice, 
      // so we should clear the old revision notes.
      const finalNotes = (status === 'pending' || status === 'approved') ? null : (notes || null);

      await pool.query(`
        UPDATE batches 
        SET supplier_id = ?, batch_number = ?, stock_type = ?, purchase_date = ?, initial_quantity = ?, remaining_quantity = ?, cost_price = ?, expired_date = ?, dp_amount = ?, due_date = ?, image_url = ?, status = ?, notes = ?
        WHERE id = ?
      `, [
        supplier_id && supplier_id !== '' ? Number(supplier_id) : null, 
        batch_number || null, 
        stock_type, 
        formattedPurchaseDate, 
        Number(initial_quantity), 
        Number(remaining_quantity), 
        Number(cost_price), 
        formattedExpiredDate, 
        dp_amount && dp_amount !== '' ? Number(dp_amount) : null, 
        formattedDueDate, 
        image_url, 
        status,
        finalNotes,
        id
      ]);
      
      // Stock update and Journaling logic based on status transition
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Handle stock changes
        if (oldStatus === 'approved' && status === 'approved') {
          const diff = Number(remaining_quantity) - oldQty;
          await connection.query(`
            UPDATE products 
            SET stock = GREATEST(stock + ?, 0)
            WHERE id = ?
          `, [diff, product_id]);
        } else if (oldStatus !== 'approved' && status === 'approved') {
          await connection.query(`
            UPDATE products 
            SET stock = stock + ?, status = "active"
            WHERE id = ?
          `, [Number(remaining_quantity), product_id]);
        } else if (oldStatus === 'approved' && status !== 'approved') {
          await connection.query(`
            UPDATE products 
            SET stock = GREATEST(stock - ?, 0)
            WHERE id = ?
          `, [oldQty, product_id]);
        }

        // 2. Handle Journaling (only if it becomes approved now, or was approved and amount changed)
        // This is a bit complex for a simple POS, usually we just log the change.
        // But to follow the "Approved = Journal Created" rule:
        if (status === 'approved' && (oldStatus !== 'approved' || totalAmount !== (oldQty * Number(oldBatch[0].cost_price)))) {
           // Create journal for purchase (or adjustment if edited)
           const [product] = await connection.query('SELECT name FROM products WHERE id = ?', [product_id]);
           const productName = product[0]?.name || `Produk #${product_id}`;
           
           const journalItems = [{ accountCode: '110', debit: totalAmount }];
           if (stock_type === 'lunas') journalItems.push({ accountCode: '101', credit: totalAmount });
           else if (stock_type === 'dp' && dp_amount) {
             journalItems.push({ accountCode: '101', credit: Number(dp_amount) });
             journalItems.push({ accountCode: '201', credit: totalAmount - Number(dp_amount) });
           } else journalItems.push({ accountCode: '201', credit: totalAmount });

           await createJournalEntry(connection, null, formattedPurchaseDate || new Date().toISOString().split('T')[0], 
             `Update/Pembelian stok: ${productName} (${initial_quantity} pcs)`,
             journalItems
           );
        }

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        console.error('Error in batch update transaction:', err);
      } finally {
        connection.release();
      }

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'edit',
        description: `Memperbarui batch #${id} untuk produk #${product_id} (Status: ${status})`,
      });

      res.json({ success: true, status });
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

        await createAuditTrail({
          user_id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          module: 'Management Product',
          action: 'delete',
          description: `Menghapus batch #${id} untuk produk #${product_id}`,
        });
      } else {
        await pool.query('DELETE FROM batches WHERE id = ?', [id]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting batch:', err);
      res.status(500).json({ success: false, message: 'Failed to delete batch' });
    }
  });

  // Approval Endpoints
  app.put('/api/inventory/batches/:id/approve', authenticate, checkPermission('Approval Faktur', 'edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const [batchRows] = await pool.query('SELECT * FROM batches WHERE id = ?', [id]);
      
      if (batchRows.length === 0) return res.status(404).json({ success: false, message: 'Batch not found' });
      const batch = batchRows[0];
      if (batch.status === 'approved') return res.status(400).json({ success: false, message: 'Batch already approved' });

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        await connection.query('UPDATE batches SET status = ? WHERE id = ?', ['approved', id]);
        
        // Update stock AND activate product if it was pending
        await connection.query('UPDATE products SET stock = stock + ?, status = "active" WHERE id = ?', [batch.remaining_quantity, batch.product_id]);

        // Get product name for journal description
        const [product] = await connection.query('SELECT name FROM products WHERE id = ?', [batch.product_id]);
        const productName = product[0]?.name || `Produk #${batch.product_id}`;

        // Create Journal Entry
        const totalAmount = Number(batch.initial_quantity) * Number(batch.cost_price);
        const journalItems = [
          { accountCode: '110', debit: totalAmount } // Persediaan
        ];

        if (batch.stock_type === 'lunas') {
          journalItems.push({ accountCode: '101', credit: totalAmount }); // Kas
        } else if (batch.stock_type === 'dp' && batch.dp_amount) {
          journalItems.push(
            { accountCode: '101', credit: Number(batch.dp_amount) }, // Kas (DP)
            { accountCode: '201', credit: totalAmount - Number(batch.dp_amount) } // Hutang Usaha (Sisa)
          );
        } else {
          journalItems.push({ accountCode: '201', credit: totalAmount }); // Hutang Usaha
        }

        const purchaseDate = batch.purchase_date ? batch.purchase_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        await createJournalEntry(connection, null, purchaseDate, 
          `Pembelian stok (Approved): ${productName} (${batch.initial_quantity} pcs)`,
          journalItems
        );

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error('Error approving batch:', error);
        return res.status(500).json({ success: false, message: 'Failed to approve batch' });
      } finally {
        connection.release();
      }

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Approval Faktur',
        action: 'edit',
        description: `Menyetujui batch #${id} untuk produk #${batch.product_id}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error approving batch:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.put('/api/inventory/batches/:id/reject', authenticate, checkPermission('Approval Faktur', 'edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const [batch] = await pool.query('SELECT status FROM batches WHERE id = ?', [id]);
      
      if (batch.length === 0) return res.status(404).json({ success: false, message: 'Batch not found' });
      if (batch[0].status === 'rejected') return res.status(400).json({ success: false, message: 'Batch already rejected' });

      await pool.query('UPDATE batches SET status = ? WHERE id = ?', ['rejected', id]);

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Approval Faktur',
        action: 'edit',
        description: `Menolak batch #${id}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error rejecting batch:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.put('/api/inventory/batches/:id/revision', authenticate, checkPermission('Approval Faktur', 'edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      await pool.query('UPDATE batches SET status = ?, notes = ? WHERE id = ?', ['revision', notes || null, id]);

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Approval Faktur',
        action: 'edit',
        description: `Meminta perbaikan untuk batch #${id}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error requesting revision:', err);
      res.status(500).json({ success: false, message: 'Server error' });
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

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Resep Dokter',
        action: 'create',
        description: `Membuat resep baru: ${prescription_code || result.insertId}`,
      });

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

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Resep Dokter',
        action: 'edit',
        description: `Memperbarui resep: ${prescription_code || id}`,
      });

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

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Resep Dokter',
        action: 'delete',
        description: `Menghapus resep: ${id}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting prescription:', err);
      res.status(500).json({ success: false, message: 'Failed to delete prescription' });
    }
  });
}

module.exports = registerInventoryRoutes;
