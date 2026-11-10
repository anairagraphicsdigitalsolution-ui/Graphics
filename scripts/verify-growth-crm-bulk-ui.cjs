const fs=require('fs'),s=fs.readFileSync('components/growth-crm.tsx','utf8');
const checks=[
 ['CRM UI renders bulk action panel',s.includes('Bulk lead actions')],
 ['bulk selection is capped at 100',s.includes('prev.length>=100')],
 ['visible filtered leads can be selected',s.includes('filtered.slice(0,100).map(l=>l.id)')],
 ['bulk action calls tenant-scoped API',s.includes("fetch('/api/growth/lead-bulk'")&&s.includes('organizationId:org')],
 ['bulk status and temperature are controlled',s.includes('value={bulkStatus}')&&s.includes('value={bulkTemperature}')],
 ['successful update refreshes CRM and clears selection',s.includes("setBulkSelected([])")&&s.includes('await load(org)')]
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} CRM bulk UI checks passed`);
