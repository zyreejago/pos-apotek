
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const midtransClient = require('midtrans-client');

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

  const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
  });

  try {
    console.log('📊 Cek transaksi terakhir...');

    const [transRows] = await pool.query('SELECT * FROM transactions WHERE payment_method = ? ORDER BY id DESC LIMIT 1', ['midtrans']);
    if (transRows.length === 0) {
      console.log('❌ Tidak ada transaksi Midtrans');
      return;
    }

    const transaction = transRows[0];
    console.log(`✅ Transaksi ditemukan: Order ID ${transaction.midtrans_order_id}`);
    console.log(`   Payment status saat ini: ${transaction.payment_status}`);

    console.log('\n🔍 Cek status ke Midtrans...');
    const statusResponse = await snap.transaction.notification({
      order_id: transaction.midtrans_order_id
    });
    console.log('✅ Response dari Midtrans:', JSON.stringify(statusResponse, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

