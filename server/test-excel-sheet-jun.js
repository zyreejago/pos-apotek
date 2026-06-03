
const XLSX = require('xlsx');
const path = require('path');

function normalizeDrugNameImport(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function loadSheetData(filePath, sheetName) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!Array.isArray(rows) || rows.length < 4) return null;

  const header = rows[2] || [];
  const dateCols = [];
  for (let c = 0; c < header.length; c += 1) {
    const v = header[c];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
      dateCols.push({ c, date: v.trim() });
    }
  }

  const products = [];
  for (let r = 3; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const rawName = row[1];
    const name = normalizeDrugNameImport(rawName);
    if (!name) continue;

    const dayMap = new Map();
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
        dayMap.set(dc.date, n);
      }
    }

    products.push({ rawName, name, dayMap, dateCount: dayMap.size });
  }

  return { dateCols, products };
}

const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
const sheetNames = ['JAN', 'FEB', 'MAR', 'April', 'MEI', 'JUN', 'JULI', 'AGUST', 'SEPT', 'OKTO', 'NOV', 'DES'];

for (const sheetName of sheetNames) {
  const data = loadSheetData(xlsxPath, sheetName);
  if (!data) continue;

  console.log(`\n📅 Sheet: ${sheetName}`);
  console.log(`   → Total hari: ${data.dateCols.length}`);
  
  const matchingProducts = data.products.filter(p => ['sanmoltab', 'paracetamoltab'].includes(p.name));
  console.log(`   → Produk yang cocok (contoh): ${matchingProducts.length}`);
  
  for (const p of matchingProducts.slice(0, 2)) {
    console.log(`   → ${p.rawName}: ${p.dateCount} hari`);
    console.log(`     → Contoh tanggal dan qty:`);
    const entries = Array.from(p.dayMap.entries()).slice(0, 3);
    for (const [date, qty] of entries) {
      console.log(`       → ${date}: ${qty}`);
    }
  }
}

