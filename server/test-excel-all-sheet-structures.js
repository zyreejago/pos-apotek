
const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'NEWWWW1.xlsx'));

for (const sheetName of wb.SheetNames) {
  if (sheetName.toLowerCase() === 'supplier') continue;
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!Array.isArray(rows) || rows.length < 3) continue;

  console.log(`\n📋 Struktur Sheet: ${sheetName}`);
  console.log('   → Baris 0 (Judul):', rows[0].join(' | '));
  console.log('   → Baris 1 (Note):', rows[1].join(' | '));
  console.log('   → Baris 2 (Header):', rows[2].join(' | '));
  console.log('   → Baris 3 (Data 1):', rows[3].join(' | '));
}

