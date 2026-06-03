
const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'NEWWWW1.xlsx'));
const sheetName = 'JUN';
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.log('❌ Sheet tidak ditemukan!');
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(`📅 Sheet: ${sheetName}`);
console.log(`   → Total baris: ${rows.length}`);
console.log('');

console.log('📋 Baris 0-10:');
for (let i = 0; i < Math.min(20, rows.length); i++) {
  console.log(`   → Baris ${i}:`, rows[i].join(' | '));
}

