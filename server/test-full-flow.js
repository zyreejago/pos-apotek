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

function normalizeAnomalies(series, windowSize = 7) {
  if (!Array.isArray(series) || series.length < windowSize) return series;
  
  const result = [...series];
  const w = windowSize;
  
  for (let i = 0; i < result.length; i++) {
    const start = Math.max(0, i - w);
    const end = Math.min(result.length, i + w + 1);
    const window = result.slice(start, end);
    
    const sorted = [...window].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
    const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    
    if (result[i] < lower || result[i] > upper) {
      const avg = window.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / window.length;
      result[i] = Math.max(0, Math.round(avg));
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
  return series;
}

function createSlidingWindow(series, windowSize = 7) {
  const w = Number.isFinite(windowSize) ? windowSize : 7;
  if (!Array.isArray(series) || series.length < w + 1) return [];
  const dataset = [];
  for (let i = 0; i + w < series.length; i += 1) {
    dataset.push({
      input: series.slice(i, i + w),
      output: series[i + w],
    });
  }
  return dataset;
}

const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
console.log('Membaca file:', xlsxPath);

const { salesByName, endDate } = loadMonthlySalesFromXlsx(xlsxPath);
console.log('Total produk di Excel:', salesByName.size);
console.log('End date:', endDate?.toISOString().slice(0, 10));

// Ambil produk pertama untuk test
const firstProductName = Array.from(salesByName.keys())[0];
if (firstProductName) {
  console.log('\nProduk pertama:', firstProductName);
  const dayMap = salesByName.get(firstProductName);
  console.log('Jumlah hari dengan data di Excel:', dayMap.size);
  
  // Step 1: Build daily series
  const seriesRaw = buildDailySeriesFromDayMap(dayMap, endDate, 365);
  console.log('\n=== Step 1 Result ===');
  console.log('Panjang series:', seriesRaw.length);
  console.log('Beberapa nilai:', seriesRaw.slice(0, 20));
  
  // Step 2: Impute missing values
  console.log('\n=== Step 2: imputeMissingValues ===');
  const seriesImputed = imputeMissingValues(seriesRaw);
  console.log('Series setelah impute:', seriesImputed);
  console.log('Beberapa nilai:', seriesImputed.slice(0, 20));
  
  // Step 3: Normalize anomalies
  console.log('\n=== Step 3: normalizeAnomalies ===');
  const seriesNormalized = normalizeAnomalies(seriesImputed, 7);
  console.log('Series setelah normalize:', seriesNormalized);
  console.log('Beberapa nilai:', seriesNormalized.slice(0, 20));
  
  // Step 4: Create sliding window
  console.log('\n=== Step 4: createSlidingWindow ===');
  const datasetWindowed = createSlidingWindow(seriesNormalized, 7);
  console.log('Jumlah window:', datasetWindowed.length);
  console.log('Beberapa window:', datasetWindowed.slice(0, 10));
}
