const fs = require('fs');
const production = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const pro = JSON.parse(fs.readFileSync('vercel.pro.json', 'utf8'));
const actions = fs.readFileSync('.github/workflows/anaira-growth-worker.yml', 'utf8');
const worker = fs.readFileSync('app/api/growth/worker/route.ts', 'utf8');
const checks = [
  ['default Vercel config remains compatible with Hobby daily cadence', production.crons?.some(x => x.path === '/api/growth/worker' && x.schedule === '0 3 * * *')],
  ['Vercel Pro profile enables one-minute worker cadence', pro.crons?.some(x => x.path === '/api/growth/worker' && x.schedule === '* * * * *')],
  ['GitHub Actions fallback invokes worker every five minutes', actions.includes('cron: "*/5 * * * *"')],
  ['GitHub Actions worker protects invocation with CRON_SECRET', actions.includes('Authorization: Bearer ${CRON_SECRET}')],
  ['worker endpoint rejects unauthorized requests', worker.includes("req.headers.get('authorization')!==`Bearer ${secret}`")],
  ['worker processes workflows and autonomous schedules', worker.includes('processWorkflowRuns') && worker.includes('runAutonomousSchedules')],
];
let failed = 0;
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++; }
console.log(`${checks.length - failed}/${checks.length} worker cadence checks passed`);
process.exit(failed ? 1 : 0);
