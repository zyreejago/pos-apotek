
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function imputeMissingValues(series) {
  if (!Array.isArray(series) || series.length === 0) return [];

  const result = [...series];

  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null && Number.isFinite(result[i])) continue;

    let left = null;
    for (let j = i - 1; j >= 0; j--) {
      if (Number.isFinite(result[j])) {
        left = result[j];
        break;
      }
    }

    let right = null;
    for (let j = i + 1; j < result.length; j++) {
      if (Number.isFinite(result[j])) {
        right = result[j];
        break;
      }
    }

    let imputed = 0;

    if (left !== null && right !== null) {
      const trend = (right - left) / 2;
      imputed = left + trend;
    } else if (left !== null) {
      imputed = left;
    } else if (right !== null) {
      imputed = right;
    }

    result[i] = Math.max(0, Math.round(imputed));
  }

  return result;
}

function normalizeAnomalies(series, windowSize = 7) {
  if (!Array.isArray(series) || series.length < windowSize) return series;

  const result = [...series];
  const w = windowSize;

  for (let i = 0; i < result.length; i++) {
    const val = result[i];
    if (!Number.isFinite(val)) continue;

    const start = Math.max(0, i - w);
    const end = Math.min(result.length, i + w + 1);

    const window = result.slice(start, end)
      .filter(v => Number.isFinite(v));

    if (window.length < 3) continue;

    const sorted = [...window].sort((a, b) => a - b);

    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    if (val < lower || val > upper) {
      const median = sorted[Math.floor(sorted.length / 2)];
      result[i] = median;
    }
  }

  return result;
}

function prepareTimeSeries(rows, options = {}) {
  const days = Number.isFinite(options.days) ? options.days : 365;
  
  let endDate;
  if (options.endDate) {
    endDate = new Date(options.endDate);
  } else if (rows && rows.length > 0) {
    const dates = rows.map(r => new Date(r.day)).filter(d => !isNaN(d.getTime()));
    if (dates.length > 0) {
      endDate = new Date(Math.max(...dates));
    } else {
      endDate = new Date();
    }
  } else {
    endDate = new Date();
  }
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const byDay = new Map();
  for (const r of rows || []) {
    const day = r?.day ? new Date(r.day) : null;
    if (!day || Number.isNaN(day.getTime())) continue;
    const key = day.toISOString().slice(0, 10);
    const qty = Number(r?.qty || 0);
    byDay.set(key, (byDay.get(key) || 0) + (Number.isFinite(qty) ? qty : 0));
  }

  let series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const raw = byDay.get(key);
    series.push(raw !== undefined ? raw : null);
  }

  series = imputeMissingValues(series);
  series = normalizeAnomalies(series, 7);

  return { series, startDate, endDate };
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
    console.log('📊 Testing prepareTimeSeries...');

    // Cek produk pertama
    const [products] = await pool.query('SELECT id, name FROM products LIMIT 1');
    if (products.length > 0) {
      const product = products[0];
      console.log(`\n📦 Produk: ${product.name} (ID: ${product.id})`);

      const [salesRows] = await pool.query(
        `SELECT sale_date AS day, quantity AS qty FROM sales_history WHERE product_id = ? ORDER BY sale_date ASC`,
        [product.id]
      );

      const { series, startDate, endDate } = prepareTimeSeries(salesRows, { days: 365 });
      console.log(`\n📅 Start: ${startDate.toISOString().slice(0, 10)}`);
      console.log(`📅 End: ${endDate.toISOString().slice(0, 10)}`);
      console.log(`\n📈 Series (${series.length} hari):`);
      console.log(series);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Koneksi database ditutup.');
  }
}

test();

