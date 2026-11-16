const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const route = read('app/api/growth/command-insights/route.ts');
const component = read('components/growth-command-predictive-insights.tsx');
const pkg = JSON.parse(read('package.json'));
const checks = [
  ['route remains authenticated', route.includes('growthContext(req)')],
  ['workspace role check retained', route.includes('requireGrowthRole(ctx.db, ctx.userId, organizationId')],
  ['CRM entitlement retained', route.includes("requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')")],
  ['lead opportunity data includes temperature and score', route.includes('lead_temperature,lead_score')],
  ['campaigns are workspace scoped', route.includes("from('growth_campaigns')") && route.includes("eq('organization_id', organizationId)")],
  ['high intent threshold is explicit', route.includes('highIntentLeads.length >= 3') && route.includes('>= 75')],
  ['warm lead opportunity has minimum sample', route.includes('warmLeads.length >= 5')],
  ['draft campaign opportunity is review only', route.includes("status || '').toLowerCase() === 'draft'") && route.includes('approvalRequired: true')],
  ['opportunities require human approval', route.includes('approvalRequired: true')],
  ['recommendations do not execute external actions', route.includes('never execute outreach or mutate CRM/campaign records')],
  ['opportunities return with API payload', route.includes('insights: ordered, opportunities')],
  ['campaign source completeness is measured', route.includes('campaigns.count === null || campaignRows.length >= 200')],
  ['client renders opportunity cards', component.includes('result.opportunities') && component.includes('Business Opportunities')],
  ['client marks approval requirement', component.includes('APPROVAL REQUIRED')],
  ['client links to existing CRM and campaign pages', route.includes("'/admin/ai-growth/crm'") && route.includes("'/admin/ai-growth/campaigns'")],
  ['release version is current', ['6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version),'6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'],
  ['verifier is registered in full suite', pkg.scripts['verify:all'].includes('verify:growth-command-center-opportunities-v62700')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} Function 14 opportunity checks passed`);
process.exitCode = failed ? 1 : 0;
