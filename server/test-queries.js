const mysql = require('mysql2/promise');

async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'skripsi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const connection = pool;
    const endDate = '2026-06-30';

    console.log('--- TESTING OLD/CURRENT QUERY ---');
    const [oldRows] = await connection.query(`
      SELECT a.code, a.name,
             COALESCE(SUM(ji.debit), 0) as total_debit, 
             COALESCE(SUM(ji.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_items ji ON a.id = ji.account_id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id AND je.date <= ?
      WHERE a.code IN ('101', '102', '511')
      GROUP BY a.id
      ORDER BY a.code
    `, [endDate]);
    console.log(oldRows);

    console.log('\n--- TESTING NEW CORRECTED QUERY ---');
    const [newRows] = await connection.query(`
      SELECT a.code, a.name,
             COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN ji.debit ELSE 0 END), 0) as total_debit, 
             COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN ji.credit ELSE 0 END), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_items ji ON a.id = ji.account_id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id AND je.date <= ?
      WHERE a.code IN ('101', '102', '511')
      GROUP BY a.id
      ORDER BY a.code
    `, [endDate]);
    console.log(newRows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
