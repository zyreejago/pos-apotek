
const { createJournalEntry } = require('../utils/journal');

function registerInventoryRoutes(app, pool, authenticate, checkPermission, upload, createAuditTrail) {
  // Get all batches for a product with DP payments
  app.get('/api/inventory/batches/:productId', authenticate, async (req, res) => {
    try {
      const { productId } = req.params;
      const [rows] = await pool.query(`
        SELECT b.*, s.name as supplier_name 
        FROM batches b 
        LEFT JOIN suppliers s ON b.supplier_id = s.id 
        WHERE b.product_id = ? AND b.is_archived = FALSE
        ORDER BY b.expired_date ASC, b.id ASC
      `, [productId]);

      // For each batch, try to get its DP payments and return qty
      for (const batch of rows) {
        try {
          const [dpPayments] = await pool.query(
            'SELECT * FROM batch_dp_payments WHERE batch_id = ? ORDER BY created_at ASC',
            [batch.id]
          );
          batch.dp_payments = dpPayments;
        } catch (dpErr) {
          batch.dp_payments = [];
        }
        try {
          const [retRows] = await pool.query(
            'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM purchase_return_items WHERE batch_id = ?',
            [batch.id]
          );
          batch.qty_returned = Number(retRows[0].qty);
        } catch (retErr) {
          batch.qty_returned = 0;
        }
        try {
          const [restoreRows] = await pool.query(
            'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM sale_return_items WHERE batch_id = ?',
            [batch.id]
          );
          batch.qty_restored = Number(restoreRows[0].qty);
        } catch (restoreErr) {
          batch.qty_restored = 0;
        }
      }

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching batches:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch batches' });
    }
  });

  // Add DP payment to a batch
  app.post('/api/inventory/batches/:batchId/dp-payments', authenticate, checkPermission('Management Product', 'edit'), async (req, res) => {
    try {
      const { batchId } = req.params;
      const { amount, payment_date, notes, payment_method } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Jumlah DP harus lebih dari 0' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const paymentDate = payment_date || new Date().toISOString().split('T')[0];
        const method = payment_method || 'cash';

        await connection.query(
          'INSERT INTO batch_dp_payments (batch_id, amount, payment_date, notes, payment_method) VALUES (?, ?, ?, ?, ?)',
          [batchId, amount, paymentDate, notes, method]
        );

        // Get batch & product info for journal description
        const [batchRows] = await connection.query(
          'SELECT b.product_id, p.name as product_name FROM batches b JOIN products p ON b.product_id = p.id WHERE b.id = ?',
          [batchId]
        );
        const productName = batchRows[0]?.product_name || `Batch #${batchId}`;

        // Create journal: Debit Hutang Usaha, Credit Kas/Bank
        const creditCode = method === 'transfer' ? '102' : '101';
        await createJournalEntry(connection, null, paymentDate,
          `Pembayaran DP supplier: ${productName} (Rp ${Number(amount).toLocaleString('id-ID')})`,
          [
            { accountCode: '201', debit: Number(amount) },
            { accountCode: creditCode, credit: Number(amount) }
          ]
        );

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'create',
        description: `Menambahkan DP sebesar ${amount} untuk batch #${batchId}`
      });

      res.json({ success: true, message: 'DP berhasil ditambahkan' });
    } catch (err) {
      console.error('Error adding DP payment:', err);
      res.status(500).json({ success: false, message: 'Failed to add DP payment' });
    }
  });

  // Delete DP payment from a batch
  app.delete('/api/inventory/batches/:batchId/dp-payments/:paymentId', authenticate, checkPermission('Management Product', 'edit'), async (req, res) => {
    try {
      const { paymentId } = req.params;

      await pool.query('DELETE FROM batch_dp_payments WHERE id = ?', [paymentId]);

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'delete',
        description: `Menghapus DP #${paymentId}`
      });

      res.json({ success: true, message: 'DP berhasil dihapus' });
    } catch (err) {
      console.error('Error deleting DP payment:', err);
      res.status(500).json({ success: false, message: 'Failed to delete DP payment' });
    }
  });

  // Get all batches (Purchase History / Riwayat Pembelian)
  app.get('/api/inventory/history', authenticate, checkPermission('Riwayat Pembelian', 'show'), async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT b.*, s.name as supplier_name, p.name as product_name
        FROM batches b 
        LEFT JOIN suppliers s ON b.supplier_id = s.id 
        LEFT JOIN products p ON b.product_id = p.id
        ORDER BY b.created_at DESC
      `);

      // For each batch, get its DP payments
      for (const batch of rows) {
        try {
          const [dpPayments] = await pool.query(
            'SELECT * FROM batch_dp_payments WHERE batch_id = ? ORDER BY created_at ASC',
            [batch.id]
          );
          batch.dp_payments = dpPayments;
        } catch (dpErr) {
          batch.dp_payments = [];
        }
      }

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching history:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
  });

  // Archive/Unarchive a batch
  app.put('/api/inventory/batches/:id/archive', authenticate, checkPermission('Management Product', 'edit'), async (req, res) => {
    try {
      const { id } = req.params;
      const { is_archived } = req.body;
      
      // Get the batch first to check stock_type
      const [batch] = await pool.query('SELECT stock_type, initial_quantity FROM batches WHERE id = ?', [id]);
      if (batch.length === 0) {
        return res.status(404).json({ success: false, message: 'Batch tidak ditemukan' });
      }
      
      // If trying to archive, check if stock_type is 'lunas' or 'retur'
      if (is_archived && batch[0].stock_type !== 'lunas' && batch[0].stock_type !== 'retur') {
        return res.status(400).json({ success: false, message: 'Hanya faktur dengan tipe stok \"lunas\" atau \"retur\" yang dapat diarsipkan' });
      }

      // For 'retur' stock_type, only allow archive if all qty has been returned
      if (is_archived && batch[0].stock_type === 'retur') {
        const [retRows] = await pool.query(
          'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM purchase_return_items WHERE batch_id = ?',
          [id]
        );
        const totalReturned = Number(retRows[0].qty);
        if (totalReturned < batch[0].initial_quantity) {
          return res.status(400).json({
            success: false,
            message: `Barang retur belum lengkap (${totalReturned}/${batch[0].initial_quantity}). Arsip hanya bisa dilakukan setelah semua qty diretur.`
          });
        }
      }
      
      await pool.query('UPDATE batches SET is_archived = ? WHERE id = ?', [is_archived ? 1 : 0, id]);
      
      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Management Product',
        action: 'edit',
        description: `${is_archived ? 'Mengarsipkan' : 'Membuka arsip'} faktur/batch #${id}`,
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error archiving batch:', err);
      res.status(500).json({ success: false, message: 'Server error' });
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

  // Helper function to format date for MySQL (YYYY-MM-DD)
  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  // Create a new batch
  app.post('/api/inventory/batches', authenticate, checkPermission('Management Product', 'create'), upload.single('image'), async (req, res) => {
    try {
      const { product_id, supplier_id, batch_number, stock_type, purchase_date, initial_quantity, cost_price, expired_date, dp_amount, due_date, notes } = req.body;
      const image_url = req.file ? `/uploads/${req.file.filename}` : null;

      const formattedPurchaseDate = formatDate(purchase_date);
      const formattedExpiredDate = formatDate(expired_date);
      const formattedDueDate = formatDate(due_date);

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
      
      // Auto-create DP 1 payment record if dp_amount is filled
      const batchId = result.insertId;
      if (stock_type === 'dp' && dp_amount && Number(dp_amount) > 0) {
        try {
          await pool.query(
            'INSERT INTO batch_dp_payments (batch_id, amount, payment_date, payment_method, notes) VALUES (?, ?, ?, ?, ?)',
            [batchId, Number(dp_amount), formattedPurchaseDate || new Date().toISOString().split('T')[0], 'cash', 'DP 1 (saat pembuatan faktur)']
          );
        } catch (dpErr) {
          console.error('Error auto-creating DP payment:', dpErr);
        }
      }
      
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
      
      // Get the old batch first
      const [oldBatch] = await pool.query('SELECT remaining_quantity, product_id, image_url, status, stock_type FROM batches WHERE id = ?', [id]);
      if (oldBatch.length === 0) {
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }

      // Prevent manual edit of 'retur' stock_type
      if (oldBatch[0].stock_type === 'retur' && stock_type !== 'retur') {
        return res.status(400).json({ success: false, message: 'Batch dengan tipe stok "retur" tidak dapat diubah secara manual' });
      }
      if (stock_type === 'retur' && oldBatch[0].stock_type !== 'retur') {
        return res.status(400).json({ success: false, message: 'Tipe stok "retur" hanya dapat diatur oleh sistem' });
      }
      const oldQty = oldBatch[0].remaining_quantity;
      const product_id = oldBatch[0].product_id;
      const current_image_url = oldBatch[0].image_url;
      const oldStatus = oldBatch[0].status;
      const new_image_url = req.file ? `/uploads/${req.file.filename}` : null;
      const image_url = new_image_url || current_image_url;

      const formattedPurchaseDate = formatDate(purchase_date);
      const formattedExpiredDate = formatDate(expired_date);
      const formattedDueDate = formatDate(due_date);

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
        if (status === 'approved') {
          const [product] = await connection.query('SELECT name, product_category FROM products WHERE id = ?', [product_id]);
          const productName = product[0]?.name || `Produk #${product_id}`;
          const isObat = product[0]?.product_category === 'OBAT';
          const persediaanCode = isObat ? '103' : '104';

          if (oldStatus !== 'approved' || totalAmount !== (oldQty * Number(oldBatch[0].cost_price))) {
             // Create journal for purchase (or adjustment if edited)
             const journalItems = [{ accountCode: persediaanCode, debit: totalAmount }];
             if (stock_type === 'lunas') journalItems.push({ accountCode: '101', credit: totalAmount });
             else if (stock_type === 'dp' && dp_amount) {
               journalItems.push({ accountCode: '101', credit: Number(dp_amount) });
               journalItems.push({ accountCode: '201', credit: totalAmount - Number(dp_amount) });
             } else journalItems.push({ accountCode: '201', credit: totalAmount });

             await createJournalEntry(connection, null, formattedPurchaseDate || new Date().toISOString().split('T')[0], 
               `Update/Pembelian stok: ${productName} (${initial_quantity} pcs)`,
               journalItems
             );
          } else if (oldStatus === 'approved') {
            // Check if stock_type transitioned to 'lunas' (Debt Payment)
            if ((oldBatch[0].stock_type === 'belum_bayar' || oldBatch[0].stock_type === 'dp') && stock_type === 'lunas') {
              const debtPaid = oldBatch[0].stock_type === 'dp' 
                ? (Number(oldBatch[0].initial_quantity) * Number(oldBatch[0].cost_price)) - Number(oldBatch[0].dp_amount || 0)
                : (Number(oldBatch[0].initial_quantity) * Number(oldBatch[0].cost_price));
              
              if (debtPaid > 0) {
                const journalItems = [
                  { accountCode: '201', debit: debtPaid }, // Debit Hutang Usaha Supplier
                  { accountCode: '101', credit: debtPaid }  // Credit Kas
                ];
                await createJournalEntry(connection, null, new Date().toISOString().split('T')[0], 
                  `Pembayaran hutang untuk: ${productName} (Batch #${id})`,
                  journalItems
                );
              }
            }
          }
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

  // Mark batch as expired and record journaling
  app.put('/api/inventory/batches/:id/expire', authenticate, checkPermission('Management Product', 'edit'), async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [batchRows] = await connection.query('SELECT * FROM batches WHERE id = ?', [id]);
      if (batchRows.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }
      const batch = batchRows[0];
      const qty = batch.remaining_quantity;
      if (qty <= 0) {
        connection.release();
        return res.status(400).json({ success: false, message: 'Batch has no remaining stock to expire' });
      }

      // Update batch remaining quantity to 0 and note as Expired
      await connection.query('UPDATE batches SET remaining_quantity = 0, notes = "Expired" WHERE id = ?', [id]);

      // Reduce product stock
      await connection.query('UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [qty, batch.product_id]);

      // Get product info
      const [product] = await connection.query('SELECT name, product_category, cost_price FROM products WHERE id = ?', [batch.product_id]);
      const productName = product[0]?.name || `Produk #${batch.product_id}`;
      const isObat = product[0]?.product_category === 'OBAT';
      const inventoryAccount = isObat ? '103' : '104';
      const expiredValue = qty * Number(product[0]?.cost_price || 0);

      // Create journal: Debit Beban Obat Expired (526), Credit Persediaan Obat/Non-Obat
      const journalItems = [
        { accountCode: '526', debit: expiredValue },
        { accountCode: inventoryAccount, credit: expiredValue }
      ];

      await createJournalEntry(connection, null, new Date().toISOString().split('T')[0],
        `Obat/Barang Expired: ${productName} (${qty} pcs)`,
        journalItems
      );

      await connection.commit();
      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      console.error('Error expiring batch:', err);
      res.status(500).json({ success: false, message: 'Failed to expire batch' });
    } finally {
      connection.release();
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

        // Get product name and product_category for journal description
        const [product] = await connection.query('SELECT name, product_category FROM products WHERE id = ?', [batch.product_id]);
        const productName = product[0]?.name || `Produk #${batch.product_id}`;
        const isObat = product[0]?.product_category === 'OBAT';
        const persediaanCode = isObat ? '103' : '104';

        // Create Journal Entry
        const totalAmount = Number(batch.initial_quantity) * Number(batch.cost_price);
        const journalItems = [
          { accountCode: persediaanCode, debit: totalAmount } // Persediaan Obat / Non-Obat
        ];

        if (batch.stock_type === 'lunas') {
          journalItems.push({ accountCode: '101', credit: totalAmount }); // Kas
        } else if (batch.stock_type === 'dp' && batch.dp_amount) {
          journalItems.push(
            { accountCode: '101', credit: Number(batch.dp_amount) }, // Kas (DP)
            { accountCode: '201', credit: totalAmount - Number(batch.dp_amount) } // Hutang Usaha Supplier (Sisa)
          );
        } else {
          journalItems.push({ accountCode: '201', credit: totalAmount }); // Hutang Usaha Supplier
        }

        const purchaseDate = batch.purchase_date ? (batch.purchase_date instanceof Date ? batch.purchase_date.toISOString().split('T')[0] : batch.purchase_date.substring(0, 10)) : new Date().toISOString().split('T')[0];

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
      
      // Fetch items for each prescription
      const prescriptionsWithItems = [];
      for (const prescription of rows) {
        const [items] = await pool.query(`
          SELECT pi.*, pr.name as product_name
          FROM prescription_items pi
          JOIN products pr ON pi.product_id = pr.id
          WHERE pi.prescription_id = ?
        `, [prescription.id]);
        
        prescriptionsWithItems.push({
          ...prescription,
          items: items
        });
      }
      
      res.json({ success: true, data: prescriptionsWithItems });
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch prescriptions' });
    }
  });

  // Create a prescription
  app.post('/api/inventory/prescriptions', authenticate, checkPermission('Resep Dokter', 'create'), upload.single('image'), async (req, res) => {
    try {
      const { prescription_code, prescription_date, entered_by, transaction_id, notes, items } = req.body;
      const image_url = req.file ? `/uploads/${req.file.filename}` : null;
      
      // Format date to YYYY-MM-DD
      const formattedDate = prescription_date ? new Date(prescription_date).toISOString().split('T')[0] : null;
      
      const [result] = await pool.query(`
        INSERT INTO prescriptions (prescription_code, image_url, prescription_date, entered_by, transaction_id, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [prescription_code, image_url, formattedDate, entered_by, transaction_id, notes]);
      
      // Insert items if provided
      if (items) {
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        for (const item of parsedItems) {
          await pool.query(`
            INSERT INTO prescription_items (prescription_id, product_id, quantity, selling_price)
            VALUES (?, ?, ?, ?)
          `, [result.insertId, item.product_id || item.id, item.quantity, item.selling_price]);
        }
      }

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
      const { prescription_code, prescription_date, entered_by, transaction_id, notes, items } = req.body;
      
      // Format date to YYYY-MM-DD
      const formattedDate = prescription_date ? new Date(prescription_date).toISOString().split('T')[0] : null;
      
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
      `, [prescription_code, image_url, formattedDate, entered_by, transaction_id, notes, id]);

      // Update items if provided
      if (items) {
        // First delete existing items
        await pool.query('DELETE FROM prescription_items WHERE prescription_id = ?', [id]);
        
        // Then insert new items
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        for (const item of parsedItems) {
          await pool.query(`
            INSERT INTO prescription_items (prescription_id, product_id, quantity, selling_price)
            VALUES (?, ?, ?, ?)
          `, [id, item.product_id || item.id, item.quantity, item.selling_price]);
        }
      }

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
      await pool.query('DELETE FROM prescription_items WHERE prescription_id = ?', [id]);
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
