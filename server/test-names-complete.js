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
  const rawNames = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'supplier') continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!Array.isArray(rows) || rows.length < 4) continue;

    for (let r = 3; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const rawName = row[1];
      const name = normalizeDrugName(rawName);
      if (!name) continue;
      
      if (!salesByName.has(name)) {
        salesByName.set(name, new Map());
        rawNames.push(rawName);
      }
    }
  }

  return { salesByName, rawNames };
}

async function main() {
  const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');

  console.log('=== 1. Load nama produk di Excel ===');
  const { salesByName, rawNames } = loadMonthlySalesFromXlsx(xlsxPath);
  console.log('Total produk di Excel (normalized):', salesByName.size);
  console.log('Raw nama di Excel (10 pertama):', rawNames.slice(0, 10));
  console.log('Normalized nama di Excel (10 pertama):', Array.from(salesByName.keys()).slice(0, 10));

  console.log('\n=== 2. Load nama produk di database ===');
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_db',
  };
  const conn = await mysql.createConnection(dbConfig);
  const [products] = await conn.query('SELECT id, name, stock, unit FROM products ORDER BY id ASC');
  await conn.end();

  console.log('Total produk di database:', products.length);

  let matchCount = 0;
  let noMatchCount = 0;
  let noMatchList = [];

  for (const product of products) {
    const normalizedDb = normalizeDrugName(product.name);
    if (salesByName.has(normalizedDb)) {
      matchCount++;
    } else {
      noMatchCount++;
      noMatchList.push({
        id: product.id,
        name: product.name,
        normalized: normalizedDb
      });
    }
  }

  console.log('\n=== Hasil Pencocokan ===');
  console.log('Total cocok:', matchCount);
  console.log('Total tidak cocok:', noMatchCount);

  if (noMatchList.length > 0) {
    console.log('\nProduk yang tidak cocok:');
    noMatchList.forEach((p, i) => {
      console.log(`${i + 1}. ID=${p.id}, DB="${p.name}" → Normalized="${p.normalized}"`);
    });
  }
}

main().catch(console.error);
