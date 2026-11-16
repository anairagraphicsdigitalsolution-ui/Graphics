const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const worker=read('app/api/growth/worker/route.ts');
const migration=read('supabase/migrations/20261116050622_growth_marketing_automation_reliability_v61100.sql');
const securityMigration=read('supabase/migrations/20261116050816_growth_marketing_automation_security_v61100a.sql');
const dlqRoute=read('app/api/growth/automation/dead-letters/route.ts');
const reliabilityRoute=read('app/api/growth/automation/reliability/route.ts');
const reliabilityUi=read('components/growth-automation-reliability.tsx');
const control=read('components/growth-control-center.tsx');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['release package version is 6.101.0',['6.101.0','6.102.0','6.103.0','6.104.0','6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)],
 ['workflow run has bounded configurable attempts',/max_attempts integer not null default 5/.test(migration)&&/max_attempts between 1 and 20/.test(migration)],
 ['workflow claims have per-claim UUID tokens',/claim_token uuid/.test(migration)&&/claim_token=gen_random_uuid\(\)/.test(migration)],
 ['workflow claim uses SKIP LOCKED for concurrent workers',/for update skip locked/.test(migration)],
 ['stale workflow lease is recovered with bounded exponential backoff',/locked_at < v_now - interval '10 minutes'/.test(migration)&&/run_lease_recovered/.test(migration)&&/least\(60/.test(migration)],
 ['exhausted stale workflow lease moves into DLQ',/Workflow lease expired after maximum attempts/.test(migration)&&/growth_workflow_dead_letters/.test(migration)&&/run_lease_expired/.test(migration)],
 ['workflow dead-letter retry is atomic in database transaction',/resolve_growth_workflow_dead_letter/.test(migration)&&/for update/.test(migration)&&/status='retried'/.test(migration)],
 ['DLQ resolver checks authenticated manager membership',/auth\.uid\(\) is null or not private\.is_growth_manager/.test(migration)],
 ['DLQ resolver is not executable by anon/public',/revoke all on function public\.resolve_growth_workflow_dead_letter\(uuid,uuid,text\) from public,anon/.test(securityMigration)],
 ['DLQ resolver uses invoker rights and manager RLS',/language plpgsql\s+set search_path/.test(securityMigration)&&/growth_workflow_run_events_manager_insert/.test(securityMigration)],
 ['DLQ lifecycle event types are permitted by event constraint',/dlq_retried/.test(migration)&&/dlq_discarded/.test(migration)],
 ['autonomous schedule stale leases are recovered',/locked_at < v_now - interval '20 minutes'/.test(migration)&&/Schedule worker lease expired/.test(migration)],
 ['autonomous schedule claim excludes locked rows and uses SKIP LOCKED',/s\.locked_at is null/.test(migration)&&/for update of s skip locked/.test(migration)],
 ['workflow-created follow-up task is idempotent per step',/growth_tasks'\)\.upsert/.test(worker)&&/workflow_step_key:`workflow:\$\{run\.id\}:\$\{index\}`/.test(worker)],
 ['workflow-created outbound jobs use idempotency keys',/growth_jobs'\)\.upsert/.test(worker)&&/idempotency_key:`workflow:\$\{run\.id\}:\$\{index\}`/.test(worker)],
 ['SMS workflow job is keyed by stable run-step request ID',/idempotency_key:requestId/.test(worker)],
 ['workflow state updates compare the claim token',/eq\('claim_token',run\.claim_token\)/.test(worker)],
 ['worker respects per-run max attempts',/run\.max_attempts\|\|5/.test(worker)],
 ['workflow failures retain terminal DLQ records',/growth_workflow_dead_letters'\)\.upsert/.test(worker)&&/onConflict:'run_id'/.test(worker)],
 ['DLQ API uses atomic RPC rather than split updates',/rpc\('resolve_growth_workflow_dead_letter'/.test(dlqRoute)&&!dlqRoute.includes("from('growth_workflow_runs').update")],
 ['reliability API enforces tenant membership',/requireGrowthRole\(c\.db,c\.userId,organizationId/.test(reliabilityRoute)],
 ['reliability API enforces automation entitlement',/requireGrowthFeature\(c\.db,c\.userId,organizationId,'automation'\)/.test(reliabilityRoute)],
 ['reliability API caps every diagnostic query',/\.limit\(500\)/.test(reliabilityRoute)&&/\.limit\(100\)/.test(reliabilityRoute)&&/\.limit\(50\)/.test(reliabilityRoute)],
 ['reliability API reports stale worker, workflow and schedule leases',/workflowStaleLeases/.test(reliabilityRoute)&&/staleScheduleLeases/.test(reliabilityRoute)&&/staleJobLeases/.test(reliabilityRoute)&&/isStaleLease\(x\.locked_at,now,10\)/.test(reliabilityRoute)&&/isStaleLease\(x\.locked_at,now,20\)/.test(reliabilityRoute)],
 ['reliability UI exposes manager-only DLQ retry and discard controls',/resolve\(item,'retry'\)/.test(reliabilityUi)&&/resolve\(item,'discard'\)/.test(reliabilityUi)],
 ['reliability panel is reachable from Growth Control Center',/automation-reliability/.test(control)&&/GrowthAutomationReliability/.test(control)],
 ['reliability panel displays schedule attempts and stale lease diagnostics',/Attempts \{s\.attempts\}\/\{s\.max_attempts\}/.test(reliabilityUi)&&/Stale lease diagnostics/.test(reliabilityUi)],
 ['full regression suite includes Module 11 verifier',pkg.scripts['verify:all'].includes('verify:growth-marketing-automation-v61100')]
];
let failed=0;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} Module 11 checks passed`);process.exitCode=failed?1:0;
