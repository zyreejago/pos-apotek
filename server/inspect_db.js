
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
    console.log('--- Roles ---');
    const [roles] = await pool.query('SELECT * FROM roles');
    console.table(roles);

    console.log('\n--- Role Permissions (Management Pengguna) ---');
    const [perms] = await pool.query(`
      SELECT rp.role_id, r.name as role_name, rp.module, rp.action, rp.allowed 
      FROM role_permissions rp 
      JOIN roles r ON rp.role_id = r.id 
      WHERE rp.module = 'Management Pengguna'
    `);
    console.table(perms);

    console.log('\n--- Users ---');
    const [users] = await pool.query('SELECT id, username, role FROM users');
    console.table(users);
    
    // Check type of 'allowed'
    if (perms.length > 0) {
        console.log('\nType of allowed:', typeof perms[0].allowed);
        console.log('Value of allowed:', perms[0].allowed);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
