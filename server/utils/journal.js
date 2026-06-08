/**
 * Helper function to create journal entry
 * @param {Object} connection - Database connection
 * @param {Number|Null} transactionId - Associated transaction ID
 * @param {String} date - Entry date (YYYY-MM-DD)
 * @param {String} description - Entry description
 * @param {Array} items - Array of journal items { accountCode, debit, credit }
 * @throws {Error} If any account code referenced does not exist in the accounts table
 */
const createJournalEntry = async (connection, transactionId, date, description, items) => {
  // Validate all account codes exist before creating anything
  const missingCodes = [];
  for (const item of items) {
    const [accResult] = await connection.query('SELECT id FROM accounts WHERE code = ?', [item.accountCode]);
    if (accResult.length === 0) {
      missingCodes.push(item.accountCode);
    }
  }

  if (missingCodes.length > 0) {
    throw new Error(
      `Jurnal tidak dapat dibuat: kode akun berikut tidak ditemukan di tabel accounts: ${missingCodes.map(c => `'${c}'`).join(', ')}. ` +
      `Periksa konfigurasi jurnal otomatis di kode backend.`
    );
  }

  // Create journal entry header
  const [journalResult] = await connection.query(
    'INSERT INTO journal_entries (transaction_id, date, description) VALUES (?, ?, ?)',
    [transactionId, date, description]
  );
  const journalId = journalResult.insertId;

  // Insert journal items
  for (const item of items) {
    const [accResult] = await connection.query('SELECT id FROM accounts WHERE code = ?', [item.accountCode]);
    await connection.query(
      'INSERT INTO journal_items (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
      [journalId, accResult[0].id, item.debit || 0, item.credit || 0]
    );
  }

  return journalId;
};

module.exports = { createJournalEntry };
