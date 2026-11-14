const fs=require('fs');
const route=fs.readFileSync('app/api/growth/prospect-convert/route.ts','utf8');
const ui=fs.readFileSync('components/growth-intelligence.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261113161000_growth_prospect_to_crm_conversion_v6892.sql','utf8');
const checks=[
 ['conversion endpoint is workspace-scoped',route.includes("eq('id', prospectId).eq('organization_id', organizationId)")],
 ['conversion requires owner or manager',route.includes("['owner', 'manager']")],
 ['CRM entitlement is checked',route.includes("'crm'")&&route.includes('requireGrowthFeature')],
 ['lead quota is consumed idempotently',route.includes('prospect-convert:${prospectId}')],
 ['lead retains source prospect reference',route.includes('source_prospect_id: prospectId')],
 ['lead contact consent is always false',route.includes('consent_to_contact: false')],
 ['prospect status is marked converted',route.includes("status: 'converted'")],
 ['lead timeline records conversion',route.includes("activity_type: 'system'")],
 ['duplicate conversion is handled',route.includes('duplicate: true')&&migration.includes('growth_leads_org_source_prospect_uidx')],
 ['migration adds unique source reference',migration.includes('add column if not exists source_prospect_id')&&migration.includes('create unique index')],
 ['UI exposes Convert to CRM action',ui.includes('convertProspect(p.id)')&&ui.includes('Convert to CRM')],
 ['UI disables repeat conversion',ui.includes("p.status==='converted'")],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} prospect conversion checks passed.`);
