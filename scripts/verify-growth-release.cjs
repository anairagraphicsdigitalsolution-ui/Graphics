const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
const workflowPath = path.join(root, '.github/workflows/anaira-growth-ci.yml');
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const smoke = fs.readFileSync(path.join(root, 'scripts/smoke-growth-public.cjs'), 'utf8');
check('release CI workflow exists', Boolean(workflow));
check('release CI runs the full regression suite', workflow.includes('npm run verify:all'));
check('release CI runs the Next.js production build', workflow.includes('npm run build'));
check('release CI uses Node.js 20', workflow.includes('node-version: 20'));
check('release CI does not assume a lockfile cache exists', !workflow.includes('cache: npm'));
check('release CI disables Supabase client initialization at build time', workflow.includes('NEXT_PUBLIC_SUPABASE_URL: ""') && workflow.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY: ""'));
check('release CI does not require production secrets', !/secrets\.(SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|META_APP_SECRET|WHATSAPP_ACCESS_TOKEN)/.test(workflow));
check('public smoke test checks worker authentication', smoke.includes("worker.status === 401"));
check('public smoke test supports both provider webhook challenges', smoke.includes('WHATSAPP_VERIFY_TOKEN') && smoke.includes('META_WEBHOOK_VERIFY_TOKEN'));
check('verify:all includes the release gate', pkg.scripts['verify:all'].includes('verify:growth-release'));
process.exitCode = failed ? 1 : 0;
