const mysql = require('mysql2/promise');
const path = require('path');
const xlsx = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalizeDrugName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function loadMonthlySalesFromXlsx(xlsxPath) {
  const wb = xlsx.readFile(xlsxPath);
  const salesByName = new Map();
  let allDates = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'supplier') continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!Array.isArray(rows) || rows.length < 4) continue;

    const header = rows[2] || [];
    const hasNoColumn = header[0] && header[0].toString().toLowerCase().trim() === 'no';
    const nameColumnIndex = hasNoColumn ? 1 : 0;
    const dateCols = [];
    for (let c = 0; c < header.length; c += 1) {
      const v = header[c];
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
        dateCols.push({ c, date: v.trim() });
        allDates.push(v.trim());
      }
    }

    for (let r = 3; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const rawName = row[nameColumnIndex];
      const name = normalizeDrugName(rawName);
      if (!name) continue;

      let dayMap = salesByName.get(name);
      if (!dayMap) {
        dayMap = new Map();
        salesByName.set(name, dayMap);
      }

      for (const dc of dateCols) {
        const cell = row[dc.c];
        let n = null;
        if (typeof cell === 'number') {
          n = cell;
        } else if (typeof cell === 'string' && cell.trim() !== '') {
          const cleaned = cell.replace(/\./g, '').replace(',', '.');
          const parsed = Number(cleaned);
          if (Number.isFinite(parsed)) {
            n = parsed;
          }
        }
        if (n !== null && n >= 0) {
          dayMap.set(dc.date, (dayMap.get(dc.date) || 0) + n);
        }
      }
    }
  }

  let startDate = null;
  let endDate = null;
  if (allDates.length > 0) {
    const dates = allDates.map(d => new Date(d));
    startDate = new Date(Math.min(...dates));
    endDate = new Date(Math.max(...dates));
  }

  return { salesByName, startDate, endDate };
}

async function importToDatabase() {
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
    console.log('📥 Membaca file Excel...');
    const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
    const { salesByName, startDate, endDate } = loadMonthlySalesFromXlsx(xlsxPath);
    console.log(`✅ Total produk di Excel: ${salesByName.size}`);
    console.log(`📅 Periode: ${startDate?.toISOString().slice(0, 10)} sampai ${endDate?.toISOString().slice(0, 10)}`);

    console.log('\n📦 Membaca produk dari database...');
    const [products] = await pool.query('SELECT id, name, stock, unit FROM products ORDER BY id ASC');
    console.log(`✅ Total produk di DB: ${products.length}`);

    console.log('\n🔍 Mencocokkan nama produk...');
    const productMap = new Map();
    for (const p of products) {
      const norm = normalizeDrugName(p.name);
      productMap.set(norm, p);
    }

    let matchedCount = 0;
    let noMatchCount = 0;
    const matchedProducts = [];

    for (const [normName, dayMap] of salesByName) {
      const product = productMap.get(normName);
      if (product) {
        matchedCount++;
        matchedProducts.push({ product, dayMap });
      } else {
        noMatchCount++;
        if (noMatchCount <= 5) {
          console.log(`❌ Tidak cocok: Excel norm="${normName}"`);
        }
      }
    }

    console.log(`\n✅ Cocok: ${matchedCount} produk`);
    console.log(`❌ Tidak cocok: ${noMatchCount} produk`);

    if (matchedCount === 0) {
      console.log('\n⚠️ Tidak ada produk yang cocok!');
      await pool.end();
      return;
    }

    console.log('\n🗄️ Membuat tabel sales_history jika belum ada...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        sale_date DATE NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_sale (product_id, sale_date),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Tabel sales_history siap!');

    console.log('\n📥 Memasukkan data ke sales_history...');
    let totalInserted = 0;

    for (const { product, dayMap } of matchedProducts) {
      console.log(`\nMemproses: ${product.name} (ID: ${product.id})`);
      let productInserted = 0;

      for (const [dateStr, qty] of dayMap) {
        try {
          await pool.query(`
            INSERT INTO sales_history (product_id, sale_date, quantity)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
          `, [product.id, dateStr, Math.round(qty)]);
          productInserted++;
          totalInserted++;
        } catch (err) {
          console.error(`❌ Gagal insert ${product.name} ${dateStr}:`, err.message);
        }
      }

      console.log(`✅ ${product.name}: ${productInserted} hari`);
    }

    console.log(`\n🎉 Selesai! Total ${totalInserted} baris dimasukkan!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

importToDatabase();
