const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('app/api/growth/command-insights/route.ts');
const component = read('components/growth-command-predictive-insights.tsx');
const center = read('components/growth-command-center.tsx');
const pkg = JSON.parse(read('package.json'));
const checks = [
  ['route is workspace authenticated', route.includes('growthContext(req)') && route.includes("get('organizationId')")],
  ['route enforces workspace role', route.includes('requireGrowthRole') && route.includes("'viewer'")],
  ['route enforces CRM entitlement', route.includes("requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')")],
  ['lead comparison uses two 30-day windows', route.includes('now - 30 * DAY') && route.includes('now - 60 * DAY')],
  ['lead trend requires minimum prior sample', route.includes('if (prior >= 5)')],
  ['lead decline threshold is explicit', route.includes('change <= -20')],
  ['overdue task pressure uses count and share', route.includes('overdueCount >= 3 && overdueShare >= 0.2')],
  ['cold lead mix requires minimum sample', route.includes('current.length >= 10 && coldShare >= 0.6')],
  ['failed action risk uses terminal attempts', route.includes("['executed', 'failed']") && route.includes('failedShare >= 0.25')],
  ['all source queries are organization scoped', (route.match(/eq\('organization_id', organizationId\)/g) || []).length === 5],
  ['row caps and partial data are exposed', route.includes('.limit(2000)') && route.includes('incompleteSources') && route.includes('partial: incompleteSources > 0')],
  ['risk score is bounded', route.includes('Math.min(100, riskIndex)')],
  ['no probability or causal claim is made', route.includes('not a probability, financial forecast or causal estimate')],
  ['recommendations require human review', route.includes('Recommendations require human review')],
  ['client calls authenticated endpoint', component.includes('supabase.auth.getSession()') && component.includes('/api/growth/command-insights')],
  ['client shows evidence and confidence', component.includes('item.evidence') && component.includes('item.confidence')],
  ['client handles partial data', component.includes('result.dataQuality.partial')],
  ['command center mounts predictive insights', center.includes('GrowthCommandPredictiveInsights organizationId={organizationId}')],
  ['release version and verifier registration are current', ['6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version) && pkg.scripts['verify:all'].includes('verify:growth-command-center-insights-v62600')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; }
console.log(`${checks.length - failed}/${checks.length} Function 13 business insights checks passed`);
process.exitCode = failed ? 1 : 0;
