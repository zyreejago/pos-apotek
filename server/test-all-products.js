const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_db',
  };

  const conn = await mysql.createConnection(dbConfig);
  const [products] = await conn.query('SELECT id, name, stock, unit FROM products ORDER BY id ASC');
  
  console.log('=== Semua produk di database ===');
  products.forEach((p, i) => {
    console.log(`${p.id}. ${p.name}`);
  });
  
  await conn.end();
}

main().catch(console.error);
