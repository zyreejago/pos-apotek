const XLSX = require('xlsx');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

function normalizeDrugName(input) {
  return (input || '')
    .toString()
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function loadMonthlySalesFromXlsx(filePath) {
  if (!filePath) return { salesByName: new Map(), endDate: null };
  if (!require('fs').existsSync(filePath)) return { salesByName: new Map(), endDate: null };

  const wb = XLSX.readFile(filePath);
  const salesByName = new Map();
  let endDate = null;

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'supplier') continue;

    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!Array.isArray(rows) || rows.length < 4) continue;

    const header = rows[2] || [];
    const dateCols = [];
    for (let c = 0; c < header.length; c += 1) {
      const v = header[c];
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
        dateCols.push({ c, date: v.trim() });
      }
    }

    for (let r = 3; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const rawName = row[1];
      const name = normalizeDrugName(rawName);
      if (!name) continue;

      let dayMap = salesByName.get(name);
      if (!dayMap) {
        dayMap = new Map();
        salesByName.set(name, dayMap);
      }

      for (const dc of dateCols) {
        const cell = row[dc.c];
        if (cell === '' || cell === null || cell === undefined) continue;
        const qty = typeof cell === 'number' ? cell : Number(cell.toString().replace(/,/g, '.'));
        const n = Number.isFinite(qty) ? qty : 0;
        if (n < 0) continue;
        dayMap.set(dc.date, (dayMap.get(dc.date) || 0) + n);

        const d = new Date(dc.date);
        if (!Number.isNaN(d.getTime())) {
          if (!endDate || d > endDate) endDate = d;
        }
      }
    }
  }

  return { salesByName, endDate };
}

async function main() {
  const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
  console.log('Membaca file Excel:', xlsxPath);

  const { salesByName } = loadMonthlySalesFromXlsx(xlsxPath);
  console.log('Total produk di Excel:', salesByName.size);
  console.log('Nama produk di Excel (10 pertama):', Array.from(salesByName.keys()).slice(0, 10));

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_db',
  };

  console.log('\nKoneksi ke database...');
  const conn = await mysql.createConnection(dbConfig);
  const [products] = await conn.query('SELECT id, name FROM products ORDER BY id ASC');
  console.log('Total produk di database:', products.length);
  console.log('Nama produk di database (10 pertama):', products.slice(0, 10).map(p => p.name));
  console.log('Normalized nama di database (10 pertama):', products.slice(0, 10).map(p => normalizeDrugName(p.name)));

  console.log('\n=== Mencari produk database yang cocok di Excel ===');
  let matchCount = 0;
  let noMatchCount = 0;
  for (const product of products) {
    const normalizedDb = normalizeDrugName(product.name);
    if (salesByName.has(normalizedDb)) {
      matchCount++;
    } else {
      noMatchCount++;
      if (noMatchCount <= 10) {
        console.log(`❌ Tidak cocok: DB="${product.name}" → Normalized="${normalizedDb}"`);
      }
    }
  }

  console.log('\nTotal cocok:', matchCount);
  console.log('Total tidak cocok:', noMatchCount);

  await conn.end();
}

main().catch(console.error);
