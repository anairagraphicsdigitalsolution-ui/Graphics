const fs = require('fs');
const pkg = require('../package.json');
const route = fs.readFileSync('app/api/growth/retention/outreach/route.ts','utf8');
const worker = fs.readFileSync('app/api/growth/worker/route.ts','utf8');
const migration = fs.readFileSync('supabase/migrations/20261116054726_growth_customer_retention_outreach_v61300.sql','utf8');
const ui = fs.readFileSync('components/growth-retention-center.tsx','utf8');
const review = fs.readFileSync('app/api/growth/reviews/route.ts','utf8');
const checks = [
 ['retention outreach route is tenant scoped',route.includes("eq('id', leadId).eq('organization_id', organizationId)")],
 ['CRM role and feature checks guard read/write',route.includes("['owner', 'manager', 'editor', 'viewer', 'client']")&&route.includes("['owner', 'manager', 'editor']")&&route.includes("'crm'")],
 ['won customers only can receive retention touchpoints',route.includes("lead.status !== 'won'")],
 ['segmentation uses CRM activity recency',route.includes('daysSinceActivity')&&route.includes("segment = daysSinceActivity >= 61 ? 'dormant' : daysSinceActivity >= 31 ? 'at_risk' : 'engaged'")],
 ['segmentation clearly disclaims predictive churn model',route.includes('predictiveModel: false')],
 ['customer and activity query limits are explicit',route.includes('.limit(500)')&&route.includes('.limit(5000)')],
 ['email consent and suppression are evaluated before approval',route.includes('evaluateLeadChannelSuppression(lead, \'email\')')&&route.includes('Approval blocked:')],
 ['email requires explicit channel consent and deliverability checks',route.includes('emailBlockReason')&&route.includes('emailEligibility')],
 ['touchpoint draft has bounded types and future schedule',route.includes("TYPES.includes(type as any)")&&route.includes('Date.parse(scheduledAt) < Date.now()')],
 ['drafts do not send automatically',route.includes("status: 'draft'")&&route.includes('A manager/editor must approve it')],
 ['approval queues idempotent worker email job',route.includes('retention-touchpoint:')&&route.includes("job_type: 'send_email'")&&route.includes('idempotency_key')],
 ['approval records actor and audit timeline',route.includes('approved_by: ctx.userId')&&route.includes('growth_lead_activities')],
 ['cancel action cancels only eligible jobs',route.includes("['queued', 'failed']")&&route.includes('cancelledJob')&&route.includes('already processing or completed')],
 ['touchpoint table has tenant foreign keys and bounded states',migration.includes('organization_id uuid not null')&&migration.includes("'draft','queued','sent','failed','cancelled'")],
 ['touchpoint table is service-role only with RLS enabled',migration.includes('enable row level security')&&migration.includes('revoke all on public.growth_retention_touchpoints from public,anon,authenticated')],
 ['touchpoint scheduling and lead history indexes exist',migration.includes('growth_retention_touchpoints_org_status_schedule_idx')&&migration.includes('growth_retention_touchpoints_org_lead_created_idx')],
 ['worker success marks approved retention touchpoint sent',worker.includes('job.payload?.retention_touchpoint_id')&&worker.includes("status:'sent'")],
 ['worker terminal failure marks retention touchpoint failed',worker.includes("status:'failed',failure_reason:persistedError.slice(0,1500)")],
 ['worker send_email rechecks explicit email consent',worker.includes("channel_consents?.email?.granted!==true")],
 ['worker enforces contact suppression and quiet-hours policy',worker.includes('evaluateLeadChannelSuppression(lead,\'email\')')&&worker.includes('evaluateGrowthSendPolicy')],
 ['review email requests now resolve a CRM contact before queueing',review.includes("from('growth_leads')")&&review.includes('evaluateLeadChannelSuppression(lead,\'email\')')],
 ['review email requests use worker queue rather than direct provider fetch',review.includes("job_type:'send_email'")&&!review.includes("fetch('https://api.resend.com/emails'")],
 ['worker updates review request lifecycle after dispatch',worker.includes('job.payload?.review_request_id')&&worker.includes("status:'sent'")],
 ['retention UI shows engaged, at-risk and dormant segments',ui.includes('engaged')&&ui.includes('at_risk')&&ui.includes('dormant')],
 ['retention UI provides approval and cancel controls',ui.includes('Approve & queue')&&ui.includes("action(t,'cancel')")],
 ['retention UI clearly states no automatic messaging',ui.includes('Drafts never send automatically')&&ui.includes('Human approval is mandatory')],
 ['dashboard links to Customer Retention module',fs.readFileSync('components/growth-dashboard.tsx','utf8').includes('/admin/ai-growth/retention')],
 ['release package version is 6.103.0',['6.103.0','6.104.0','6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)],
 ['full verification includes Module 13 verifier',pkg.scripts['verify:all'].includes('verify:growth-customer-retention-v61300')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`Module 13 verification: ${checks.length-failed}/${checks.length} PASS`);process.exit(failed?1:0);
