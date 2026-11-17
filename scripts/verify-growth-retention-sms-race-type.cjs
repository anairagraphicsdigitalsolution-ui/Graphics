const fs = require('fs');
const route = fs.readFileSync('app/api/growth/retention/outreach/route.ts', 'utf8');
const checks = [
  ['existing SMS lookup selects id and status', /from\('growth_sms_messages'\)\.select\('id,status'\)[\s\S]*?client_request_id/.test(route)],
  ['new SMS insert returns id and status', /insert\([\s\S]*?\)\.select\('id,status'\)\.single\(\)/.test(route)],
  ['unique-conflict recovery selects id and status', /const \{ data: racedSms \} = await ctx\.db\.from\('growth_sms_messages'\)\.select\('id,status'\)/.test(route)],
  ['recovered SMS status remains available for retry protection', /smsCurrentStatus = String\(\(sms as any\)\.status \|\| 'queued'\)/.test(route)],
];
let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}
console.log(`RESULT ${checks.length - failures}/${checks.length} PASS`);
process.exitCode = failures ? 1 : 0;
