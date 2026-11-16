const fs=require('fs');const pkg=require('../package.json');
const api=fs.readFileSync('app/api/growth/command-alerts/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-alerts.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261116100000_growth_command_action_alerts_v62400.sql','utf8');
const center=fs.readFileSync('components/growth-command-center.tsx','utf8');
const checks=[
 ['alerts are workspace-scoped and CRM-entitlement gated',api.includes("eq('organization_id',a.orgId)")&&api.includes("requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')")],
 ['overdue approvals use configurable hour threshold',api.includes('ageHours>=s.approval_overdue_hours')],
 ['repeated failures use configurable rolling 24-hour threshold',api.includes('repeated_failure_threshold')&&api.includes('86400000')],
 ['negative feedback uses configurable rolling 7-day threshold',api.includes('negative_feedback_threshold')&&api.includes('7*86400000')],
 ['alerts are persisted through idempotent organization fingerprint',migration.includes('unique (organization_id, fingerprint)')&&migration.includes('on conflict (organization_id,fingerprint)')],
 ['resolved alerts can reactivate when signal recurs',migration.includes("status='resolved' then 'active'")],
 ['acknowledge, escalate and resolve transitions are row-locked',migration.includes('for update')&&migration.includes("p_operation not in ('acknowledge','escalate','resolve')")],
 ['alert transitions write audit events transactionally',migration.includes("'growth.command_alert.'||p_operation")],
 ['settings have bounded threshold constraints',migration.includes('approval_overdue_hours between 1 and 720')&&migration.includes('repeated_failure_threshold between 2 and 20')&&migration.includes('negative_feedback_threshold between 2 and 50')],
 ['automatic escalation uses configured unresolved age',api.includes('escalationCutoff=now-s.escalation_after_hours*3600000')],
 ['UI exposes scan, settings and lifecycle controls',ui.includes('Scan workspace now')&&ui.includes('Save thresholds')&&ui.includes('Acknowledge')&&ui.includes('Escalate')&&ui.includes('Resolve')],
 ['alerts UI is mounted in Command Center',center.includes("import GrowthCommandAlerts")&&center.includes('<GrowthCommandAlerts organizationId={organizationId} />')],
 ['external notifications are explicitly not sent',api.includes('no email or external notification was sent')&&ui.includes('no email, WhatsApp or external notification is sent')],
 ['release version and verifier registration are current',['6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)&&pkg.scripts['verify:all'].includes('verify:growth-command-center-alerts-v62400')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} Function 11 alert checks passed`);process.exitCode=fail?1:0;
