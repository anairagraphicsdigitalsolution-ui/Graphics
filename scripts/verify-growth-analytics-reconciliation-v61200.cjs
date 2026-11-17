const fs = require('fs');
const route = fs.readFileSync('app/api/growth/analytics/reconciliation/route.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261116051934_growth_analytics_financial_reconciliation_v61200.sql', 'utf8');
const lockdown = fs.readFileSync('supabase/migrations/20261116052344_growth_analytics_financial_ledger_lockdown_v61200a.sql', 'utf8');
const adsSync = fs.readFileSync('app/api/growth/ads-insights/route.ts', 'utf8');
const component = fs.readFileSync('components/growth-financial-reconciliation.tsx', 'utf8');
const shell = fs.readFileSync('components/growth-control-center.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = [
 ['Financial ledger supports spend, revenue and refund entries', /entry_type text not null check \(entry_type in \('spend','revenue','refund'\)\)/.test(migration)],
 ['Ledger retains explicit ISO currency per financial record', /currency char\(3\).*currency ~ '\^\[A-Z\]\{3\}\$'/.test(migration)],
 ['Ledger is tenant-scoped and references CRM leads safely', /organization_id uuid not null references public\.growth_organizations/.test(migration) && /lead_id uuid references public\.growth_leads/.test(migration)],
 ['Ledger prevents duplicate external source references', /growth_marketing_financial_external_ref_uidx/.test(migration)],
 ['Ledger has manager-only RLS policy', /private\.is_growth_manager\(organization_id\)/.test(migration) && /for all to authenticated/.test(migration)],
 ['Financial ledger blocks direct authenticated mutation', /revoke insert, update, delete on public\.growth_marketing_financial_entries from authenticated/i.test(lockdown) && /growth_marketing_financial_manager_read/.test(lockdown)],
 ['GET enforces workspace role and CRM entitlement', /requireGrowthRole/.test(route) && /requireGrowthFeature/.test(route)],
 ['Analytics defaults to a 30-day period and validates real calendar dates', /effectiveFrom = from \|\| new Date\(Date\.now\(\) - 30 \* 86400000\)/.test(route) && /toISOString\(\)\.slice\(0, 10\) === s/.test(route)],
 ['GET applies organization scope and date filters', /eq\('organization_id', org\)/.test(route) && /entry_date/.test(route)],
 ['Analytics reports capped lead, ledger and attribution datasets', /truncatedSources/.test(route) && /leadCount/.test(route) && /attributionCount/.test(route)],
 ['Totals separate currency buckets', /totalsByCurrency/.test(route) && /currencies/.test(route)],
 ['Refunds are subtracted from gross revenue', /revenue - refunds/.test(route) && /entry_type === 'refund'/.test(route)],
 ['Analytics compares financial ledger revenue with attribution events', /growth_attribution_events/.test(route) && /reconciliationVarianceByCurrency/.test(route) && /attributedRevenue/.test(route)],
 ['Campaign attribution variance is calculated without mixing currencies', /campaignCurrencies/.test(route) && /revenueVariance: money\(netRevenue - attributedRevenue\)/.test(route)],
 ['ROAS is only calculated when actual spend exists', /spend > 0 \? Number\(\(netRevenue \/ spend\)/.test(route)],
 ['CPL and CAC are campaign scoped and require actual spend', /cpl: campaignLeads\.length && spend > 0/.test(route) && /cac: campaignWon && spend > 0/.test(route)],
 ['POST restricts financial writes to owners and managers', /\['owner','manager'\]/.test(route)],
 ['POST validates positive amounts and ISO currency', /amount <= 0/.test(route) && /\^\[A-Z\]\{3\}\$/.test(route)],
 ['Meta Ads sync fetches ad account currency before recording spend', /fields', 'currency,name'/.test(adsSync) && /financialLedgerSynced/.test(adsSync)],
 ['Meta Ads daily spend uses idempotent campaign-date references', /meta:\$\{adAccountId\}:/.test(adsSync) && /external_ref/.test(adsSync) && /existingByRef/.test(adsSync)],
 ['POST verifies linked lead belongs to same organization', /eq\('id', leadId\)\.eq\('organization_id', org\)/.test(route)],
 ['Duplicate provider references return conflict', /error\?\.code === '23505'/.test(route) && /409/.test(route)],
 ['UI displays actual spend, net revenue, refunds and ROAS', /Actual spend/.test(component) && /Net revenue/.test(component) && /refunds/.test(component) && /ROAS/.test(component)],
 ['UI supports recording all financial entry types', /value="spend"/.test(component) && /value="revenue"/.test(component) && /value="refund"/.test(component)],
 ['UI displays attribution variance separately from actual ledger revenue', /Revenue attribution reconciliation/.test(component) && /reconciliationVarianceByCurrency/.test(component)],
 ['UI displays campaign CPL and CAC without FX mixing', /CPL/.test(component) && /CAC/.test(component) && /perCurrency/.test(component)],
 ['Module 12 reconciliation panel is mounted in Analytics', /GrowthFinancialReconciliation/.test(shell) && /panel==='analytics'/.test(shell)],
 ['Package version and full verification include Module 12', ['6.102.0','6.103.0','6.104.0','6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version) && pkg.scripts['verify:all'].includes('verify:growth-analytics-reconciliation-v61200')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`RESULT ${checks.length - failed}/${checks.length} passed`);
process.exitCode = failed ? 1 : 0;
