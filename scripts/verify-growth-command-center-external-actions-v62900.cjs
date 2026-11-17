'use strict';
const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const sql=fs.readFileSync('supabase/migrations/20261117043000_growth_command_center_external_actions_v62900.sql','utf8');
const worker=fs.readFileSync('app/api/growth/worker/route.ts','utf8');
const checks=[
 ['external action types are explicitly allowlisted',api.includes("['create_task','send_email','send_whatsapp']")&&sql.includes("'create_task','send_email','send_whatsapp'")],
 ['external action proposal requires owner or manager',api.includes("requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager'])")],
 ['lead lookup is tenant scoped',api.includes(".eq('id', leadId).eq('organization_id', orgId)")],
 ['email and WhatsApp feature entitlements are checked',api.includes("channel === 'email' ? 'ai_employee' : 'whatsapp'")],
 ['channel consent and suppression are checked before proposal',api.includes('evaluateLeadChannelSuppression(lead, channel)')],
 ['workspace communication policy is checked',api.includes('evaluateGrowthSendPolicy(orgPolicy?.communication_policy, channel)')],
 ['WhatsApp requires active 24-hour service window',api.includes('Date.now() - inboundAt > 24*60*60*1000')],
 ['email bounce and complaint are blocked',api.includes('lead.email_bounced_at || lead.email_complained_at')],
 ['external actions require separate independent approval',api.includes("action.status !== 'pending_approval'")&&api.includes("action.created_by === ctx.userId")],
 ['external dispatch is queued, not sent from approval endpoint',sql.includes("'queued', now(), 0, 3, v_marker")&&api.includes('external communication queued')],
 ['external queue uses deterministic idempotency key',sql.includes('on conflict (organization_id, job_type, idempotency_key) do nothing')],
 ['database RPC is service-role only',sql.includes('revoke all on function public.execute_growth_command_action')&&sql.includes('to service_role')],
 ['worker rechecks WhatsApp consent and suppression',worker.includes('WhatsApp send blocked: explicit WhatsApp channel consent')&&worker.includes("evaluateLeadChannelSuppression(lead,'whatsapp')")],
 ['worker rechecks email consent and suppression',worker.includes('Email send blocked: explicit email channel consent')&&worker.includes("evaluateLeadChannelSuppression(lead,'email')")],
 ['job state is visible in action history',api.includes("select('id,job_type,status,run_at,completed_at,last_error,created_at')")&&api.includes('external_job:')],
 ['UI offers email and WhatsApp approval actions',ui.includes('Send approved email')&&ui.includes('Send approved WhatsApp message')],
 ['UI discloses queue and consent rechecks',ui.includes('Consent, opt-out, suppression, quiet hours, quota and provider checks run again in the worker')],
 ['release verifier is registered',JSON.parse(fs.readFileSync('package.json','utf8')).scripts['verify:all'].includes('verify:growth-command-center-external-actions-v62900')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS / ${failed} FAIL`);process.exitCode=failed?1:0;
