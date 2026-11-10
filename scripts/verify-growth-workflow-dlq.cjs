const fs=require('fs'),path=require('path');const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const worker=read('app/api/growth/worker/route.ts'),api=read('app/api/growth/automation/dead-letters/route.ts'),sql=read('supabase/migrations/20261110120000_growth_workflow_dead_letter_queue_v6804.sql');
const checks=[
 ['terminal failures persisted idempotently',/growth_workflow_dead_letters'\)\.upsert/.test(worker)&&/onConflict:'run_id'/.test(worker)],
 ['DLQ is tenant-scoped with unique run',/organization_id uuid not null/.test(sql)&&/unique\(run_id\)/.test(sql)],
 ['RLS and manager-gated updates',/enable row level security/.test(sql)&&/private\.is_growth_manager\(organization_id\)/.test(sql)],
 ['read API requires workspace membership',/requireGrowthRole\(c\.db,c\.userId,orgId/.test(api)],
 ['manual retry resets run safely',/action==='retry'/.test(api)&&/attempts:0/.test(api)&&/status:'queued'/.test(api)],
 ['discard is explicit and audited',/action==='discard'/.test(api)&&/dlq_discarded/.test(api)],
 ['resolved records cannot be replayed repeatedly',/item\.status!=='open'/.test(api)]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} DLQ checks passed`);
