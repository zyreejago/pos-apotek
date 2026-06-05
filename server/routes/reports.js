module.exports = function registerReportRoutes(app, pool, authenticate, checkPermission) {
  app.get(
    '/api/financial/profit-loss',
    authenticate,
    checkPermission('Sales Report', 'show'),
    async (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    try {
      const connection = await pool.getConnection();

      const [revenueRows] = await connection.query(
        'SELECT SUM(total_amount) as total_sales FROM transactions WHERE MONTH(transaction_date) = ? AND YEAR(transaction_date) = ?',
        [month, year]
      );
      const totalRevenue = revenueRows[0].total_sales || 0;

      const [cogsRows] = await connection.query(
        `
      SELECT SUM(ti.quantity * p.cost_price) as total_cogs
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN products p ON ti.product_id = p.id
      WHERE MONTH(t.transaction_date) = ? AND YEAR(t.transaction_date) = ?
    `,
        [month, year]
      );
      const salesCOGS = cogsRows[0].total_cogs || 0;

      const [opnameRows] = await connection.query(
        `
      SELECT SUM(ih.quantity_change * p.cost_price) as opname_value
      FROM inventory_history ih
      JOIN products p ON ih.product_id = p.id
      WHERE ih.type = 'opname' AND MONTH(ih.created_at) = ? AND YEAR(ih.created_at) = ?
    `,
        [month, year]
      );

      const rawOpnameValue = opnameRows[0].opname_value || 0;
      const opnameCost = -rawOpnameValue;

      const otherExpenses = 0;

      connection.release();

      res.json({
        period: { month, year },
        revenue: {
          total: totalRevenue,
          details: [{ label: 'Penjualan Barang', amount: totalRevenue }],
        },
        cogs: {
          total: Number(salesCOGS) + Number(opnameCost),
          details: [
            { label: 'Harga Pokok Penjualan', amount: salesCOGS },
            {
              label: 'Harga Pokok Penjualan Dari Opname (Selisih Persediaan)',
              amount: opnameCost,
            },
          ],
        },
        gross_profit:
          (revenueRows[0].total_sales || 0) -
          (Number(salesCOGS) + Number(opnameCost)),
        expenses: {
          total: otherExpenses,
          details: [
            { label: 'Beban Operasional (Demo)', amount: otherExpenses },
          ],
        },
        net_profit:
          (revenueRows[0].total_sales || 0) -
          (Number(salesCOGS) + Number(opnameCost)) -
          otherExpenses,
      });
    } catch (error) {
      console.error('Error generating financial report:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // New: Profit Loss with Debit/Credit format
  app.get(
    '/api/financial/profit-loss-accounting',
    authenticate,
    checkPermission('Sales Report', 'show'),
    async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    try {
      const connection = await pool.getConnection();
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      // Get journal entries for the period, grouped by account
      const [journalData] = await connection.query(
        `
        SELECT a.code, a.name, a.type, a.normal_balance, 
               COALESCE(SUM(ji.debit), 0) as total_debit, COALESCE(SUM(ji.credit), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_items ji ON a.id = ji.account_id
        LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
        WHERE (je.date BETWEEN ? AND ? OR je.date IS NULL)
        GROUP BY a.id
        ORDER BY a.code
      `, [startDate, endDate]);

      connection.release();

      res.json({
        period: { month, year, startDate, endDate },
        accounts: journalData
      });
    } catch (error) {
      console.error('Error generating accounting profit loss:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // New: Balance Sheet with Debit/Credit format
  app.get(
    '/api/reports/balance-accounting',
    authenticate,
    checkPermission('Sales Report', 'show'),
    async (req, res) => {
    const { month, year } = req.query;
    const activeMonth = month ? parseInt(month) : (new Date().getMonth() + 1);
    const activeYear = year ? parseInt(year) : new Date().getFullYear();
    const endDate = new Date(activeYear, activeMonth, 0).toISOString().split('T')[0];
    const startDate = `${activeYear}-01-01`;

    try {
      const connection = await pool.getConnection();
      
      // Get all accounts with cumulative balances
      let [accounts] = await connection.query(
        `
        SELECT a.*, 
               COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN ji.debit ELSE 0 END), 0) as total_debit, 
               COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN ji.credit ELSE 0 END), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_items ji ON a.id = ji.account_id
        LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id AND je.date <= ?
        GROUP BY a.id
        ORDER BY a.code
      `, [endDate]);

      // Calculate net profit for the current year (from Jan to selected month)
      const [profitLossAccounts] = await connection.query(
        `
        SELECT a.*, 
               COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN ji.debit ELSE 0 END), 0) as total_debit, 
               COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN ji.credit ELSE 0 END), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_items ji ON a.id = ji.account_id
        LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id AND (je.date BETWEEN ? AND ?)
        WHERE a.type IN ('pendapatan', 'beban')
        GROUP BY a.id
        ORDER BY a.code
      `, [startDate, endDate]);

      // Calculate net profit
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      profitLossAccounts.forEach(acc => {
        const balance = acc.normal_balance === 'debit' 
        ? acc.total_debit - acc.total_credit 
        : acc.total_credit - acc.total_debit;
        if (acc.type === 'pendapatan') {
          totalRevenue += balance;
        } else if (acc.type === 'beban') {
          totalExpenses += balance;
        }
      });

      const netProfit = totalRevenue - totalExpenses;

      // Find Laba Tahun Berjalan account
      const profitAcc = accounts.find(a => a.code === '311');
      if (profitAcc) {
        // Add net profit to Laba Tahun Berjalan
        if (profitAcc.normal_balance === 'debit') {
          if (netProfit >= 0) {
            profitAcc.total_credit += netProfit;
          } else {
            profitAcc.total_debit += Math.abs(netProfit);
          }
        } else {
          if (netProfit >= 0) {
            profitAcc.total_credit += netProfit;
          } else {
            profitAcc.total_debit += Math.abs(netProfit);
          }
        }
      } else {
        // If account doesn't exist, add it
        accounts.push({
          id: 999,
          code: '311',
          name: 'Laba Tahun Berjalan',
          type: 'modal',
          normal_balance: 'kredit',
          total_debit: netProfit < 0 ? Math.abs(netProfit) : 0,
          total_credit: netProfit >= 0 ? netProfit : 0
        });
      }

      connection.release();

      res.json({
        period: { month, year, endDate },
        accounts
      });
    } catch (error) {
      console.error('Error generating balance sheet accounting:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // New: General Ledger (Buku Besar)
  app.get(
    '/api/accounting/general-ledger',
    authenticate,
    checkPermission('Sales Report', 'show'),
    async (req, res) => {
    const { month, year, accountId } = req.query;
    const activeMonth = month ? parseInt(month) : (new Date().getMonth() + 1);
    const activeYear = year ? parseInt(year) : new Date().getFullYear();
    const startDate = `${activeYear}-${String(activeMonth).padStart(2, '0')}-01`;
    const endDate = new Date(activeYear, activeMonth, 0).toISOString().split('T')[0];

    try {
      const connection = await pool.getConnection();

      let query = `
        SELECT 
          je.id, je.date, je.description,
          a.code, a.name, a.type, a.normal_balance,
          ji.debit, ji.credit
        FROM journal_entries je
        JOIN journal_items ji ON je.id = ji.journal_entry_id
        JOIN accounts a ON ji.account_id = a.id
        WHERE je.date BETWEEN ? AND ?
      `;
      const params = [startDate, endDate];

      if (accountId) {
        query += ' AND a.id = ?';
        params.push(parseInt(accountId));
      }

      query += ' ORDER BY je.date, je.id, a.code';

      const [ledgerData] = await connection.query(query, params);

      // Get all accounts for dropdown
      const [accounts] = await connection.query('SELECT * FROM accounts ORDER BY code');

      connection.release();

      res.json({
        period: { month, year, startDate, endDate },
        ledger: ledgerData,
        accounts
      });
    } catch (error) {
      console.error('Error generating general ledger:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.get(
    '/api/reports/transactions',
    authenticate,
    checkPermission('Sales Report', 'show'),
    async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'Start date and end date are required' });
    }

    try {
      const connection = await pool.getConnection();

      const [transactions] = await connection.query(
        `
      SELECT t.id, t.transaction_date, t.total_amount, u.username as cashier_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE DATE(t.transaction_date) BETWEEN ? AND ?
      ORDER BY t.transaction_date DESC
    `,
        [startDate, endDate]
      );

      const transactionIds = transactions.map((t) => t.id);
      let items = [];
      if (transactionIds.length > 0) {
        const [itemRows] = await connection.query(
          `
        SELECT ti.transaction_id, ti.quantity, ti.price, p.name as product_name, p.unit as product_unit
        FROM transaction_items ti
        JOIN products p ON ti.product_id = p.id
        WHERE ti.transaction_id IN (?)
      `,
          [transactionIds]
        );
        items = itemRows;
      }

      const transactionsWithItems = transactions.map((t) => ({
        ...t,
        items: items.filter((i) => i.transaction_id === t.id),
      }));

      const chartDataMap = {};
      transactions.forEach((t) => {
        const date = new Date(t.transaction_date).toISOString().split('T')[0];
        if (!chartDataMap[date]) {
          chartDataMap[date] = 0;
        }
        chartDataMap[date] += Number(t.total_amount);
      });

      const chartData = Object.keys(chartDataMap)
        .sort()
        .map((date) => ({
          date,
          total: chartDataMap[date],
        }));

      connection.release();

      res.json({
        transactions: transactionsWithItems,
        chartData,
      });
    } catch (error) {
      console.error('Error generating transaction report:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  app.get(
    '/api/reports/balance',
    authenticate,
    checkPermission('Sales Report', 'show'),
    async (req, res) => {
    try {
      const connection = await pool.getConnection();

      const [cashRows] = await connection.query(
        'SELECT SUM(total_amount) as total_cash FROM transactions'
      );
      const cash = Number(cashRows[0].total_cash || 0);

      const [inventoryRows] = await connection.query(
        'SELECT SUM(stock * cost_price) as total_inventory FROM products'
      );
      const inventory = Number(inventoryRows[0].total_inventory || 0);

      const receivables = 0;

      const totalAssets = cash + inventory + receivables;

      const payables = 0;
      const consignmentDebt = 0;

      const totalLiabilities = payables + consignmentDebt;

      const [revenueRows] = await connection.query(
        'SELECT SUM(total_amount) as total_revenue FROM transactions'
      );
      const totalRevenue = Number(revenueRows[0].total_revenue || 0);

      const [cogsRows] = await connection.query(
        `
      SELECT SUM(ti.quantity * p.cost_price) as total_cogs
      FROM transaction_items ti
      JOIN products p ON ti.product_id = p.id
    `
      );
      const totalCOGS = Number(cogsRows[0].total_cogs || 0);

      const retainedEarnings = totalRevenue - totalCOGS;

      const initialEquity = totalAssets - totalLiabilities - retainedEarnings;

      connection.release();

      res.json({
        assets: {
          cash,
          inventory,
          receivables,
          total: totalAssets,
        },
        liabilities: {
          payables,
          consignmentDebt,
          total: totalLiabilities,
        },
        equity: {
          initial: initialEquity,
          capitalChanges: 0,
          retainedEarnings,
          total: initialEquity + retainedEarnings,
        },
      });
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      res.status(500).json({ message: 'Server error' });
    }
    }
  );

  // Get list of all journal entries (Jurnal Umum)
  app.get('/api/accounting/journal-entries', authenticate, checkPermission('Sales Report', 'show'), async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      const connection = await pool.getConnection();
      let query = `
        SELECT 
          je.id as entry_id, je.date, je.description, je.created_at,
          ji.id as item_id, ji.debit, ji.credit,
          a.code as account_code, a.name as account_name, a.type as account_type
        FROM journal_entries je
        LEFT JOIN journal_items ji ON je.id = ji.journal_entry_id
        LEFT JOIN accounts a ON ji.account_id = a.id
      `;
      const params = [];
      if (startDate && endDate) {
        query += ' WHERE je.date BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }
      query += ' ORDER BY je.date DESC, je.id DESC, a.code ASC';
      const [rows] = await connection.query(query, params);
      connection.release();

      // Group items by journal entry
      const entriesMap = {};
      for (const row of rows) {
        if (!entriesMap[row.entry_id]) {
          entriesMap[row.entry_id] = {
            id: row.entry_id,
            date: row.date,
            description: row.description,
            created_at: row.created_at,
            items: []
          };
        }
        if (row.item_id) {
          entriesMap[row.entry_id].items.push({
            id: row.item_id,
            debit: Number(row.debit || 0),
            credit: Number(row.credit || 0),
            account_code: row.account_code,
            account_name: row.account_name,
            account_type: row.account_type
          });
        }
      }
      res.json({ success: true, data: Object.values(entriesMap) });
    } catch (err) {
      console.error('Error fetching journal entries:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Post a manual financial transaction (journal entry)
  app.post('/api/accounting/journal-entries', authenticate, checkPermission('Sales Report', 'edit'), async (req, res) => {
    const { date, description, items } = req.body;
    if (!date || !description || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate total debits = total credits
    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of items) {
      totalDebit += Number(item.debit || 0);
      totalCredit += Number(item.credit || 0);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: 'Total debit must equal total credit' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { createJournalEntry } = require('../utils/journal');
      await createJournalEntry(connection, null, date, description, items);

      await connection.commit();
      res.json({ success: true, message: 'Journal entry created successfully' });
    } catch (err) {
      await connection.rollback();
      console.error('Error posting manual journal entry:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      connection.release();
    }
  });
};