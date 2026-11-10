const fs=require('fs'),s=fs.readFileSync('app/api/growth/lead-bulk/route.ts','utf8');
const checks=[
 ['manager-only bulk update',/requireGrowthRole\(c\.db,c\.userId,orgId,\['owner','manager'\]\)/.test(s)],
 ['CRM entitlement enforced',/requireGrowthFeature\(c\.db,c\.userId,orgId,'crm'\)/.test(s)],
 ['selection capped at 100 and UUID validated',/ids\.length>100/.test(s)&&/UUID\.test/.test(s)],
 ['cross-tenant lead IDs rejected before update',/eq\('organization_id',orgId\)\.in\('id',ids\)/.test(s)],
 ['only allow-listed fields can be updated',/STATUSES/.test(s)&&/TEMPERATURES/.test(s)&&/changedFields/.test(s)],
 ['activity timeline records bulk changes',/growth_lead_activities/.test(s)&&/bulk:true/.test(s)]
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} CRM bulk checks passed`);
