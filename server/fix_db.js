
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

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

async function run() {
  try {
    const connection = await pool.getConnection();
    
    // 1. Fix typo in roles table
    console.log('Fixing role name Casier -> Cashier...');
    await connection.query("UPDATE roles SET name = 'Cashier' WHERE name = 'Casier'");
    
    // 2. Standardize users role
    console.log('Updating users roles to Cashier...');
    await connection.query("UPDATE users SET role = 'Cashier' WHERE role IN ('cashier', 'Casier')");

    console.log('Database updated successfully.');
    
    connection.release();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
