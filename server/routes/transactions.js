const midtransClient = require('midtrans-client');
const { createJournalEntry } = require('../utils/journal');

module.exports = function registerTransactionRoutes(app, pool, authenticate, checkPermission, createAuditTrail) {
  const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
  });

  app.post(
    '/api/transactions',
    authenticate,
    checkPermission('Transactions', 'create'),
    async (req, res) => {
    const { items, total_amount, tax_amount, discount_amount, subtotal, payment_method } =
      req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in transaction' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const orderId = `POS-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];

      const [transResult] = await connection.query(
        'INSERT INTO transactions (total_amount, tax_amount, discount_amount, subtotal, payment_method, midtrans_order_id, payment_status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [total_amount, tax_amount || 0, discount_amount || 0, subtotal || 0, payment_method || 'cash', payment_method === 'midtrans' ? orderId : null, 'pending', req.user.id]
      );
      const transactionId = transResult.insertId;

      // Calculate total COGS and separate splits for OBAT & NON_OBAT
      let totalCOGS = 0;
      let obatSalesTotal = 0;
      let nonObatSalesTotal = 0;
      let obatCOGSTotal = 0;
      let nonObatCOGSTotal = 0;

      for (const item of items) {
        await connection.query(
          'INSERT INTO transaction_items (transaction_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [transactionId, item.id, item.quantity, item.price]
        );

        // Get product cost price and product_category
        const [productResult] = await connection.query('SELECT cost_price, product_category FROM products WHERE id = ?', [item.id]);
        if (productResult.length > 0) {
          const cost = Number(productResult[0].cost_price || 0);
          const itemCOGS = cost * item.quantity;
          const itemSales = Number(item.price) * item.quantity;
          totalCOGS += itemCOGS;

          const isObat = productResult[0].product_category === 'OBAT';
          if (isObat) {
            obatSalesTotal += itemSales;
            obatCOGSTotal += itemCOGS;
          } else {
            nonObatSalesTotal += itemSales;
            nonObatCOGSTotal += itemCOGS;
          }
        }

        if (payment_method === 'cash') {
          await connection.query(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.id]
          );
        }
      }

      // If cash, create journal entry immediately
      if (payment_method === 'cash') {
        await connection.query(
          'UPDATE transactions SET payment_status = ? WHERE id = ?',
          ['completed', transactionId]
        );

        // Calculate sales without PPN (for income accounts) and separate PPN for Hutang Pajak
        const salesTotalWithoutTax = subtotal || 0;
        const taxAmountValue = tax_amount || 0;

        // Create journal entry: Debit Kas, Credit Penjualan (Obat/Non-Obat - tanpa PPN), Credit Hutang Pajak (PPN), Debit HPP (Obat/Non-Obat), Credit Persediaan (Obat/Non-Obat)
        const journalItems = [
          { accountCode: '101', debit: total_amount }
        ];

        // Split sales without tax proportionally between OBAT and NON_OBAT
        const totalSalesWithTax = obatSalesTotal + nonObatSalesTotal;
        let obatSalesWithoutTax = 0;
        let nonObatSalesWithoutTax = 0;

        if (totalSalesWithTax > 0 && salesTotalWithoutTax > 0) {
          obatSalesWithoutTax = (obatSalesTotal / totalSalesWithTax) * salesTotalWithoutTax;
          nonObatSalesWithoutTax = (nonObatSalesTotal / totalSalesWithTax) * salesTotalWithoutTax;
        }

        if (obatSalesWithoutTax > 0) journalItems.push({ accountCode: '401', credit: Math.round(obatSalesWithoutTax) });
        if (nonObatSalesWithoutTax > 0) journalItems.push({ accountCode: '402', credit: Math.round(nonObatSalesWithoutTax) });
        if (taxAmountValue > 0) journalItems.push({ accountCode: '202', credit: Math.round(taxAmountValue) });
        
        if (obatCOGSTotal > 0) {
          journalItems.push({ accountCode: '501', debit: obatCOGSTotal });
          journalItems.push({ accountCode: '103', credit: obatCOGSTotal });
        }
        if (nonObatCOGSTotal > 0) {
          journalItems.push({ accountCode: '502', debit: nonObatCOGSTotal });
          journalItems.push({ accountCode: '104', credit: nonObatCOGSTotal });
        }

        await createJournalEntry(connection, transactionId, today, `Penjualan tunai #${transactionId}`, journalItems);
      }

      if (payment_method === 'midtrans') {
        const parameter = {
          transaction_details: {
            order_id: orderId,
            gross_amount: total_amount
          },
          credit_card: {
            secure: true
          }
        };

        const transaction = await snap.createTransaction(parameter);
        const redirectUrl = transaction.redirect_url;

        await connection.commit();
        
        await createAuditTrail({
          user_id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          module: 'Transactions',
          action: 'create',
          description: `Membuat transaksi Midtrans #${transactionId} sebesar ${total_amount}`,
        });

        res.status(201).json({ message: 'Transaction created', id: transactionId, redirect_url: redirectUrl, order_id: orderId });
      } else {
        await connection.commit();

        await createAuditTrail({
          user_id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          module: 'Transactions',
          action: 'create',
          description: `Membuat transaksi tunai #${transactionId} sebesar ${total_amount}`,
        });

        res.status(201).json({ message: 'Transaction successful', id: transactionId });
      }
    } catch (error) {
      await connection.rollback();
      console.error('Error creating transaction:', error);
      res.status(500).json({ message: 'Transaction failed', error: error.message });
    } finally {
      connection.release();
    }
    }
  );

  app.get('/api/midtrans/status/:orderId', authenticate, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { orderId } = req.params;
      
      const [transactionRows] = await connection.query(
        'SELECT * FROM transactions WHERE midtrans_order_id = ?',
        [orderId]
      );

      if (transactionRows.length === 0) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const transaction = transactionRows[0];

      const transactionStatusResponse = await snap.transaction.status(orderId);

      const transactionStatus = transactionStatusResponse.transaction_status;
      const fraudStatus = transactionStatusResponse.fraud_status;
      
      let paymentStatus = transaction.payment_status;

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'challenge') {
          paymentStatus = 'pending';
        } else if (fraudStatus === 'accept') {
          paymentStatus = 'completed';
        }
      } else if (transactionStatus === 'settlement') {
        paymentStatus = 'completed';
      } else if (transactionStatus === 'deny') {
        paymentStatus = 'failed';
      } else if (transactionStatus === 'expire') {
        paymentStatus = 'expired';
      } else if (transactionStatus === 'cancel') {
        paymentStatus = 'canceled';
      }

      await connection.beginTransaction();

      await connection.query(
        'UPDATE transactions SET payment_status = ? WHERE id = ?',
        [paymentStatus, transaction.id]
      );

      if (paymentStatus === 'completed' && transaction.payment_status !== 'completed') {
        const [items] = await connection.query(
          'SELECT ti.*, p.cost_price, p.product_category FROM transaction_items ti JOIN products p ON ti.product_id = p.id WHERE ti.transaction_id = ?',
          [transaction.id]
        );

        let totalCOGS = 0;
        let obatSalesTotal = 0;
        let nonObatSalesTotal = 0;
        let obatCOGSTotal = 0;
        let nonObatCOGSTotal = 0;

        for (const item of items) {
          await connection.query(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.product_id]
          );
          const cost = Number(item.cost_price || 0);
          const itemCOGS = cost * item.quantity;
          const itemSales = Number(item.price) * item.quantity;
          totalCOGS += itemCOGS;

          const isObat = item.product_category === 'OBAT';
          if (isObat) {
            obatSalesTotal += itemSales;
            obatCOGSTotal += itemCOGS;
          } else {
            nonObatSalesTotal += itemSales;
            nonObatCOGSTotal += itemCOGS;
          }
        }

        // Calculate sales without PPN (for income accounts) and separate PPN for Hutang Pajak
        const salesTotalWithoutTax = transaction.subtotal || 0;
        const taxAmountValue = transaction.tax_amount || 0;

        // Create journal entry for midtrans payment (bank)
        const today = new Date().toISOString().split('T')[0];
        const [accResult] = await connection.query('SELECT id FROM accounts WHERE code = ?', ['102']);
        if (accResult.length > 0) {
          // Create journal entry header
          const [journalResult] = await connection.query(
            'INSERT INTO journal_entries (transaction_id, date, description) VALUES (?, ?, ?)',
            [transaction.id, today, `Penjualan non-tunai #${transaction.id}`]
          );
          const journalId = journalResult.insertId;

          const journalItems = [
            { accountCode: '102', debit: transaction.total_amount }
          ];

          // Split sales without tax proportionally between OBAT and NON_OBAT
          const totalSalesWithTax = obatSalesTotal + nonObatSalesTotal;
          let obatSalesWithoutTax = 0;
          let nonObatSalesWithoutTax = 0;

          if (totalSalesWithTax > 0 && salesTotalWithoutTax > 0) {
            obatSalesWithoutTax = (obatSalesTotal / totalSalesWithTax) * salesTotalWithoutTax;
            nonObatSalesWithoutTax = (nonObatSalesTotal / totalSalesWithTax) * salesTotalWithoutTax;
          }

          if (obatSalesWithoutTax > 0) journalItems.push({ accountCode: '401', credit: Math.round(obatSalesWithoutTax) });
          if (nonObatSalesWithoutTax > 0) journalItems.push({ accountCode: '402', credit: Math.round(nonObatSalesWithoutTax) });
          if (taxAmountValue > 0) journalItems.push({ accountCode: '202', credit: Math.round(taxAmountValue) });

          if (obatCOGSTotal > 0) {
            journalItems.push({ accountCode: '501', debit: obatCOGSTotal });
            journalItems.push({ accountCode: '103', credit: obatCOGSTotal });
          }
          if (nonObatCOGSTotal > 0) {
            journalItems.push({ accountCode: '502', debit: nonObatCOGSTotal });
            journalItems.push({ accountCode: '104', credit: nonObatCOGSTotal });
          }

          for (const item of journalItems) {
            const [accRes] = await connection.query('SELECT id FROM accounts WHERE code = ?', [item.accountCode]);
            if (accRes.length > 0) {
              await connection.query(
                'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
                [journalId, accRes[0].id, item.debit || 0, item.credit || 0]
              );
            }
          }
        }
      }

      await connection.commit();
      res.status(200).json({ payment_status: paymentStatus });
    } catch (error) {
      await connection.rollback();
      console.error('Error checking Midtrans status:', error);
      res.status(500).json({ message: 'Failed to check status' });
    } finally {
      connection.release();
    }
  });

  app.post('/api/midtrans/callback', async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const notification = req.body;
      const orderId = notification.order_id;
      const transactionStatus = notification.transaction_status;
      const fraudStatus = notification.fraud_status;

      const [transactionRows] = await connection.query(
        'SELECT * FROM transactions WHERE midtrans_order_id = ?',
        [orderId]
      );

      if (transactionRows.length === 0) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const transaction = transactionRows[0];
      let paymentStatus = transaction.payment_status;

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'challenge') {
          paymentStatus = 'pending';
        } else if (fraudStatus === 'accept') {
          paymentStatus = 'completed';
        }
      } else if (transactionStatus === 'settlement') {
        paymentStatus = 'completed';
      } else if (transactionStatus === 'deny') {
        paymentStatus = 'failed';
      } else if (transactionStatus === 'expire') {
        paymentStatus = 'expired';
      } else if (transactionStatus === 'cancel') {
        paymentStatus = 'canceled';
      }

      await connection.beginTransaction();

      await connection.query(
        'UPDATE transactions SET payment_status = ? WHERE id = ?',
        [paymentStatus, transaction.id]
      );

      if (paymentStatus === 'completed' && transaction.payment_status !== 'completed') {
        const [items] = await connection.query(
          'SELECT * FROM transaction_items WHERE transaction_id = ?',
          [transaction.id]
        );

        for (const item of items) {
          await connection.query(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.product_id]
          );
        }
      }

      await connection.commit();
      res.status(200).json({ message: 'Notification received' });
    } catch (error) {
      await connection.rollback();
      console.error('Error processing Midtrans callback:', error);
      res.status(500).json({ message: 'Failed to process notification' });
    } finally {
      connection.release();
    }
  });

  app.get('/api/dashboard', authenticate, async (req, res) => {
    try {
      const connection = await pool.getConnection();

      const [stockRecs] = await connection.query(`
      SELECT 
        p.name, 
        sf.tambahan_stok as count
      FROM products p
      LEFT JOIN (
        SELECT sf.*
        FROM stock_forecasts sf
        JOIN (
          SELECT product_id, MAX(id) AS max_id
          FROM stock_forecasts
          GROUP BY product_id
        ) last ON last.product_id = sf.product_id AND last.max_id = sf.id
      ) sf ON sf.product_id = p.id
      ORDER BY sf.tambahan_stok DESC, p.stock ASC
      LIMIT 5
    `);

      const [earnings] = await connection.query(`
      SELECT 
        DATE_FORMAT(transaction_date, 'Week %V') as name, 
        SUM(total_amount) as value 
      FROM transactions 
      GROUP BY name 
      ORDER BY name ASC 
      LIMIT 4
    `);

      const [allCashiers] = await connection.query(`
      SELECT u.id, u.username, 'Cashier' as description
      FROM users u
      WHERE u.role = 'cashier'
    `);

      connection.release();

      res.json({
        stockRecommendations: stockRecs,
        earnings: earnings,
        cashiers: allCashiers,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};
