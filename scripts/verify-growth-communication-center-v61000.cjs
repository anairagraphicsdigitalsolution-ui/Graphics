const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const worker=read('app/api/growth/worker/route.ts');
const sms=read('app/api/growth/sms/route.ts');
const webhook=read('app/api/growth/sms/webhook/route.ts');
const inbox=read('app/api/growth/inbox/reply/route.ts');
const inboxUi=read('components/growth-inbox.tsx');
const communicationUi=read('components/growth-communication-center.tsx');
const emailTemplates=read('app/api/growth/email/templates/route.ts');
const emailTools=read('components/growth-email-center-tools.tsx');
const automation=read('app/api/growth/automation/route.ts');
const workflowUi=read('components/growth-control-center.tsx');
const nav=read('components/growth-primary-nav.tsx');
const migration=read('supabase/migrations/20261116045747_growth_communication_center_v61000.sql');
const emailMigration=read('supabase/migrations/20261116045828_growth_email_templates_v61000b.sql');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['SMS composer requires workspace owner/manager',/requireGrowthRole\(ctx\.db, ctx\.userId, org, \['owner', 'manager'\]\)/.test(sms)],
 ['SMS send checks explicit channel consent and suppression',/evaluateLeadChannelSuppression\(lead, 'sms'\)/.test(sms)],
 ['SMS send obeys workspace quiet-hours and channel policy',/evaluateGrowthSendPolicy\(orgRow\.communication_policy, 'sms'\)/.test(sms)],
 ['SMS destination and sender require E.164 format',sms.includes(String.raw`/^\+[1-9]\d{7,14}$/`) && (sms.match(/E\.164/g)||[]).length>=2],
 ['SMS dispatch is queued with idempotent request identity',/client_request_id: requestId/.test(sms)&&/job_type: 'send_sms'/.test(sms)],
 ['SMS provider dispatch uses Twilio credentials server-side',/api\.twilio\.com\/2010-04-01/.test(worker)&&/auth_token/.test(worker)],
 ['SMS worker rechecks consent before provider dispatch',/channel_consents\?\.sms\?\.granted!==true/.test(worker)],
 ['SMS worker registers callback URL and provider SID',/StatusCallback/.test(worker)&&/provider_message_sid/.test(worker)],
 ['SMS is protected by external-effect outcome guard',/externalEffectTypes=\[[^;]*'send_sms'/.test(worker)&&/OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED/.test(worker)],
 ['Twilio callback verifies signed request',/x-twilio-signature/.test(webhook)&&/createHmac\('sha1'/.test(webhook)&&/timingSafeEqual/.test(webhook)],
 ['Twilio callback is idempotent',/growth_sms_provider_events/.test(webhook)&&/23505/.test(webhook)],
 ['Twilio status callbacks map using the configured sender number',/statusCallback \? String\(params.get\('From'\)/.test(webhook)],
 ['Early provider callbacks are reconciled after SMS SID persistence',/earlyEvents/.test(worker)&&/queuedForReconciliation/.test(webhook)],
 ['Inbound SMS enters tenant-scoped unified inbox',/channel', 'sms'/.test(webhook)&&/growth_conversations/.test(webhook)],
 ['Inbound STOP keyword revokes SMS consent',/twilio_sms_keyword_optout/.test(webhook)&&/p_granted: false/.test(webhook)],
 ['Human inbox can reply to SMS conversations',/channel==='sms'/.test(inbox)&&/twilio\.com/.test(inbox)],
 ['Unified inbox exposes SMS filter',/option value="sms"/.test(inboxUi)],
 ['Communication Center exposes SMS composer and delivery history',/SMS Composer/.test(communicationUi)&&/Recent SMS Delivery/.test(communicationUi)],
 ['Email template API is tenant scoped and role gated',/requireGrowthRole/.test(emailTemplates)&&/growth_email_templates/.test(emailTemplates)],
 ['Email template manager and provider delivery events are visible',/GrowthEmailTemplateManager/.test(communicationUi)&&/GrowthEmailDeliveryEvents/.test(communicationUi)&&/Copy template/.test(emailTools)],
 ['Workflow builder supports SMS automation steps',/send_sms/.test(automation)&&/send_sms/.test(workflowUi)],
 ['Workflow SMS step reuses idempotent dispatch record',/workflow:\$\{run\.id\}:\$\{index\}/.test(worker)&&/growth_sms_messages/.test(worker)],
 ['Navigation exposes Communication Center',/Communication Center/.test(nav)&&/\/admin\/ai-growth\/communications/.test(nav)],
 ['Migration enables RLS and service-role-only SMS event data',/enable row level security/.test(migration)&&/revoke all on public\.growth_sms_provider_events from public,anon,authenticated/.test(migration)],
 ['Migration adds request idempotency and delivery indexes',/growth_sms_messages_request_idempotency_idx/.test(migration)&&/growth_sms_messages_org_status_idx/.test(migration)],
 ['Email template migration enables RLS and tenant role policies',/enable row level security/.test(emailMigration)&&/growth_email_templates_editor_insert/.test(emailMigration)&&/growth_email_templates_editor_update/.test(emailMigration)],
 ['Package version and full verification script include Module 10',['6.100.0','6.101.0','6.102.0','6.103.0','6.104.0','6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)&&pkg.scripts['verify:all'].includes('verify:growth-communication-center-v61000')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} Module 10 checks passed.`);process.exit(failed?1:0);
