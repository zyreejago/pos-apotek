const { pool } = require('./db');

async function inspectUsers() {
  try {
    const [users] = await pool.query('SELECT id, username, email, role FROM users');
    console.log('Users in DB:');
    console.table(users);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectUsers();
