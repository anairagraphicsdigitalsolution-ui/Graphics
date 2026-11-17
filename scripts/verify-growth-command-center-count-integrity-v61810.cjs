const fs = require('node:fs');
const api = fs.readFileSync('app/api/growth/analytics/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-command-center.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = [
  ['unknown exact database count is preserved as null', api.includes('count: exactCount,') && !api.includes('count: exactCount ?? rows.length')],
  ['coverage cannot mark unknown exact count complete', api.includes('result.count !== null && result.count === result.rows.length')],
  ['loaded rows remain visible when exact count is unknown', api.includes('total: leads.count ?? leadRows.length') && api.includes('events: attribution.count ?? attributionRows.length')],
  ['unknown-count source is explicitly called partial in data quality note', api.includes('did not return an exact database count')],
  ['truncated datasets remain explicitly partial', api.includes('result.truncated') && api.includes('analytics safety cap')],
  ['dashboard labels incomplete data as partial verification required', ui.includes('Partial — verify flagged sources')],
  ['dashboard shows Unknown rather than fabricated source total', ui.includes("item.sourceTotal ?? 'Unknown'")],
  ['tenant scope and role gate remain enforced', api.includes('requireGrowthRole') && api.includes(".eq('organization_id', organizationId)")],
  ['CRM feature entitlement remains enforced', api.includes("requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')")],
  ['focused verifier is registered in verify:all', pkg.scripts['verify:all'].includes('verify:growth-command-center-count-integrity-v61810')],
  ['release version is compatible with Function 5', ['6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version)],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} KPI count-integrity checks passed`);
process.exitCode = failed ? 1 : 0;
