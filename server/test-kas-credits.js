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
    console.log('--- RECENT LARGE KAS TRANSACTIONS ---');
    const [rows] = await connection.query(`
      SELECT ji.id, ji.debit, ji.credit, je.id as entry_id, je.description, je.date
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE ji.account_id = 1
      ORDER BY ji.credit DESC, ji.id DESC
      LIMIT 10
    `);
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
