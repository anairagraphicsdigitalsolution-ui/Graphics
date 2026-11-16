const fs = require('node:fs');
const api = fs.readFileSync('app/api/growth/analytics/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-command-center.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = [
  ['all seven dashboard datasets expose per-source coverage', ['leads','content','campaigns','usage','tasks','conversations','attribution'].every(k => api.includes(`${k}: coverage(${k})`))],
  ['coverage compares exact database count to loaded row count', api.includes('result.count === result.rows.length')],
  ['unknown exact counts cannot be marked complete', api.includes('result.count !== null')],
  ['safety-cap truncation is reflected in coverage', api.includes('truncated: result.truncated')],
  ['overall data quality requires every dataset reconciled', api.includes('Object.values(metricCoverage).every((item) => item.complete)')],
  ['API returns metricCoverage alongside dataQuality', api.includes('metricCoverage,')],
  ['dashboard renders source reconciliation table', ui.includes('KPI source reconciliation') && ui.includes('Database rows') && ui.includes('Loaded rows')],
  ['partial sources are visibly marked', ui.includes("'Partial / check'")],
  ['tenant scope and role gate remain in analytics API', api.includes('requireGrowthRole') && api.includes(".eq('organization_id', organizationId)")],
  ['feature entitlement gate remains enforced', api.includes("requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')")],
  ['focused verifier is part of verify:all', pkg.scripts['verify:all'].includes('verify:growth-command-center-reconciliation-v61800')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} KPI reconciliation checks passed`);
process.exitCode = failed ? 1 : 0;
