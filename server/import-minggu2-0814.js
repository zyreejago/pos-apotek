const mysql = require('mysql2/promise');
const path = require('path');
const xlsx = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalizeDrugName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function importMinggu2() {
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
    const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
    const wb = xlsx.readFile(xlsxPath);
    const ws = wb.Sheets['MINGGU-KE-2'];
    if (!ws) throw new Error('Sheet MINGGU-KE-2 tidak ditemukan!');

    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 4) throw new Error('Sheet MINGGU-KE-2 tidak memiliki data!');

    const header = rows[3];
    const dateCols = [];
    for (let c = 6; c < header.length; c++) {
      const v = header[c];
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
        const dateStr = v.trim();
        const day = parseInt(dateStr.split('-')[2], 10);
        if (day >= 15 && day <= 21) {
          dateCols.push({ c, date: dateStr });
        }
      }
    }
    console.log(`Ditemukan ${dateCols.length} tanggal (15-21):`, dateCols.map(d => d.date));

    const [products] = await pool.query('SELECT id, name FROM products');
    const productMap = new Map();
    for (const p of products) {
      productMap.set(normalizeDrugName(p.name), p);
    }

    let totalInserted = 0;
    let matched = 0;
    let noMatch = 0;

    for (let r = 4; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[1]) continue;

      const excelName = row[1].toString().trim();
      const normName = normalizeDrugName(excelName);
      const product = productMap.get(normName);

      if (!product) {
        console.log(`Tidak cocok: ${excelName} (norm=${normName})`);
        noMatch++;
        continue;
      }

      matched++;
      let productInserted = 0;

      for (const dc of dateCols) {
        const cell = row[dc.c];
        let qty = null;
        if (typeof cell === 'number') qty = cell;
        else if (typeof cell === 'string' && cell.trim() !== '') {
          const cleaned = cell.replace(/\./g, '').replace(',', '.');
          const parsed = Number(cleaned);
          if (Number.isFinite(parsed)) qty = parsed;
        }

        if (qty !== null && qty >= 0) {
          await pool.query(
            `INSERT INTO sales_history (product_id, sale_date, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
            [product.id, dc.date, Math.round(qty)]
          );
          productInserted++;
          totalInserted++;
        }
      }

      console.log(`  ${excelName} (ID=${product.id}): ${productInserted} hari`);
    }

    console.log(`\nSelesai! ${matched} produk cocok, ${noMatch} tidak cocok, ${totalInserted} baris ditambahkan.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

importMinggu2();
