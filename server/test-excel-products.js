
const XLSX = require('xlsx');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalizeDrugNameImport(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

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
    console.log('📦 Membaca produk dari database...');
    const [dbProducts] = await pool.query('SELECT id, name FROM products ORDER BY id ASC');
    const dbProductMap = new Map();
    for (const p of dbProducts) {
      const norm = normalizeDrugNameImport(p.name);
      dbProductMap.set(norm, p);
      console.log(`   → DB: ${p.name} → norm: "${norm}"`);
    }

    const wb = XLSX.readFile(path.join(__dirname, '..', 'NEWWWW1.xlsx'));
    const allExcelProducts = new Map();

    for (const sheetName of wb.SheetNames) {
      if (sheetName.toLowerCase() === 'supplier') continue;
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!Array.isArray(rows) || rows.length < 4) continue;

      for (let r = 3; r < rows.length; r += 1) {
        const row = rows[r] || [];
        const rawName = row[1];
        const name = normalizeDrugNameImport(rawName);
        if (!name) continue;
        
        if (!allExcelProducts.has(name)) {
          allExcelProducts.set(name, rawName);
        }
      }
    }

    console.log('\n📊 Produk di Excel (dan norm):');
    for (const [norm, raw] of allExcelProducts.entries()) {
      const match = dbProductMap.get(norm);
      console.log(`   → Excel: ${raw} → norm: "${norm}" → ${match ? '✅ Cocok' : '❌ Tidak cocok'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

