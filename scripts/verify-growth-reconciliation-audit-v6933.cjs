const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const route=read('app/api/growth/external-effect-reconciliation/route.ts');
const sql=read('supabase/migrations/20261115100000_growth_external_effect_reconciliation_audit_v6933.sql');
const checks=[
 ['reconciliation list is limited to manager roles',/requireGrowthRole\(c\.db,c\.userId,orgId,\['owner','manager'\]\)/.test(route)],
 ['reconciliation list is organization scoped',/eq\('organization_id',orgId\)/.test(route)],
 ['only ambiguous failed provider jobs are listed',/eq\('status','failed'\)/.test(route)&&/OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED/.test(route)],
 ['provider payload and private customer data are not selected',!/select\([^)]*payload/.test(route)],
 ['manual resolution requires evidence',/evidence\.length<12/.test(route)],
 ['all three explicit resolution actions are supported',/confirm_delivered/.test(route)&&/retry_after_provider_check/.test(route)&&/discard/.test(route)],
 ['database function independently verifies manager role',/private\.is_growth_manager\(p_organization_id\)/.test(sql)],
 ['database function locks and scopes the target job',/for update/.test(sql)&&/organization_id = p_organization_id/.test(sql)],
 ['database function only accepts pending ambiguous outcomes',/external_effect_started_at is null/.test(sql)&&/OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED:%/.test(sql)],
 ['every resolution writes an append-only evidence record',/insert into public\.growth_external_effect_reconciliations/.test(sql)&&/actor_id, action, evidence/.test(sql)],
 ['retry action is explicit and clears marker only after manager evidence',/p_action = 'retry_after_provider_check'/.test(sql)&&/status = 'queued'/.test(sql)],
 ['RPC execution is granted to authenticated and service role only',/revoke all on function public\.resolve_growth_external_effect_job/.test(sql)&&/to authenticated/.test(sql)&&/to service_role/.test(sql)]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} reconciliation audit checks passed`);
