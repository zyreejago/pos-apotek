const XLSX = require('xlsx');
const path = require('path');

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

function findNextValid(arr, startIndex) {
  for (let i = startIndex + 1; i < arr.length; i++) {
    if (Number.isFinite(arr[i]) && arr[i] >= 0) return arr[i];
  }
  return null;
}

function imputeMissingValues(series) {
  if (!Array.isArray(series) || series.length === 0) return [];
  
  const result = [...series];
  
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null || result[i] === undefined || !Number.isFinite(result[i])) {
      const prevValid = result.slice(0, i).reverse().find(v => Number.isFinite(v) && v >= 0);
      const nextValid = findNextValid(result, i);
      
      if (prevValid !== undefined && nextValid !== null) {
        result[i] = Math.round((prevValid + nextValid) / 2);
      } else if (prevValid !== undefined) {
        result[i] = prevValid;
      } else if (nextValid !== null) {
        result[i] = nextValid;
      } else {
        result[i] = 0;
      }
    }
  }
  
  return result;
}

function buildDailySeriesFromDayMap(dayMap, endDate, days) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  let series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const raw = dayMap?.get(key);
    series.push(raw !== undefined ? raw : null);
  }

  console.log('=== Step 1: buildDailySeriesFromDayMap ===');
  console.log('Series (raw sebelum impute):', series);
  console.log('Panjang:', series.length);
  console.log('Beberapa nilai:', series.slice(0, 20));

  return series;
}

const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
console.log('Membaca file Excel:', xlsxPath);

const { salesByName, endDate } = loadMonthlySalesFromXlsx(xlsxPath);

const productName = 'amlodipine 5mg tab';
const normalizedName = normalizeDrugName(productName);

console.log('\nMencari produk:', normalizedName);
console.log('Apakah ada di Excel:', salesByName.has(normalizedName));

if (salesByName.has(normalizedName)) {
  const dayMap = salesByName.get(normalizedName);
  console.log('Jumlah hari dengan data di Excel:', dayMap.size);
  console.log('Beberapa data di Excel:', Array.from(dayMap.entries()).slice(0, 20));

  const seriesRaw = buildDailySeriesFromDayMap(dayMap, endDate, 365);
  const seriesImputed = imputeMissingValues(seriesRaw);

  console.log('\n=== Step 2: imputeMissingValues ===');
  console.log('Series setelah impute:', seriesImputed);
  console.log('Beberapa nilai:', seriesImputed.slice(0, 20));
}
