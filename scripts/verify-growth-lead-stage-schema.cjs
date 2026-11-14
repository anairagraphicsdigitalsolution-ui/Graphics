const fs = require('node:fs');
const migration = fs.readFileSync('supabase/migrations/20261113172000_growth_lead_sales_stages_v6896.sql', 'utf8');
const update = fs.readFileSync('app/api/growth/lead-update/route.ts', 'utf8');
const bulk = fs.readFileSync('app/api/growth/lead-bulk/route.ts', 'utf8');
const meetings = fs.readFileSync('app/api/growth/crm/meetings/route.ts', 'utf8');
const tests = [
  ['schema migration replaces restrictive status check', migration.includes('drop constraint if exists growth_leads_status_check') && migration.includes('add constraint growth_leads_status_check')],
  ['all 13 UI lifecycle statuses are allowed by schema', ['new','discovered','enriched','qualified','contact_pending','contacted','interested','meeting_scheduled','proposal','negotiation','follow_up_later','won','lost'].every(x => migration.includes(`'${x}'`))],
  ['single lead update statuses match schema', ['new','discovered','enriched','qualified','contact_pending','contacted','interested','meeting_scheduled','proposal','negotiation','follow_up_later','won','lost'].every(x => update.includes(`'${x}'`))],
  ['bulk lead update statuses match schema', ['new','discovered','enriched','qualified','contact_pending','contacted','interested','meeting_scheduled','proposal','negotiation','follow_up_later','won','lost'].every(x => bulk.includes(`'${x}'`))],
  ['meeting scheduler stage is accepted by the database migration', migration.includes("'meeting_scheduled'") && meetings.includes("status: 'meeting_scheduled'")],
  ['tenant/status index is created for CRM pipeline queries', migration.includes('growth_leads_org_status_updated_idx')],
];
let failed = 0;
for (const [label, ok] of tests) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${tests.length - failed}/${tests.length} lead-stage schema checks passed.`);
if (failed) process.exit(1);
