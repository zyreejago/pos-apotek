
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
    console.log('📊 Cek total transaksi secara detail...');

    const [allRows] = await pool.query('SELECT id, total_amount FROM transactions ORDER BY id ASC');
    console.log(`✅ Total transaksi: ${allRows.length}`);

    let manualTotal = 0;
    console.log('\n📋 Detail transaksi:');
    for (const t of allRows) {
      manualTotal += Number(t.total_amount);
      console.log(`   → ID ${t.id}: Rp ${Number(t.total_amount).toLocaleString('id-ID')} → Total sementara: Rp ${manualTotal.toLocaleString('id-ID')}`);
    }

    const [sumRows] = await pool.query('SELECT SUM(total_amount) as total_cash FROM transactions');
    const dbTotal = Number(sumRows[0].total_cash || 0);

    console.log(`\n✅ Total manual: Rp ${manualTotal.toLocaleString('id-ID')}`);
    console.log(`✅ Total dari DB (SUM): Rp ${dbTotal.toLocaleString('id-ID')}`);
    console.log(`✅ Cocok: ${manualTotal === dbTotal ? 'Ya' : 'Tidak'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

