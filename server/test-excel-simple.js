
const XLSX = require('xlsx');
const path = require('path');

function normalizeDrugNameImport(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const wb = XLSX.readFile(path.join(__dirname, '..', 'NEWWWW1.xlsx'));
const sheetName = 'JUN';
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(`Sheet: ${sheetName}`);
console.log(`Total baris: ${rows.length}`);

for (let r = 3; r < rows.length; r++) {
  const row = rows[r];
  const rawName = row[1];
  const normName = normalizeDrugNameImport(rawName);
  console.log(`Baris ${r}: rawName=${JSON.stringify(rawName)}, normName=${JSON.stringify(normName)}`);
  if (normName === 'sanmoltab') {
    console.log('  ✅ Cocok dengan sanmoltab!');
  }
}

