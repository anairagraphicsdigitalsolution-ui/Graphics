const fs=require('fs');
const route=fs.readFileSync('app/api/growth/prospect-qualification/route.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20261113154500_growth_prospect_evidence_qualification_v6891.sql','utf8');
const checks=[
 ['qualification is workspace-scoped',route.includes("eq('organization_id', orgId)")],
 ['only owner and manager can qualify',route.includes("['owner', 'manager']")],
 ['fit and intent are scored separately',route.includes('fit_score')&&route.includes('intent_score')],
 ['AI is instructed not to infer intent from contact details',route.includes('Never infer buying intent from contact details')],
 ['missing facts are kept unknown',route.includes('Missing facts must be unknown')],
 ['evidence has source and confidence',route.includes('claim,source,confidence')],
 ['qualification states are allow-listed',route.includes("['qualified', 'nurture', 'disqualified', 'needs_review']")],
 ['consent is not changed by qualification',!(/consent_to_contact\s*:/).test(route)],
 ['scores are bounded',route.includes('Math.max(0, Math.min(100')],
 ['database stores evidence and intent independently',migration.includes('qualification_evidence jsonb')&&migration.includes('intent_score integer')],
 ['tenant qualification index exists',migration.includes('growth_prospects_org_qualification_idx')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} prospect qualification checks passed.`);
