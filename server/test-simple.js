
const mysql = require('mysql2/promise');
const { createJournalEntry } = require('./utils/journal');

async function test() {
  // Create connection directly using env vars
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skripsi',
    ...(process.env.DB_SOCKET_PATH && { socketPath: process.env.DB_SOCKET_PATH }),
  });
  
  console.log('Connected to database');
  
  try {
    await connection.beginTransaction();
    
    console.log('Creating test journal entry...');
    const journalId = await createJournalEntry(
      connection,
      null,
      '2026-06-05',
      'Test Setor Modal',
      [
        { accountCode: '101', debit: 1000000, credit: 0 }, // Kas
        { accountCode: '301', debit: 0, credit: 1000000 } // Modal Pemilik
      ]
    );
    
    console.log('Test journal created with ID:', journalId);
    
    // Now let's query to check
    const [journalEntries] = await connection.query('SELECT * FROM journal_entries WHERE id = ?', [journalId]);
    console.log('Journal entry found:', journalEntries);
    
    const [journalItems] = await connection.query('SELECT * FROM journal_items WHERE journal_entry_id = ?', [journalId]);
    console.log('Journal items found:', journalItems);
    
    // Now check balance sheet
    const [accounts] = await connection.query(`
      SELECT a.*, 
             COALESCE(SUM(ji.debit), 0) as total_debit, 
             COALESCE(SUM(ji.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_items ji ON a.id = ji.account_id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
      GROUP BY a.id
      ORDER BY a.code
    `);
    console.log('Accounts with balances:');
    accounts.forEach(a => console.log(`${a.code} - ${a.name}: Debit ${a.total_debit}, Kredit ${a.total_credit}`));
    
    await connection.rollback(); // Rollback so we don't pollute the database
    console.log('Test completed successfully (changes rolled back)');
  } catch (err) {
    console.error('Error in test:', err);
    await connection.rollback();
  } finally {
    await connection.end();
    process.exit(0);
  }
}

test();
