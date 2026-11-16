const fs=require('fs');
const api=fs.readFileSync('app/api/growth/intelligence/route.ts','utf8');
const ui=fs.readFileSync('components/growth-intelligence.tsx','utf8');
const playbooks=fs.readFileSync('lib/growth-industry-playbooks.ts','utf8');
const checks=[
 ['industry playbooks cover all requested verticals', ['hospitality','restaurant','healthcare','retail','real_estate','education','travel','professional_services','manufacturing','agency','other'].every(k=>playbooks.includes(`  ${k}:`))],
 ['playbooks define customer journeys and measurable KPIs', playbooks.includes('customerJourney')&&playbooks.includes('primaryKpis')],
 ['playbooks include evidence-based qualification signals', playbooks.includes('qualificationSignals')],
 ['industry is selected in the Growth Intelligence UI', ui.includes('aria-label="Business industry"')],
 ['workspace industry is loaded from the tenant record', ui.includes("select('id,name,industry')")&&ui.includes('setBusinessIndustry')],
 ['industry is submitted with strategy generation', ui.includes("action:'strategy',objective,industry:businessIndustry")],
 ['API validates industry against the allowlisted playbooks', api.includes('hasOwnProperty.call(GROWTH_INDUSTRY_PLAYBOOKS,industry)')],
 ['API persists industry to the tenant workspace', api.includes("update({industry,updated_at:new Date().toISOString()})")],
 ['AI prompt includes the industry-specific journey and KPIs', api.includes('Industry playbook:')&&api.includes('customer_journey')&&api.includes('primary_kpis')],
 ['AI is instructed not to invent benchmarks', playbooks.includes('not fabricated market benchmarks')&&api.includes('Do not invent industry benchmarks')],
 ['existing strategy remains a draft and campaigns are not launched', api.includes("status:'draft'")&&api.includes('Do not claim campaigns are launched')],
 ['strategy remains protected by owner/manager authorization', api.includes('requireGrowthRole')&&api.includes("['owner','manager']")],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} industry-playbook checks passed`);process.exit(failed?1:0);
