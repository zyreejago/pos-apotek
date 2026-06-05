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
    
    console.log('--- ACCOUNTS ---');
    const [accounts] = await connection.query('SELECT id, code, name, type, normal_balance FROM accounts ORDER BY code LIMIT 5');
    console.log(accounts);

    console.log('\n--- RECENT JOURNAL ENTRIES ---');
    const [entries] = await connection.query('SELECT * FROM journal_entries ORDER BY id DESC LIMIT 5');
    console.log(entries);

    console.log('\n--- RECENT JOURNAL ITEMS ---');
    const [items] = await connection.query(`
      SELECT ji.*, a.code, a.name 
      FROM journal_items ji 
      JOIN accounts a ON ji.account_id = a.id 
      ORDER BY ji.id DESC LIMIT 10
    `);
    console.log(items);

    connection.release();
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
