const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
const hobby = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const pro = JSON.parse(fs.readFileSync(path.join(root, 'vercel.pro.json'), 'utf8'));
const action = fs.readFileSync(path.join(root, '.github/workflows/anaira-growth-worker.yml'), 'utf8');
check('default Vercel schedule remains Hobby-compatible (daily)', hobby.crons?.some(x => x.path === '/api/growth/worker' && x.schedule === '0 3 * * *'));
check('Vercel Pro profile supports one-minute worker cadence', pro.crons?.some(x => x.path === '/api/growth/worker' && x.schedule === '* * * * *'));
check('GitHub Actions fallback invokes worker every five minutes', action.includes('cron: "*/5 * * * *"'));
check('GitHub Actions worker uses protected CRON_SECRET header', action.includes('Authorization: Bearer ${CRON_SECRET}'));
check('GitHub Actions workflow is manually dispatchable', action.includes('workflow_dispatch:'));
check('worker route rejects requests without CRON_SECRET', fs.readFileSync(path.join(root, 'app/api/growth/worker/route.ts'), 'utf8').includes("req.headers.get('authorization')!==`Bearer ${secret}`"));
check('setup guide explains GitHub Actions secret configuration', fs.readFileSync(path.join(root, 'ANAIRA-AI-GROWTH-SETUP.md'), 'utf8').includes('ANAIRA_GROWTH_CRON_SECRET'));
check('worker endpoint supports authenticated GET invocation', fs.readFileSync(path.join(root, 'app/api/growth/worker/route.ts'), 'utf8').includes('export async function GET(req:NextRequest)'));
process.exitCode = failed ? 1 : 0;
