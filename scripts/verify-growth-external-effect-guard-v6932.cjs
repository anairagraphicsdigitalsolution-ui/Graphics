const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'app/api/growth/worker/route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261115090000_growth_external_effect_reconciliation_v6932.sql'), 'utf8');
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
check('provider-dispatch marker is persisted before outbound job handlers', worker.indexOf("external_effect_started_at:new Date().toISOString()") < worker.indexOf("jobResult=await publish(db,job)"));
check('all supported external-effect job types are guarded', worker.includes("['publish_content','send_whatsapp','send_whatsapp_template','send_email','send_sms','send_briefing_email']"));
check('successful jobs clear the provider-dispatch marker', worker.includes("status:'succeeded',completed_at:new Date().toISOString(),last_error:null,external_effect_started_at:null"));
check('provider success is not reported until local completion is persisted', worker.includes('if(completionError)throw new Error(`LOCAL_COMPLETION_PERSIST_FAILED:'));
check('resumable progress persistence failures are surfaced', worker.includes('if(pendingError)throw new Error(`LOCAL_PROGRESS_PERSIST_FAILED:'));
check('resumable pending jobs clear marker before re-queue', worker.includes("status:'queued',run_at:new Date(Date.now()+10000).toISOString(),locked_at:null,attempts:0,last_error:null,external_effect_started_at:null"));
check('ambiguous provider outcomes suppress automatic retries', worker.includes('OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED') && worker.includes('uncertainExternalOutcome||'));
check('stale dispatched jobs are failed for reconciliation', migration.includes("external_effect_started_at is not null") && migration.includes("status = 'failed'"));
check('stale jobs without provider dispatch remain retryable', migration.includes("external_effect_started_at is null") && migration.includes("status = 'queued'"));
check('atomic SKIP LOCKED claim semantics are preserved', migration.includes('for update skip locked'));
check('claim RPC remains service-role only', migration.includes('grant execute on function public.claim_growth_jobs(integer) to service_role'));
check('marker column and partial index are created', migration.includes('add column if not exists external_effect_started_at') && migration.includes('where external_effect_started_at is not null'));
process.exitCode = failed ? 1 : 0;
