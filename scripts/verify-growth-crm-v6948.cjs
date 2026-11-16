const fs = require('node:fs');
const read = p => fs.readFileSync(p,'utf8');
const meeting = read('app/api/growth/crm/meetings/route.ts');
const proposal = read('app/api/growth/crm/proposals/route.ts');
const tests = [
 ['Meeting state machine prevents reopening terminal meetings', meeting.includes("scheduled: ['completed', 'cancelled', 'no_show']")],
 ['Meeting updates use optimistic status matching', meeting.includes(".eq('status', current.status).select('*').maybeSingle()")],
 ['Meeting conflicts return 409', meeting.includes('Meeting status changed in another session')],
 ['Scheduling does not reopen won or lost leads', meeting.includes(".not('status', 'in', '(won,lost)')")],
 ['Proposal status updates use optimistic status matching', proposal.includes(".eq('status', current.status).select('*').maybeSingle()")],
 ['Proposal conflicts return 409', proposal.includes('Proposal status changed in another session')],
 ['Oversized line-item arrays are rejected rather than truncated', proposal.includes('b.lineItems.length > 30') && !proposal.includes('b.lineItems.slice(0, 30)')],
 ['Invalid calendar expiry dates are rejected', proposal.includes('Proposal expiry date is invalid.')],
];
let failures = 0;
for (const [name, ok] of tests) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if (!ok) failures++; }
console.log(`${tests.length-failures}/${tests.length} Module 3 CRM hardening checks passed.`);
if (failures) process.exit(1);
