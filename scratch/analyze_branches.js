const fs = require('fs');
const path = require('path');

const coverageFile = path.join(__dirname, '../coverage/coverage-final.json');
if (!fs.existsSync(coverageFile)) {
  console.error('coverage-final.json not found at ' + coverageFile);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));

// Find the key for page.tsx
const keys = Object.keys(data);
const key = keys.find(k => k.endsWith('products/page.tsx'));

if (!key) {
  console.error('Products page.tsx entry not found in coverage data.');
  process.exit(1);
}

const fileData = data[key];
const branchMap = fileData.branchMap;
const b = fileData.b;

let output = '';
function log(msg) {
  output += msg + '\n';
}

log('--- Uncovered Branches Analysis for src/app/products/page.tsx ---');
log(`Total branch IDs: ${Object.keys(branchMap).length}`);

let uncoveredBranchCount = 0;
let totalBranchPaths = 0;
let coveredBranchPaths = 0;

const uncoveredDetails = [];

for (const [branchId, mapInfo] of Object.entries(branchMap)) {
  const paths = mapInfo.locations;
  const executionCounts = b[branchId];
  totalBranchPaths += paths.length;

  const uncoveredPathsIndices = [];
  executionCounts.forEach((count, idx) => {
    if (count === 0) {
      uncoveredPathsIndices.push(idx);
    } else {
      coveredBranchPaths++;
    }
  });

  if (uncoveredPathsIndices.length > 0) {
    uncoveredBranchCount++;
    uncoveredDetails.push({
      branchId,
      line: mapInfo.line || (paths[0] && paths[0].start && paths[0].start.line),
      type: mapInfo.type,
      pathsCount: paths.length,
      uncoveredIndices: uncoveredPathsIndices,
      locations: paths.map(p => `Line ${p.start ? p.start.line : '?'}:${p.start ? p.start.column : '?'}`)
    });
  }
}

log(`Total branch paths: ${totalBranchPaths}`);
log(`Covered branch paths: ${coveredBranchPaths}`);
log(`Uncovered branch paths: ${totalBranchPaths - coveredBranchPaths}`);
log(`Branch coverage: ${(coveredBranchPaths / totalBranchPaths * 100).toFixed(2)}%`);
log(`Uncovered branch IDs count: ${uncoveredBranchCount}`);

// Sort details by line number
uncoveredDetails.sort((a, b) => a.line - b.line);

log('\nDetailed List of Uncovered Branch Paths:');
uncoveredDetails.forEach(d => {
  log(`Branch ID ${d.branchId} on Line ${d.line} (type: ${d.type}, paths: ${d.pathsCount}):`);
  d.uncoveredIndices.forEach(idx => {
    log(`  - Path [${idx}] uncovered at location: ${d.locations[idx]}`);
  });
});

fs.writeFileSync(path.join(__dirname, 'branch_report.txt'), output, 'utf8');
console.log('Report written to scratch/branch_report.txt');

