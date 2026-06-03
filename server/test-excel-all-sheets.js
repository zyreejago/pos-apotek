
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
  const wb = XLSX.readFile(filePath);
  const salesByName = new Map();
  let allDates = [];

  console.log('📚 Sheet names:', wb.SheetNames);

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
        allDates.push(v.trim());
      }
    }

    console.log(`\n📅 Sheet: ${sheetName}, Hari: ${dateCols.length}`);
    console.log(`   → Tanggal pertama: ${dateCols[0]?.date}`);
    console.log(`   → Tanggal terakhir: ${dateCols[dateCols.length - 1]?.date}`);

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

  console.log(`\n✅ Total unique dates: ${new Set(allDates).size}`);

  let startDate = null;
  let endDate = null;
  if (allDates.length > 0) {
    const dates = allDates.map(d => new Date(d));
    startDate = new Date(Math.min(...dates));
    endDate = new Date(Math.max(...dates));
  }

  return { salesByName, startDate, endDate };
}

const xlsxPath = path.join(__dirname, '..', 'NEWWWW1.xlsx');
const result = loadMonthlySalesFromXlsx(xlsxPath);
console.log('\n✅ Total produk:', result.salesByName.size);
console.log('✅ Periode:', result.startDate?.toISOString().slice(0, 10), '-', result.endDate?.toISOString().slice(0, 10));

