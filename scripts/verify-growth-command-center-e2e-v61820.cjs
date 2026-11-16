const fs = require('node:fs');
const path = require('node:path');
const spec = fs.readFileSync('e2e/growth-command-center.spec.mjs', 'utf8');
const ui = fs.readFileSync('components/growth-command-center.tsx', 'utf8');
const briefing = fs.readFileSync('components/growth-daily-briefing.tsx', 'utf8');
const login = fs.readFileSync('app/growth-login/GrowthLoginClient.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = [
  ['E2E runner requires explicit base URL, credentials and workspace ID', ['AIGE_BASE_URL','AIGE_TEST_EMAIL','AIGE_TEST_PASSWORD','AIGE_TEST_ORGANIZATION_ID'].every(x => spec.includes(x))],
  ['browser test signs in through the real Growth login UI', spec.includes("page.getByLabel('Email address')") && spec.includes("page.getByLabel('Password', { exact: true })") && login.includes('signInWithPassword')],
  ['browser test navigates to the real Command Center overview', spec.includes('/admin/ai-growth/overview') && spec.includes("getByRole('heading', { name: 'AI Command Center' })")],
  ['browser test verifies KPI data and reconciliation table render', spec.includes('Leads · last 30 days') && spec.includes('KPI source reconciliation')],
  ['browser test verifies workspace-scoped analytics request', spec.includes("searchParams.get('organizationId') === organizationId") && ui.includes('encodeURIComponent(organizationId)')],
  ['browser test verifies manual KPI refresh issues another request', spec.includes("getByRole('button', { name: 'Refresh KPIs' })") && spec.includes('analyticsResponses.length > beforeRefresh')],
  ['browser test verifies briefing API and visible briefing module', spec.includes("item.method === 'POST' && item.status === 200") && briefing.includes('AI Daily Business Briefing')],
  ['browser test captures browser runtime and console errors', spec.includes("page.on('pageerror'") && spec.includes("message.type() === 'error'")],
  ['browser test captures success/failure screenshots', spec.includes('artifacts/growth-command-center-e2e.png') && spec.includes('artifacts/growth-command-center-e2e-failure.png')],
  ['authenticated E2E remains an opt-in command, not a fake offline PASS', pkg.scripts['e2e:command-center'] === 'node e2e/growth-command-center.spec.mjs'],
  ['focused verifier is included in verify:all', pkg.scripts['verify:all'].includes('verify:growth-command-center-e2e-v61820')],
  ['release package version remains compatible after Function 5', ['6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} Command Center E2E harness checks passed`);
process.exitCode = failed ? 1 : 0;
