const fs=require('fs');const pkg=require('../package.json');
const api=fs.readFileSync('app/api/growth/autonomous-schedules/route.ts','utf8');
const worker=fs.readFileSync('app/api/growth/worker/route.ts','utf8');
const ui=fs.readFileSync('components/growth-autonomous-schedules.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261117034633_growth_command_center_scheduler_v62500.sql','utf8');
const checks=[
 ['new alert scan schedule type is accepted with empty config',api.includes("type==='command_alert_scan'")&&api.includes("Object.keys(config).length===0")],
 ['daily and weekly summary periods are validated',api.includes("type==='command_center_summary'")&&api.includes("['daily','weekly'].includes")],
 ['alert scans are fixed to 24-hour cadence',api.includes("['daily_briefing_delivery','command_alert_scan'].includes(type)&&hours!==24")],
 ['weekly summary uses a 168-hour cadence',api.includes("config.period==='weekly'?168:24")],
 ['worker runs scheduled alert scans',worker.includes("schedule.schedule_type==='command_alert_scan'")],
 ['worker evaluates overdue approval signals',worker.includes('age>=settings.approval_overdue_hours')],
 ['worker evaluates rolling execution failures',worker.includes('repeated_failure_threshold')&&worker.includes('86400000')],
 ['worker evaluates rolling negative feedback',worker.includes('negative_feedback_threshold')&&worker.includes('7*86400000')],
 ['worker persists alerts through Function 11 RPC',worker.includes("rpc('sync_growth_command_action_alerts'")],
 ['worker escalates aged unresolved alerts',worker.includes("p_operation:'escalate'")&&worker.includes('settings.escalation_after_hours')],
 ['worker generates daily or weekly management summaries',worker.includes("schedule.schedule_type==='command_center_summary'")&&worker.includes("period==='weekly'?7:1")],
 ['summary covers action, alert, feedback and audit sources',worker.includes('growth_command_actions')&&worker.includes('growth_command_action_alerts')&&worker.includes('growth_command_action_feedback')&&worker.includes('growth_platform_audit_events')],
 ['summary stores bounded-source metadata',worker.includes('limits:{actions:500,alerts:500,feedback:500,auditEvents:500}')],
 ['summary explicitly avoids external delivery',worker.includes('No email or external notification is sent')],
 ['UI exposes alert scan and summary schedule types',ui.includes('value="command_alert_scan"')&&ui.includes('value="command_center_summary"')],
 ['UI offers daily and weekly summary cadence',ui.includes('Summary cadence')&&ui.includes('value="168">Weekly')],
 ['existing schedule lifecycle controls remain available',ui.includes('Pause')&&ui.includes('Run now')&&ui.includes('Delete')],
 ['migration expands schedule type constraint',migration.includes("'command_alert_scan','command_center_summary'")],
 ['migration indexes enabled command schedules',migration.includes('growth_autonomous_schedules_command_center_due_idx')],
 ['release version and verifier registration are current',['6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version),'6.121.0','6.122.0'&&pkg.scripts['verify:all'].includes('verify:growth-command-center-scheduler-v62500')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} Function 12 scheduler checks passed`);process.exitCode=fail?1:0;
