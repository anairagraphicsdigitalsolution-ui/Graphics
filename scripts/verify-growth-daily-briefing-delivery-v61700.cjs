const fs = require('node:fs');
const route = fs.readFileSync('app/api/growth/autonomous-schedules/route.ts','utf8');
const worker = fs.readFileSync('app/api/growth/worker/route.ts','utf8');
const ui = fs.readFileSync('components/growth-autonomous-schedules.tsx','utf8');
const migration = fs.readFileSync('supabase/migrations/20261116070655_growth_daily_briefing_delivery_v61700.sql','utf8');
const jobMigration = fs.readFileSync('supabase/migrations/20261116070936_growth_daily_briefing_delivery_v61700b.sql','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const checks = [
 ['daily briefing schedule requires a valid recipient email',route.includes("type==='daily_briefing_delivery'") && route.includes('recipientEmail')],
 ['schedule creation requires a configured Resend sender',route.includes("getWorkspaceIntegration(c.db,orgId,'resend')") && route.includes('verified sender email')],
 ['worker queries tenant-scoped daily lead, pipeline, task, meeting, proposal and failed-job metrics',worker.includes("schedule.schedule_type==='daily_briefing_delivery'") && worker.includes("eq('organization_id',schedule.organization_id)") && worker.includes('newLeads24h') && worker.includes('overdueTasks') && worker.includes('proposalsAwaiting.count')],
 ['scheduler runs before job claiming so a newly queued briefing can deliver in the same worker cycle',worker.indexOf('runAutonomousSchedules(db)')<worker.indexOf("db.rpc('claim_growth_jobs'")],
 ['scheduled briefing is queued with a date-scoped idempotency key',worker.includes('daily-briefing:${schedule.id}:${dateKey}') && worker.includes("job_type:'send_briefing_email'")],
 ['briefing email dispatch uses configured Resend credentials and provider idempotency',worker.includes('async function sendBriefingEmail') && worker.includes("'Idempotency-Key':`anaira-growth-briefing-${job.id}`")],
 ['provider dispatch is guarded against blind retries',worker.includes("'send_briefing_email'") && worker.includes('externalDispatchStarted=true') && worker.includes('OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED')],
 ['delivery result is written to schedule run history',worker.includes("delivery:{status:'accepted',provider:'resend'") && worker.includes('schedule_run_id')],
 ['schedule manager exposes daily briefing email configuration and 24-hour cadence',ui.includes('Daily business briefing email') && ui.includes('type="email"') && ui.includes('recipientEmail') && (ui.includes('Delivery cadence: every 24 hours') || ui.includes('Runs every 24 hours after the first worker execution.'))],
 ['owner can edit recipient and manage pause/resume/run-now/delete',ui.includes('Edit recipient') && ui.includes('update(s,{enabled:!s.enabled})') && ui.includes('update(s,{runNow:true})') && ui.includes('remove(s)')],
 ['API rejects non-daily intervals for daily briefing schedules',route.includes("['daily_briefing_delivery','command_alert_scan'].includes(type)&&hours!==24") && route.includes('Daily briefing and command alert scans must repeat every 24 hours.')],
 ['schedule execution history displays delivery state and provider message id',ui.includes('Briefing delivery:') && ui.includes('providerMessageId')],
 ['database allows daily_briefing_delivery schedule type',migration.includes("'daily_briefing_delivery'") && migration.includes('growth_autonomous_schedule_briefing_due_idx')],
 ['database worker allow-list accepts send_briefing_email jobs',jobMigration.includes('growth_jobs_job_type_check') && jobMigration.includes("'send_briefing_email'")],
 ['focused verifier is part of full verification suite',pkg.scripts['verify:all'].includes('verify:growth-daily-briefing-delivery-v61700')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} daily briefing delivery checks passed`);process.exitCode=failed?1:0;
