// Static regression guards for worker routing and outbound WhatsApp policy.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'app/api/growth/worker/route.ts'), 'utf8');
const automation = fs.readFileSync(path.join(root, 'app/api/growth/automation/route.ts'), 'utf8');
const templateSend = fs.readFileSync(path.join(root, 'app/api/growth/whatsapp/templates/send/route.ts'), 'utf8');
const templateApi = fs.readFileSync(path.join(root, 'app/api/growth/whatsapp/templates/route.ts'), 'utf8');
const adsAdvisor = fs.readFileSync(path.join(root, 'app/api/growth/ads-optimization/route.ts'), 'utf8');
const youtubeStatus = fs.readFileSync(path.join(root, 'app/api/growth/youtube-status/route.ts'), 'utf8');
const unifiedAnalytics = fs.readFileSync(path.join(root, 'components/growth-unified-analytics.tsx'), 'utf8');
const youtubeAnalytics = fs.readFileSync(path.join(root, 'app/api/growth/youtube-analytics/route.ts'), 'utf8');
const youtubeAnalyticsUi = fs.readFileSync(path.join(root, 'components/growth-youtube-analytics.tsx'), 'utf8');
const socialConnect = fs.readFileSync(path.join(root, 'app/api/growth/social-connect/route.ts'), 'utf8');
const checks = [
  ['workflow condition steps are accepted by API validation', "allowed=new Set(['create_follow_up','notify_admin','queue_whatsapp','queue_whatsapp_template','send_email','wait','condition'])"],
  ['workflow conditions restrict fields to lead temperature, status and source', "allowedFields.includes(field)"],
  ['workflow conditions restrict comparison operators', "allowedOperators.includes(operator)"],
  ['workflow condition false branch skips configured steps', "index+1+(matched?0:Number(step.skip_steps||1))"],
  ['workflow condition reads tenant-scoped lead fields', "lead_temperature,status,source"],
  ['workflow builder exposes condition step', '<option value="condition">If / else condition (lead fields)</option>'],
  ['workflow WhatsApp steps enqueue a worker-supported job', "job_type:step.type==='queue_whatsapp'?'send_whatsapp':'send_email'"],
  ['WhatsApp worker checks active consent', 'lead.consent_to_contact'],
  ['WhatsApp worker blocks opted-out leads', 'lead.contact_opted_out_at'],
  ['WhatsApp worker requires a linked customer conversation', 'no recent customer-initiated conversation is recorded'],
  ['WhatsApp worker enforces the 24-hour service window', 'the 24-hour customer-service window is closed'],
  ['email worker checks active consent', 'Email send blocked: active consent is required'],
  ['approved WhatsApp template worker is routed', "job.job_type==='send_whatsapp_template'"],
  ['template worker rejects non-approved templates', "template.approval_status!=='approved'"],
  ['template worker blocks opt-outs', 'WhatsApp template blocked: active consent and no opt-out are required.'],
  ['workflow template step requires an approved template', 'Selected WhatsApp template is not approved.'],
  ['template send API requires manager approval role', 'Only owner or manager can queue approved WhatsApp templates.'],
  ['template registry enforces tenant scoping', ".eq('organization_id',org)"],
  ['template approval requires external provider confirmation', 'Confirm that this exact template is approved'],
  ['template API rejects non-simple categories', "!['UTILITY','MARKETING'].includes(category)"],
  ['Ads advisor uses only synced organization snapshots', ".eq('organization_id',org).eq('source_status','synced')"],
  ['Ads advisor never changes campaign budget or status', 'No campaign, bid, budget or ad status is changed automatically.'],
  ['Ads advisor flags low CTR', 'LOW_CTR'],
  ['Ads advisor flags spend without clicks', 'SPEND_NO_CLICKS'],
  ['Ads advisor compares campaign history', 'priorRows.map'],
  ['YouTube status route is organization-scoped', ".eq('id',accountId).eq('organization_id',organizationId)"],
  ['YouTube status route requires connected YouTube channel', "account.platform!=='youtube'||account.connection_status!=='connected'"],
  ['YouTube status route refreshes expired OAuth token', "grant_type:'refresh_token'"],
  ['YouTube status route requests processing details', "processingDetails,statistics"],
  ['YouTube status route reports provider processing failure', 'failureReason'],
  ['YouTube resumable session URL is encrypted at rest', 'encryptSecret({url:uploadUrl})'],
  ['YouTube resumable session is tenant and content scoped', ".eq('organization_id',job.organization_id).eq('content_id',item.id)"],
  ['YouTube upload probes remote acknowledged range before resuming', 'bytes */${total}'],
  ['YouTube upload sends bounded byte ranges', 'Content-Range'],
  ['YouTube worker persists byte offset after each chunk', 'uploaded_bytes:offset'],
  ['YouTube worker requeues partial upload without consuming retry attempts', "attempts:0,last_error:null"],
  ['YouTube worker records provider video ID for idempotent completion', 'provider_video_id:uploaded.id'],
  ['LinkedIn image upload uses initializeUpload', '/rest/images?action=initializeUpload'],
  ['LinkedIn image upload validates MIME type', "!['image/jpeg','image/png','image/gif'].includes(mime)"],
  ['LinkedIn image upload enforces 10 MB limit', '10*1024*1024'],
  ['LinkedIn image post attaches uploaded image URN', 'postBody.content=mediaContent'],
  ['LinkedIn carousel is not silently truncated', 'media.length>20'],
  ['LinkedIn carousel enforces 2–20 image requirement', "item.content_type==='carousel'&&(media.length<2||media.length>20)"],
  ['LinkedIn multi-image post uses official multiImage schema', 'multiImage:{images:uploadedImages}'],
  ['LinkedIn multi-image assets are individually registered', 'for(let index=0;index<media.length;index++)'],
  ['Unified analytics loads social and ads snapshots', 'social-insights?organizationId='],
  ['Unified analytics keeps metric definitions and currencies separate', 'not blended across different definitions or currencies'],
  ['Unified analytics selects latest snapshot per account', 'const seen=new Set<string>()'],
  ['Unified analytics reports ads provider units without currency inference', 'currency not stored'],
  ['YouTube Analytics route is organization-scoped', ".eq('id', accountId).eq('organization_id', organizationId)"],
  ['YouTube Analytics requires analytics OAuth scope', "https://www.googleapis.com/auth/yt-analytics.readonly"],
  ['YouTube Analytics refreshes expired Google credentials', "grant_type: 'refresh_token'"],
  ['YouTube Analytics requests channel report metrics', 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained,subscribersLost'],
  ['YouTube Analytics limits reporting periods', '[7, 28, 90].includes(days)'],
  ['YouTube Analytics UI is integrated in Growth Control Center', 'GrowthYouTubeAnalytics organizationId={organizationId} accounts={accounts}']
];
let failed = 0;
for (const [label, marker] of checks) {
  const source = label.includes('workflow condition steps are accepted') || label.includes('workflow conditions restrict') ? automation : label.includes('workflow condition false') || label.includes('workflow condition reads') ? worker : label.includes('workflow builder exposes') ? fs.readFileSync(path.join(root, 'components/growth-control-center.tsx'), 'utf8') : label.includes('YouTube Analytics route') || label.includes('YouTube Analytics refreshes') || label.includes('YouTube Analytics requests') || label.includes('YouTube Analytics limits') ? youtubeAnalytics : label.includes('YouTube Analytics requires') ? socialConnect : label.includes('YouTube Analytics UI') ? fs.readFileSync(path.join(root, 'components/growth-control-center.tsx'), 'utf8') : label.includes('Unified analytics') ? unifiedAnalytics : label.includes('LinkedIn carousel') || label.includes('LinkedIn multi-image') ? worker : label.includes('YouTube status') ? youtubeStatus : label.includes('YouTube resumable') ? worker : label.includes('YouTube upload') ? worker : label.includes('YouTube worker') ? worker : label.includes('Ads advisor') ? adsAdvisor : label.includes('template send API') ? templateSend : label.includes('template registry') || label.includes('template approval') || label.includes('template API') ? templateApi : worker;
  const ok = source.includes(marker);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
process.exitCode = failed ? 1 : 0;

const automationRouteSource = fs.readFileSync(path.join(root, 'app/api/growth/automation/route.ts'), 'utf8');
const automationLibSource = fs.readFileSync(path.join(root, 'lib/growth-automation.ts'), 'utf8');
const leadUpdateRouteSource = fs.readFileSync(path.join(root, 'app/api/growth/lead-update/route.ts'), 'utf8');
const extraChecks = [
  ['workflow API allows lead status-change trigger', automationRouteSource.includes("'lead_status_changed'")],
  ['workflow API allows lead temperature-change trigger', automationRouteSource.includes("'lead_temperature_changed'")],
  ['status-change workflows enqueue only on actual transitions', automationLibSource.includes('previous.status !== lead.status') && automationLibSource.includes("trigger: 'lead_status_changed'")],
  ['temperature-change workflows enqueue only on actual transitions', automationLibSource.includes('previous.lead_temperature !== lead.lead_temperature') && automationLibSource.includes("trigger: 'lead_temperature_changed'")],
  ['lead update route reads previous tenant-scoped values', leadUpdateRouteSource.includes(".eq('id', leadId).eq('organization_id', orgId).maybeSingle()")],
  ['lead update route invokes transition workflow runner', leadUpdateRouteSource.includes('runLeadUpdatedRules(ctx.db, orgId')]
];
for (const [label, ok] of extraChecks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
process.exitCode = failed ? 1 : 0;

const growthUiSource = fs.readFileSync(path.join(root, 'components/growth-control-center.tsx'), 'utf8');
const uiTriggerChecks = [
  ['Growth Control Center exposes lead-created trigger', growthUiSource.includes('value="lead_created"')],
  ['Growth Control Center exposes lead-status-changed trigger', growthUiSource.includes('value="lead_status_changed"')],
  ['Growth Control Center exposes lead-temperature-changed trigger', growthUiSource.includes('value="lead_temperature_changed"')],
  ['workflow form submits the selected trigger instead of hardcoding lead-created', growthUiSource.includes('trigger_type:ruleTrigger')]
];
for (const [label, ok] of uiTriggerChecks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
process.exitCode = failed ? 1 : 0;
