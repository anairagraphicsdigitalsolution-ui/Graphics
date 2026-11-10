const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261109160539_growth_job_stale_lock_recovery_v6756.sql'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'app/api/growth/worker/route.ts'), 'utf8');
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
check('stale processing jobs older than 10 minutes are detected', migration.includes("locked_at < now() - interval '10 minutes'"));
check('jobs below max attempts are requeued', migration.includes("status = 'queued'") && migration.includes('attempts < max_attempts'));
check('recovered jobs use bounded exponential backoff', migration.includes('power(2, attempts)') && migration.includes('least(60'));
check('jobs at max attempts are marked failed', migration.includes("status = 'failed'") && migration.includes('attempts >= max_attempts'));
check('claim remains atomic with SKIP LOCKED', migration.includes('for update skip locked'));
check('claim function remains service-role only', migration.includes('grant execute on function public.claim_growth_jobs(integer) to service_role'));
check('worker still calls the atomic claim RPC', worker.includes("db.rpc('claim_growth_jobs'"));
process.exitCode = failed ? 1 : 0;
