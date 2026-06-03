
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
    console.log('📊 Cek data di sales_history...');

    // Cek produk pertama
    const [products] = await pool.query('SELECT id, name FROM products LIMIT 1');
    if (products.length > 0) {
      const product = products[0];
      console.log(`\n📦 Produk: ${product.name} (ID: ${product.id})`);

      const [salesRows] = await pool.query(
        `SELECT sale_date AS day, quantity AS qty FROM sales_history WHERE product_id = ? ORDER BY sale_date ASC`,
        [product.id]
      );

      console.log(`\n📈 Jumlah baris sales: ${salesRows.length}`);
      console.log('Contoh data:');
      console.log(salesRows.slice(0, 5));
      console.log('\n...');
      console.log(salesRows.slice(-5));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

