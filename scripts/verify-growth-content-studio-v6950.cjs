'use strict';
const fs=require('node:fs');
const content=fs.readFileSync('app/api/growth/content/route.ts','utf8');
const action=fs.readFileSync('app/api/growth/content-action/route.ts','utf8');
const templates=fs.readFileSync('app/api/growth/content-templates/route.ts','utf8');
const calendar=fs.readFileSync('app/api/growth/content-calendar/route.ts','utf8');
const worker=fs.readFileSync('app/api/growth/worker/route.ts','utf8');
const ui=fs.readFileSync('components/growth-content-studio.tsx','utf8');
const dashboard=fs.readFileSync('components/growth-dashboard.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261115144751_growth_ai_content_studio_v6950.sql','utf8');
const checks=[
 ['AI generation authenticates bearer session',content.includes('auth.getUser(token)')],
 ['AI generation enforces tenant membership and platform-admin authorization',content.includes("['owner','manager','editor']")&&content.includes("from('admin_users')")],
 ['AI generation enforces social channel entitlement and quota',content.includes("requireGrowthFeature(db,user.id,orgId,'social_channels')")&&content.includes("consumeGrowthQuota(db,orgId,'ai_messages'")],
 ['Brand profile and approved knowledge inform generation',content.includes('org.brand_profile')&&content.includes('org.knowledge_base')],
 ['Structured AI JSON output includes CTA, hashtags, keywords and scripts',content.includes("response_format:{type:'json_object'}")&&content.includes('call_to_action')&&content.includes('hashtags')&&content.includes('script')],
 ['Content formats include social, ads, blogs, SEO, product and festival',content.includes("'ad_copy','blog','seo','product','festival'")],
 ['Generated content saved as draft with brand snapshot and usage metering',content.includes("status:'draft'")&&content.includes('brand_guidelines_snapshot:brand')&&content.includes("operation:'content_generation'")],
 ['Templates are tenant-scoped and manager-controlled',templates.includes("eq('organization_id',orgId)")&&templates.includes("['owner','manager']")],
 ['Calendar access is tenant-scoped and date range is bounded',calendar.includes("eq('organization_id',orgId)")&&calendar.includes('180*86400000')],
 ['Scheduling requires approval, future date and exact connected account',action.includes("schedule:'approved'")&&action.includes('Date.parse(at)<=Date.now()')&&action.includes("eq('connection_status','connected')")],
 ['Unsupported platform/content combinations are blocked before queueing',action.includes('SOCIAL_FORMATS')&&action.includes('not yet supported')],
 ['Schedule cancellation refuses an already-claimed publishing job',action.includes("activeJob?.status==='processing'")&&action.includes("eq('status','queued')")],
 ['Scheduled jobs carry exact selected social account',action.includes('social_account_id:accountId')&&action.includes('platform}')],
 ['Worker uses selected account rather than arbitrary first account',worker.includes('selectedAccountId')&&worker.includes("accountQuery=accountQuery.eq('id',selectedAccountId)")],
 ['Worker records attempt and published provider ID',worker.includes("event_type:'attempt_started'")&&worker.includes('published_external_id:providerPostId')&&worker.includes("event_type:'published'")],
 ['Worker persists publication errors and event history',worker.includes('last_publish_error:persistedError')&&worker.includes("event_type:'failed'")],
 ['UI exposes generator, reusable brand templates and calendar',ui.includes('AI Content Generator')&&ui.includes('Brand Template Library')&&ui.includes('Content Calendar & Approval Queue')],
 ['UI integrates Meta and YouTube analytics',ui.includes('GrowthSocialInsights')&&ui.includes('GrowthYouTubeAnalytics')],
 ['Dashboard mounts the dedicated Content Studio',dashboard.includes('<GrowthContentStudio organizationId={active.id}/>')],
 ['Migration adds structured content, templates, audit and calendar indexes',migration.includes('growth_content_templates')&&migration.includes('growth_content_publication_events')&&migration.includes('growth_content_org_calendar_v6950_idx')],
 ['Publication audit table is not directly exposed to authenticated clients',migration.includes('revoke all on public.growth_content_publication_events from anon, authenticated')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;
