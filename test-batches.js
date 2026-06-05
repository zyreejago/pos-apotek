
const mysql = require('./server/node_modules/mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function test() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skripsi',
  });

  try {
    console.log('Checking suppliers...');
    const [suppliers] = await connection.query('SELECT * FROM suppliers');
    console.log('Suppliers:', suppliers);

    console.log('\nChecking batches...');
    const [batches] = await connection.query('SELECT * FROM batches');
    console.log('Batches:', batches);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    connection.end();
  }
}

test();
