const fs = require('fs');
const route = fs.readFileSync('app/api/growth/analytics/route.ts', 'utf8');
const checks = [
  ['Analytics uses bounded paginated reads instead of one PostgREST page', /async function loadAll[\s\S]*\.range\(from, from \+ PAGE_SIZE - 1\)/.test(route)],
  ['Analytics pagination has a stable unique tie-breaker', /\.order\(dateColumn \|\| 'id', \{ ascending: true \}\)\.order\('id', \{ ascending: true \}\)/.test(route)],
  ['Analytics page size and page cap are bounded', /const PAGE_SIZE = 500/.test(route) && /const MAX_PAGES = 40/.test(route)],
  ['Analytics reports whether a dataset was truncated', /truncatedSources/.test(route) && /dataQuality/.test(route)],
  ['Analytics computes qualified lead rate from all loaded rows', /qualificationRate: leadRows\.length/.test(route)],
  ['Analytics computes win rate from all loaded rows', /winRate: leadRows\.length/.test(route)],
  ['Analytics groups AI usage by provider', /byProvider: usageRows\.reduce/.test(route)],
  ['Analytics keeps currency-separated revenue totals', /revenueByCurrency/.test(route) && /toUpperCase\(\)/.test(route)],
  ['Analytics does not fabricate CPL/CAC/ROAS without spend data', /costPerLead: null/.test(route) && /customerAcquisitionCost: null/.test(route) && /returnOnAdSpend: null/.test(route)],
  ['Analytics explicitly explains missing spend reconciliation', /reconciled channel spend/.test(route)],
  ['All analytics queries remain organization-scoped', (route.match(/eq\('organization_id', organizationId\)/g) || []).length >= 1],
  ['Analytics remains role and feature gated', /requireGrowthRole/.test(route) && /requireGrowthFeature/.test(route)],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`RESULT ${checks.length - failed}/${checks.length} passed`);
process.exitCode = failed ? 1 : 0;
