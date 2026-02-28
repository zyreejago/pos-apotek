module.exports = function registerReportRoutes(app, pool, authenticate) {
  app.get('/api/financial/profit-loss', authenticate, async (req, res) => {
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
            { label: 'Biaya Operasional (Demo)', amount: otherExpenses },
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
  });

  app.get('/api/reports/transactions', authenticate, async (req, res) => {
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
      SELECT t.id, t.transaction_date, t.total_amount, o.name as outlet_name
      FROM transactions t
      LEFT JOIN outlets o ON t.outlet_id = o.id
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
        SELECT ti.transaction_id, ti.quantity, ti.price, p.name as product_name
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
  });

  app.get('/api/reports/balance', authenticate, async (req, res) => {
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

      const [cogsRows] = await connection.query(
        `
      SELECT SUM(ti.quantity * p.cost_price) as total_cogs
      FROM transaction_items ti
      JOIN products p ON ti.product_id = p.id
    `
      );
      const totalCOGS = Number(cogsRows[0].total_cogs || 0);

      const retainedEarnings = cash - totalCOGS;

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
  });
}

