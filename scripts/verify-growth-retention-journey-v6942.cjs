const fs = require('fs');
const route = fs.readFileSync('app/api/growth/retention/journey/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-crm-retention.tsx', 'utf8');
const checks = [
  ['journey requires authenticated workspace context', route.includes('growthContext(req)')],
  ['journey requires CRM feature and editor role', route.includes("['owner', 'manager', 'editor']") && route.includes("'crm'")],
  ['customer lookup is tenant scoped', route.includes(".eq('id', leadId).eq('organization_id', organizationId)")],
  ['only Won customers can start a journey', route.includes("lead.status !== 'won'")],
  ['journey has 7, 30, 60 and 90 day milestones', [7,30,60,90].every(day => route.includes(`days: ${day}`))],
  ['journey tasks are internal and explicitly prohibit automatic messaging', route.includes('No customer message is sent automatically') && route.includes('external_messages_sent: 0')],
  ['active duplicate journey is rejected', route.includes(".ilike('description', `%${MARKER}%`)") && route.includes('An active 90-day retention sequence already exists')],
  ['assignee membership is checked in the same workspace', route.includes(".eq('organization_id', organizationId).eq('user_id', ctx.userId)")],
  ['four tasks are inserted as one batch', route.includes('.insert(rows)') && route.includes('tasks.length !== STEPS.length')],
  ['journey creation is written to CRM activity timeline', route.includes('retention_journey:') && route.includes('growth_lead_activities')],
  ['UI exposes the 90-day sequence action', ui.includes('Create 90-day retention sequence') && ui.includes('createJourney')],
  ['UI refreshes task list after sequence creation', ui.includes("setNotice(data.message || '90-day internal retention sequence created.'); await load();")],
];
let failed = 0;
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++; }
console.log(`${checks.length - failed}/${checks.length} retention journey checks passed`);
process.exit(failed ? 1 : 0);
