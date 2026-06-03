
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skripsi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    console.log('📊 Cek total transaksi...');

    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM transactions');
    console.log(`✅ Total transaksi: ${countRows[0].total}`);

    const [sumRows] = await pool.query('SELECT SUM(total_amount) as total_cash FROM transactions');
    console.log(`✅ Total cash: Rp ${sumRows[0].total_cash?.toLocaleString('id-ID')}`);

    const [latestRows] = await pool.query('SELECT * FROM transactions ORDER BY id DESC LIMIT 5');
    console.log('\n📋 5 transaksi terakhir:');
    for (const t of latestRows) {
      console.log(`   → ID: ${t.id}, Tanggal: ${t.transaction_date?.toISOString().slice(0, 10)}, Total: Rp ${t.total_amount?.toLocaleString('id-ID')}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

