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
    const connection = await pool.getConnection();
    
    console.log('--- RECENT 10 ENTRIES & ITEMS ---');
    const [entries] = await connection.query('SELECT * FROM journal_entries ORDER BY id DESC LIMIT 10');
    
    for (const entry of entries) {
      console.log(`\nEntry ID: ${entry.id} | Date: ${entry.date.toISOString().split('T')[0]} | Description: ${entry.description}`);
      const [items] = await connection.query(`
        SELECT ji.debit, ji.credit, a.code, a.name, a.type
        FROM journal_items ji
        JOIN accounts a ON ji.account_id = a.id
        WHERE ji.journal_entry_id = ?
      `, [entry.id]);
      console.log(items);
    }

    connection.release();
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
