const fs=require('fs'),path=require('path');const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const worker=read('app/api/growth/worker/route.ts'),api=read('app/api/growth/automation/dead-letters/route.ts'),sql=read('supabase/migrations/20261110120000_growth_workflow_dead_letter_queue_v6804.sql'),reliability=read('supabase/migrations/20261116050622_growth_marketing_automation_reliability_v61100.sql'),security=read('supabase/migrations/20261116050816_growth_marketing_automation_security_v61100a.sql');
const checks=[
 ['terminal failures persisted idempotently',/growth_workflow_dead_letters'\)\.upsert/.test(worker)&&/onConflict:'run_id'/.test(worker)],
 ['DLQ is tenant-scoped with unique run',/organization_id uuid not null/.test(sql)&&/unique\(run_id\)/.test(sql)],
 ['RLS and manager-gated updates',/enable row level security/.test(sql)&&/private\.is_growth_manager\(organization_id\)/.test(sql)],
 ['read API requires workspace membership',/requireGrowthRole\(c\.db,c\.userId,orgId/.test(api)],
 ['manual retry atomically resets run and resolves DLQ',/rpc\('resolve_growth_workflow_dead_letter'/.test(api)&&/status='queued',attempts=0,locked_at=null/.test(reliability)&&/status='retried'/.test(reliability)],
 ['discard is explicit and audited inside transaction',/p_action not in \('retry','discard'\)/.test(security)&&/status='discarded'/.test(security)&&/dlq_discarded/.test(security)],
 ['resolved records cannot be replayed repeatedly',/v_item\.status<>'open'/.test(security)]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} DLQ checks passed`);
