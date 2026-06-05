/**
 * Helper function to create journal entry
 * @param {Object} connection - Database connection
 * @param {Number|Null} transactionId - Associated transaction ID
 * @param {String} date - Entry date (YYYY-MM-DD)
 * @param {String} description - Entry description
 * @param {Array} items - Array of journal items { accountCode, accountId, account_id, debit, credit }
 */
const createJournalEntry = async (connection, transactionId, date, description, items) => {
  console.log('Creating journal entry:', { transactionId, date, description, items });
  
  // Create journal entry header
  const [journalResult] = await connection.query(
    'INSERT INTO journal_entries (transaction_id, date, description) VALUES (?, ?, ?)',
    [transactionId, date, description]
  );
  const journalId = journalResult.insertId;
  console.log('Created journal entry with ID:', journalId);

  // Insert journal items
  for (const item of items) {
    console.log('Processing journal item:', item);
    let accountId = item.accountId || item.account_id;
    if (!accountId && item.accountCode) {
      const [accResult] = await connection.query('SELECT id FROM accounts WHERE code = ?', [item.accountCode]);
      if (accResult.length > 0) {
        accountId = accResult[0].id;
      }
    }
    
    console.log('Using account ID:', accountId);
    if (accountId) {
      const [itemResult] = await connection.query(
        'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [journalId, accountId, item.debit || 0, item.credit || 0]
      );
      console.log('Inserted journal item with ID:', itemResult.insertId);
    }
  }

  return journalId;
};

module.exports = { createJournalEntry };
