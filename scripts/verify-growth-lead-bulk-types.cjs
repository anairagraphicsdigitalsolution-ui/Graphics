const fs = require('node:fs');
const source = fs.readFileSync('app/api/growth/lead-bulk/route.ts', 'utf8');
const checks = [
  ['IDs are explicitly typed as strings', /ids\s*:\s*string\[\]/.test(source)],
  ['Untrusted input is treated as unknown', /b\.leadIds\s+as\s+unknown\[\]/.test(source)],
  ['Non-string IDs are rejected before UUID validation', /typeof id\s*===\s*'string'\s*\?\s*id\.trim\(\)\s*:\s*''/.test(source)],
  ['Bulk selection remains capped at 100 and UUID validated', /ids\.length<1\|\|ids\.length>100\|\|ids\.some\(\(id:string\)=>!UUID\.test\(id\)\)/.test(source)],
  ['Workspace ownership validation remains in place', /\.eq\('organization_id',orgId\)\.in\('id',ids\)/.test(source)],
  ['Changed fields use a closed union type', /type ChangedLeadField='status'\|'lead_temperature'/.test(source)],
  ['Previous and updated values use typed field access', /fieldValue\(previous,key\),after=fieldValue\(lead,key\)/.test(source)],
  ['Unsafe dynamic string indexing is removed', !/\?\.\[key\]|lead\[key\]/.test(source)],
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log(`${checks.length}/${checks.length} lead bulk type checks passed`);
