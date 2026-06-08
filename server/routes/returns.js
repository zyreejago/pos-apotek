const { createJournalEntry } = require('../utils/journal');

const generateReturnNo = async (pool, table, prefix, year) => {
  const [rows] = await pool.query(
    `SELECT return_no FROM ${table} WHERE return_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${year}-%`]
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const last = rows[0].return_no;
    const parts = last.split('-');
    nextNum = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
};

module.exports = function registerReturnRoutes(app, pool, authenticate, checkPermission, createAuditTrail) {
  // ========================
  // PURCHASE RETURNS
  // ========================

  // Helper: get or create a virtual purchase record for a batch_number
  const ensurePurchaseRecord = async (connection, batchNumber, supplierId) => {
    // Check if a purchase with this batch_number exists (using invoice_no as batch_number)
    const [existing] = await connection.query(
      'SELECT id FROM purchases WHERE invoice_no = ?', [batchNumber]
    );
    if (existing.length > 0) return existing[0].id;

    // Calculate total from batches with this batch_number
    const [batchRows] = await connection.query(
      `SELECT SUM(b.initial_quantity * b.cost_price) as total
       FROM batches b WHERE b.batch_number = ? AND b.supplier_id = ?`,
      [batchNumber, supplierId]
    );
    const totalAmount = Number(batchRows[0]?.total || 0);

    const [result] = await connection.query(
      'INSERT INTO purchases (supplier_id, total_amount, invoice_no) VALUES (?, ?, ?)',
      [supplierId, totalAmount, batchNumber]
    );
    return result.insertId;
  };

  // Helper: ensure purchase_item records exist for a batch
  const ensurePurchaseItemRecord = async (connection, purchaseId, batch) => {
    const [existing] = await connection.query(
      'SELECT id FROM purchase_items WHERE purchase_id = ? AND batch_id = ?',
      [purchaseId, batch.id]
    );
    if (existing.length > 0) return existing[0].id;

    const [result] = await connection.query(
      'INSERT INTO purchase_items (purchase_id, product_id, batch_id, quantity, cost_price) VALUES (?, ?, ?, ?, ?)',
      [purchaseId, batch.product_id, batch.id, batch.initial_quantity, batch.cost_price]
    );
    return result.insertId;
  };

  // Lookup faktur by batch_number
  app.get('/api/returns/purchases/lookup', authenticate, checkPermission('Retur Pembelian', 'show'), async (req, res) => {
    try {
      const { invoice_no } = req.query;
      if (!invoice_no) return res.status(400).json({ message: 'invoice_no required' });

      // Search batches by invoice_number (or batch_number for backward compat)
      const [batches] = await pool.query(`
        SELECT b.*, s.name as supplier_name, s.accepts_return, s.return_notes,
               p.name as product_name, p.product_category
        FROM batches b
        JOIN suppliers s ON b.supplier_id = s.id
        JOIN products p ON b.product_id = p.id
        WHERE (b.invoice_number = ? OR b.batch_number = ?) AND b.is_archived = FALSE
        ORDER BY b.id ASC
      `, [invoice_no, invoice_no]);

      if (batches.length === 0) return res.status(404).json({ message: 'Faktur tidak ditemukan' });

      const supplier = {
        id: batches[0].supplier_id,
        name: batches[0].supplier_name,
        accepts_return: !!batches[0].accepts_return,
        return_notes: batches[0].return_notes,
      };

      const totalAmount = batches.reduce((sum, b) => sum + (Number(b.initial_quantity) * Number(b.cost_price)), 0);

      const items = [];
      for (const batch of batches) {
        // Check if a purchase_item exists for this batch
        const [piRows] = await pool.query(
          `SELECT pi.id as purchase_item_id FROM purchase_items pi
           JOIN purchases p ON pi.purchase_id = p.id
           WHERE pi.batch_id = ? AND p.invoice_no = ?`,
          [batch.id, invoice_no]
        );
        const purchaseItemId = piRows.length > 0 ? piRows[0].purchase_item_id : null;

        // Count already returned qty for this batch
        let qtyAlreadyReturned = 0;
        if (purchaseItemId) {
          const [retRows] = await pool.query(
            'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM purchase_return_items WHERE purchase_item_id = ?',
            [purchaseItemId]
          );
          qtyAlreadyReturned = Number(retRows[0].qty);
        } else {
          const [retRows] = await pool.query(
            'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM purchase_return_items WHERE batch_id = ?',
            [batch.id]
          );
          qtyAlreadyReturned = Number(retRows[0].qty);
        }

        const qtyReturnable = batch.initial_quantity - qtyAlreadyReturned;

        items.push({
          purchase_item_id: purchaseItemId,
          batch_id: batch.id,
          product_id: batch.product_id,
          product_name: batch.product_name,
          quantity: batch.initial_quantity,
          buy_price: Number(batch.cost_price),
          batch_number: batch.batch_number,
          expired_date: batch.expired_date,
          current_stock: Number(batch.remaining_quantity),
          qty_already_returned: qtyAlreadyReturned,
          qty_returnable: Math.max(0, qtyReturnable),
        });
      }

      res.json({
        purchase: {
          id: null,
          invoice_no,
          date: batches[0].purchase_date || batches[0].created_at,
          total: totalAmount,
        },
        supplier,
        items,
      });
    } catch (err) {
      console.error('Error looking up purchase:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Submit purchase return
  app.post('/api/returns/purchases', authenticate, checkPermission('Retur Pembelian', 'create'), async (req, res) => {
    const { invoice_no, purchase_id, reason, handling, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items wajib diisi' });
    }

    if (!handling || !['reduce_payable', 'credit_note', 'write_off_loss'].includes(handling)) {
      return res.status(400).json({ message: 'Handling tidak valid' });
    }

    if (!invoice_no && !purchase_id) {
      return res.status(400).json({ message: 'invoice_no atau purchase_id wajib diisi' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Resolve batch_number (invoice_no)
      let batchNumber = invoice_no;
      if (!batchNumber && purchase_id) {
        const [pRows] = await connection.query('SELECT invoice_no FROM purchases WHERE id = ?', [purchase_id]);
        if (pRows.length > 0) batchNumber = pRows[0].invoice_no;
        else throw new Error('Purchase tidak ditemukan');
      }

      // Get all batches with this batch_number for supplier info
      const [batchRows] = await connection.query(
        'SELECT b.*, p.product_category FROM batches b JOIN products p ON b.product_id = p.id WHERE b.batch_number = ? AND b.is_archived = FALSE',
        [batchNumber]
      );
      if (batchRows.length === 0) throw new Error('Batch tidak ditemukan');

      const supplierId = batchRows[0].supplier_id;

      // Check supplier accepts_return
      const [suppRows] = await connection.query('SELECT accepts_return FROM suppliers WHERE id = ?', [supplierId]);
      if (suppRows.length > 0 && !suppRows[0].accepts_return && handling !== 'write_off_loss') {
        throw new Error('Supplier tidak menerima retur. Hanya write_off_loss yang diizinkan');
      }

      // Ensure purchase record exists
      const resolvedPurchaseId = await ensurePurchaseRecord(connection, batchNumber, supplierId);

      // Validate and process items
      const returnItems = [];
      let totalValue = 0;

      for (const item of items) {
        const { batch_id, qty_returned, condition } = item;
        if (!batch_id || !qty_returned || !condition) {
          throw new Error('Setiap item wajib memiliki batch_id, qty_returned, dan condition');
        }
        if (qty_returned <= 0) throw new Error('qty_returned harus > 0');

        // Find batch
        const batch = batchRows.find(b => b.id === batch_id);
        if (!batch) throw new Error(`Batch #${batch_id} tidak ditemukan dalam faktur ini`);

        // Already returned for this batch
        const [retRows] = await connection.query(
          `SELECT COALESCE(SUM(pri.qty_returned), 0) as qty
           FROM purchase_return_items pri
           JOIN purchase_returns pr ON pri.return_id = pr.id
           WHERE pri.batch_id = ? AND pr.original_purchase_id = ?`,
          [batch_id, resolvedPurchaseId]
        );
        const qtyAlreadyReturned = Number(retRows[0].qty);
        const qtyReturnable = batch.initial_quantity - qtyAlreadyReturned;
        if (qty_returned > qtyReturnable) throw new Error(
          `qty_returned (${qty_returned}) melebihi sisa retur (${qtyReturnable}) untuk batch #${batch_id}`
        );

        // Check current stock in batch
        const currentStock = Number(batch.remaining_quantity);
        if (qty_returned > currentStock) throw new Error(
          `Stok batch (${currentStock}) tidak mencukupi untuk retur ${qty_returned}`
        );

        // Ensure purchase_item record exists
        const purchaseItemId = await ensurePurchaseItemRecord(connection, resolvedPurchaseId, batch);

        const itemValue = qty_returned * Number(batch.cost_price);
        totalValue += itemValue;

        returnItems.push({
          purchase_item_id: purchaseItemId,
          batch_id: batch.id,
          product_id: batch.product_id,
          qty_returned,
          buy_price: Number(batch.cost_price),
          condition,
          product_category: batch.product_category,
          itemValue,
        });
      }

      // Generate return number
      const year = new Date().getFullYear();
      const returnNo = await generateReturnNo(connection, 'purchase_returns', 'RP', year);

      // Insert purchase_return header
      const [retResult] = await connection.query(
        'INSERT INTO purchase_returns (return_no, original_purchase_id, supplier_id, reason, handling, total_value) VALUES (?, ?, ?, ?, ?, ?)',
        [returnNo, resolvedPurchaseId, supplierId, reason || null, handling, totalValue]
      );
      const returnId = retResult.insertId;

      // Insert items, update stock
      let obatValue = 0;
      let nonObatValue = 0;

      for (const ri of returnItems) {
        await connection.query(
          'INSERT INTO purchase_return_items (return_id, purchase_item_id, batch_id, product_id, qty_returned, buy_price, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [returnId, ri.purchase_item_id, ri.batch_id, ri.product_id, ri.qty_returned, ri.buy_price, ri.condition]
        );

        // Reduce batch stock
        await connection.query(
          'UPDATE batches SET remaining_quantity = GREATEST(remaining_quantity - ?, 0) WHERE id = ?',
          [ri.qty_returned, ri.batch_id]
        );

        // Mark batch as returned
        await connection.query(
          'UPDATE batches SET stock_type = ? WHERE id = ?',
          ['retur', ri.batch_id]
        );

        // Reduce product stock
        await connection.query(
          'UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?',
          [ri.qty_returned, ri.product_id]
        );

        const isObat = ri.product_category === 'OBAT';
        if (isObat) obatValue += ri.itemValue;
        else nonObatValue += ri.itemValue;
      }

      // Journal by handling type
      const today = new Date().toISOString().split('T')[0];

      if (handling === 'reduce_payable') {
        const journalItems = [];
        if (obatValue > 0) journalItems.push({ accountCode: '103', credit: obatValue });
        if (nonObatValue > 0) journalItems.push({ accountCode: '104', credit: nonObatValue });
        journalItems.push({ accountCode: '201', debit: totalValue });
        await createJournalEntry(connection, null, today, `Retur pembelian (kurang hutang): ${returnNo}`, journalItems);
      } else if (handling === 'credit_note') {
        await connection.query(
          'INSERT INTO supplier_credits (supplier_id, purchase_return_id, amount) VALUES (?, ?, ?)',
          [supplierId, returnId, totalValue]
        );
        const journalItems = [];
        if (obatValue > 0) journalItems.push({ accountCode: '103', credit: obatValue });
        if (nonObatValue > 0) journalItems.push({ accountCode: '104', credit: nonObatValue });
        journalItems.push({ accountCode: '105', debit: totalValue });
        await createJournalEntry(connection, null, today, `Retur pembelian (credit note): ${returnNo}`, journalItems);
      } else if (handling === 'write_off_loss') {
        const journalItems = [];
        if (obatValue > 0) journalItems.push({ accountCode: '103', credit: obatValue });
        if (nonObatValue > 0) journalItems.push({ accountCode: '104', credit: nonObatValue });
        journalItems.push({ accountCode: '528', debit: totalValue });
        await createJournalEntry(connection, null, today, `Retur pembelian (write-off): ${returnNo}`, journalItems);
      }

      await connection.commit();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Retur Pembelian',
        action: 'create',
        description: `Membuat retur pembelian ${returnNo} untuk faktur ${batchNumber} (${handling})`,
      });

      res.status(201).json({ success: true, return_no: returnNo, id: returnId, total_value: totalValue });
    } catch (err) {
      await connection.rollback();
      console.error('Error creating purchase return:', err);
      res.status(400).json({ message: err.message });
    } finally {
      connection.release();
    }
  });

  // List all purchase returns
  app.get('/api/returns/purchases', authenticate, checkPermission('Retur Pembelian', 'show'), async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT pr.*, s.name as supplier_name, p.invoice_no
        FROM purchase_returns pr
        JOIN suppliers s ON pr.supplier_id = s.id
        LEFT JOIN purchases p ON pr.original_purchase_id = p.id
        ORDER BY pr.created_at DESC
      `);
      res.json({ data: rows });
    } catch (err) {
      console.error('Error listing purchase returns:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get purchase return detail
  app.get('/api/returns/purchases/:id', authenticate, checkPermission('Retur Pembelian', 'show'), async (req, res) => {
    try {
      const { id } = req.params;
      const [retRows] = await pool.query(`
        SELECT pr.*, s.name as supplier_name, p.invoice_no
        FROM purchase_returns pr
        JOIN suppliers s ON pr.supplier_id = s.id
        LEFT JOIN purchases p ON pr.original_purchase_id = p.id
        WHERE pr.id = ?
      `, [id]);
      if (retRows.length === 0) return res.status(404).json({ message: 'Return not found' });

      const [items] = await pool.query(`
        SELECT pri.*, pr.name as product_name
        FROM purchase_return_items pri
        JOIN products pr ON pri.product_id = pr.id
        WHERE pri.return_id = ?
      `, [id]);

      res.json({ ...retRows[0], items });
    } catch (err) {
      console.error('Error getting purchase return:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // ========================
  // SALE RETURNS
  // ========================

  // Lookup sale by transaction id
  app.get('/api/returns/sales/lookup', authenticate, checkPermission('Retur Penjualan', 'show'), async (req, res) => {
    try {
      const { sale_id } = req.query;
      if (!sale_id) return res.status(400).json({ message: 'sale_id required' });

      const [sales] = await pool.query(
        'SELECT * FROM transactions WHERE id = ? AND payment_status = ?',
        [sale_id, 'completed']
      );

      if (sales.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan atau belum lunas' });

      const sale = sales[0];

      const [items] = await pool.query(
        `SELECT ti.id as sale_item_id, ti.product_id, ti.quantity, ti.price,
                pr.name as product_name
         FROM transaction_items ti
         JOIN products pr ON ti.product_id = pr.id
         WHERE ti.transaction_id = ?`,
        [sale.id]
      );

      const enrichedItems = [];
      for (const item of items) {
        const [returnedRows] = await pool.query(
          'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM sale_return_items WHERE sale_item_id = ?',
          [item.sale_item_id]
        );
        const qtyAlreadyReturned = Number(returnedRows[0].qty);
        const qtyReturnable = item.quantity - qtyAlreadyReturned;
        enrichedItems.push({
          ...item,
          qty_already_returned: qtyAlreadyReturned,
          qty_returnable: Math.max(0, qtyReturnable),
        });
      }

      res.json({
        sale: {
          id: sale.id,
          date: sale.transaction_date,
          total: sale.total_amount,
          payment_method: sale.payment_method,
        },
        items: enrichedItems,
      });
    } catch (err) {
      console.error('Error looking up sale:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Submit sale return
  app.post('/api/returns/sales', authenticate, checkPermission('Retur Penjualan', 'create'), async (req, res) => {
    const { sale_id, reason, refund_method, items } = req.body;

    if (!sale_id || !refund_method || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'sale_id, refund_method, dan items wajib diisi' });
    }

    if (!['cash', 'credit_note'].includes(refund_method)) {
      return res.status(400).json({ message: 'refund_method tidak valid' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [saleRows] = await connection.query(
        'SELECT * FROM transactions WHERE id = ? AND payment_status = ?',
        [sale_id, 'completed']
      );
      if (saleRows.length === 0) throw new Error('Transaksi tidak ditemukan atau belum completed');
      const sale = saleRows[0];

      const returnItems = [];
      let totalRefund = 0;
      let totalHPP = 0;
      let obatHPP = 0;
      let nonObatHPP = 0;

      for (const item of items) {
        const { sale_item_id, qty_returned, condition } = item;
        if (!sale_item_id || !qty_returned) throw new Error('Setiap item wajib memiliki sale_item_id dan qty_returned');
        if (qty_returned <= 0) throw new Error('qty_returned harus > 0');

        const [siRows] = await connection.query(
          'SELECT ti.*, p.cost_price, p.product_category, p.name as product_name FROM transaction_items ti JOIN products p ON ti.product_id = p.id WHERE ti.id = ?',
          [sale_item_id]
        );
        if (siRows.length === 0) throw new Error(`Sale item #${sale_item_id} tidak ditemukan`);
        const si = siRows[0];
        if (si.transaction_id !== sale_id) throw new Error(`Item #${sale_item_id} bukan bagian dari transaksi ini`);

        const [retRows] = await connection.query(
          'SELECT COALESCE(SUM(qty_returned), 0) as qty FROM sale_return_items WHERE sale_item_id = ?',
          [sale_item_id]
        );
        const qtyAlreadyReturned = Number(retRows[0].qty);
        const qtyReturnable = si.quantity - qtyAlreadyReturned;
        if (qty_returned > qtyReturnable) throw new Error(
          `qty_returned (${qty_returned}) melebihi sisa retur (${qtyReturnable}) untuk item #${sale_item_id}`
        );

        const itemRefund = qty_returned * Number(si.price);
        totalRefund += itemRefund;

        const cost = Number(si.cost_price || 0);
        const itemHPP = qty_returned * cost;
        totalHPP += itemHPP;

        const isObat = si.product_category === 'OBAT';
        if (isObat) obatHPP += itemHPP;
        else nonObatHPP += itemHPP;

        // Get batch_id from transaction_items -> we need to find the batch that was sold
        // The transaction_items don't directly store batch_id. We need to find the batch
        // by reversing the FEFO logic or using the actual batch. Since we don't track
        // which specific batch was sold in transaction_items, we need a different approach.
        // Let's find any batch for this product that has stock and use it.
        // Actually, looking at the schema: transaction_items doesn't have batch_id.
        // But the user's spec says sale_item_id is FK to sale_items.
        // In our system, we'll use the latest batch for the product.

        // Find the batch that was most likely sold (FEFO - first expired first out)
        const [batchRows] = await connection.query(
          'SELECT id FROM batches WHERE product_id = ? ORDER BY expired_date ASC, created_at ASC LIMIT 1',
          [si.product_id]
        );
        if (batchRows.length === 0) {
          throw new Error(`Tidak ditemukan batch untuk produk "${si.product_name}". Retur tidak dapat diproses.`);
        }
        const batchId = batchRows[0].id;

        returnItems.push({
          sale_item_id,
          batch_id: batchId,
          product_id: si.product_id,
          qty_returned,
          price: Number(si.price),
          cost_price: cost,
          product_name: si.product_name,
          product_category: si.product_category,
          isObat,
          itemRefund,
          itemHPP,
          condition: item.condition || 'baik',
        });
      }

      const year = new Date().getFullYear();
      const returnNo = await generateReturnNo(connection, 'sale_returns', 'RJ', year);

      const [retResult] = await connection.query(
        'INSERT INTO sale_returns (return_no, original_sale_id, returned_by, reason, refund_method, total_refund) VALUES (?, ?, ?, ?, ?, ?)',
        [returnNo, sale_id, req.user.id, reason || null, refund_method, totalRefund]
      );
      const returnId = retResult.insertId;

      for (const ri of returnItems) {
        await connection.query(
          'INSERT INTO sale_return_items (return_id, sale_item_id, batch_id, product_id, qty_returned, price, `condition`) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [returnId, ri.sale_item_id, ri.batch_id, ri.product_id, ri.qty_returned, ri.price, ri.condition || 'baik']
        );

        // Restore stock only if condition is 'baik' (not 'rusak')
        if (ri.condition !== 'rusak') {
          if (ri.batch_id) {
            await connection.query(
              'UPDATE batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?',
              [ri.qty_returned, ri.batch_id]
            );
          }
          await connection.query(
            'UPDATE products SET stock = stock + ? WHERE id = ?',
            [ri.qty_returned, ri.product_id]
          );
        }
      }

      // Journal: Dr. Retur Penjualan, Dr. Persediaan, Cr. Kas/Piutang, Cr. HPP
      const today = new Date().toISOString().split('T')[0];
      const journalItems = [];

      // Dr. Retur Penjualan (403)
      journalItems.push({ accountCode: '403', debit: totalRefund });

      // Dr. Persediaan (obat/non-obat)
      const persediaanCode = (() => {
        if (obatHPP > 0 && nonObatHPP === 0) return '103';
        if (nonObatHPP > 0 && obatHPP === 0) return '104';
        return null;
      })();

      // Cr. Kas (101) or Piutang (106)
      const creditCode = refund_method === 'cash' ? '101' : '106';
      journalItems.push({ accountCode: creditCode, credit: totalRefund });

      // Cr. HPP (501/502)
      if (obatHPP > 0) {
        journalItems.push({ accountCode: '501', credit: obatHPP });
        journalItems.push({ accountCode: '103', debit: obatHPP });
      }
      if (nonObatHPP > 0) {
        journalItems.push({ accountCode: '502', credit: nonObatHPP });
        journalItems.push({ accountCode: '104', debit: nonObatHPP });
      }

      await createJournalEntry(connection, sale_id, today, `Retur penjualan: ${returnNo}`, journalItems);

      // Mark transaction as fully_returned if all items are fully returned
      const [allSaleItems] = await connection.query(
        'SELECT id, quantity FROM transaction_items WHERE transaction_id = ?',
        [sale_id]
      );
      let allFullyReturned = true;
      for (const si of allSaleItems) {
        const [retSum] = await connection.query(
          'SELECT COALESCE(SUM(qty_returned), 0) as total FROM sale_return_items WHERE sale_item_id = ?',
          [si.id]
        );
        if (Number(retSum[0].total) < si.quantity) {
          allFullyReturned = false;
          break;
        }
      }
      if (allFullyReturned) {
        await connection.query('UPDATE transactions SET is_fully_returned = TRUE WHERE id = ?', [sale_id]);
      }

      await connection.commit();

      await createAuditTrail({
        user_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        module: 'Retur Penjualan',
        action: 'create',
        description: `Membuat retur penjualan ${returnNo} untuk transaksi #${sale_id}`,
      });

      res.status(201).json({ success: true, return_no: returnNo, id: returnId, total_refund: totalRefund });
    } catch (err) {
      await connection.rollback();
      console.error('Error creating sale return:', err);
      res.status(400).json({ message: err.message });
    } finally {
      connection.release();
    }
  });

  // List all sale returns
  app.get('/api/returns/sales', authenticate, checkPermission('Retur Penjualan', 'show'), async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT sr.*, u.username as returned_by_name
        FROM sale_returns sr
        LEFT JOIN users u ON sr.returned_by = u.id
        ORDER BY sr.created_at DESC
      `);
      res.json({ data: rows });
    } catch (err) {
      console.error('Error listing sale returns:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get sale return detail
  app.get('/api/returns/sales/:id', authenticate, checkPermission('Retur Penjualan', 'show'), async (req, res) => {
    try {
      const { id } = req.params;
      const [retRows] = await pool.query(`
        SELECT sr.*, u.username as returned_by_name
        FROM sale_returns sr
        LEFT JOIN users u ON sr.returned_by = u.id
        WHERE sr.id = ?
      `, [id]);
      if (retRows.length === 0) return res.status(404).json({ message: 'Return not found' });

      const [items] = await pool.query(`
        SELECT sri.*, pr.name as product_name
        FROM sale_return_items sri
        JOIN products pr ON sri.product_id = pr.id
        WHERE sri.return_id = ?
      `, [id]);

      res.json({ ...retRows[0], items });
    } catch (err) {
      console.error('Error getting sale return:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
};
