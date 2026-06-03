
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
    console.log('📊 Cek perbedaan subtotal dan total_amount di transactions...');

    const [latestRows] = await pool.query('SELECT id, subtotal, tax_amount, discount_amount, total_amount FROM transactions ORDER BY id DESC LIMIT 10');
    console.log('\n📋 10 transaksi terakhir:');
    for (const t of latestRows) {
      console.log(`   → ID ${t.id}`);
      console.log(`     - Subtotal: Rp ${Number(t.subtotal || 0).toLocaleString('id-ID')}`);
      console.log(`     - Pajak (PPN): Rp ${Number(t.tax_amount || 0).toLocaleString('id-ID')}`);
      console.log(`     - Diskon: Rp ${Number(t.discount_amount || 0).toLocaleString('id-ID')}`);
      console.log(`     - Total Amount (yang harus dibayar): Rp ${Number(t.total_amount || 0).toLocaleString('id-ID')}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

