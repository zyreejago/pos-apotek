const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'skripsi',
  ...(process.env.DB_SOCKET_PATH && { socketPath: process.env.DB_SOCKET_PATH }),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const productsToUpdate = [
  { name: 'Sanmol Tab', stock: 28 },
  { name: 'Paracetamol Tab', stock: 35 },
  { name: 'Imboost Force Kaplet', stock: 22 },
  { name: 'Vicee Orange', stock: 48 },
  { name: 'Amlodipine 5mg Tab', stock: 18 },
  { name: 'Cetirizine 10 mg Tab', stock: 20 },
  { name: 'Paramex Tab', stock: 15 },
  { name: 'Enervon C', stock: 14 },
  { name: 'Ambroxol Tab', stock: 24 },
  { name: 'Metformin Tab', stock: 19 },
  { name: 'Demacolin Tab', stock: 32 },
  { name: 'Tera-F Tab', stock: 12 },
  { name: 'Fasidol Tab', stock: 18 },
  { name: 'Hufagripp Flu', stock: 5 },
  { name: 'Kool Fever Anak', stock: 9 },
  { name: 'Test Pack One Med', stock: 11 },
  { name: 'Caviplex Tab', stock: 16 },
  { name: 'Micoral Cr', stock: 13 },
  { name: 'Ketokonazole Cr', stock: 7 },
  { name: 'Sutra Ok 3 S', stock: 21 }
];

async function updateStock() {
  const connection = await pool.getConnection();
  try {
    console.log('Memulai update stok produk...');
    
    for (const product of productsToUpdate) {
      await connection.query(
        'UPDATE products SET stock = ? WHERE name LIKE ?',
        [product.stock, product.name]
      );
      console.log(`✅ Stok ${product.name} diupdate menjadi ${product.stock}`);
    }
    
    console.log('\n🎉 Semua stok berhasil diupdate!');
  } catch (error) {
    console.error('Gagal update stok:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

updateStock();
