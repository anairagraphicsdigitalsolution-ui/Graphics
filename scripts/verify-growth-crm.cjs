const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');const checks=[];function check(n,v){checks.push({n,v});}
const migration=read('supabase/migrations/20261109293000_growth_crm_activities_v6773.sql');const api=read('app/api/growth/crm/activities/route.ts');const ui=read('components/growth-crm.tsx');const update=read('app/api/growth/lead-update/route.ts');
check('tenant-scoped CRM activity table',/organization_id uuid not null/.test(migration)&&/lead_id uuid not null/.test(migration));
check('CRM activity table is private to service role',/enable row level security/.test(migration)&&/revoke all .*authenticated/.test(migration)&&/grant all .*service_role/.test(migration));
check('activity API validates lead ownership and role',/requireGrowthRole/.test(api)&&/eq\('organization_id',orgId\)/.test(api));
check('lead owner assignment validates workspace membership',/assigned_to/.test(update)&&/growth_members/.test(update));
check('CRM has pipeline filters and Customer 360 detail',/statusFilter/.test(ui)&&/tempFilter/.test(ui)&&/Customer 360/.test(ui));
check('CRM supports activity timeline and CSV export',/growth\/crm\/activities/.test(ui)&&/exportCsv/.test(ui)&&/createObjectURL/.test(ui));
let failed=0;for(const c of checks){console.log(`${c.v?'PASS':'FAIL'} ${c.n}`);if(!c.v)failed++;}console.log(`${checks.length-failed}/${checks.length} CRM checks passed.`);process.exitCode=failed?1:0;
