'use strict';
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const api=read('app/api/growth/control-center/route.ts');
const ui=read('components/growth-operations-control-center.tsx');
const dashboard=read('components/growth-dashboard.tsx');
const page=read('app/admin/ai-growth/page.tsx');
const nav=read('components/growth-primary-nav.tsx');
const css=read('app/growth-premium.css');
const checks=[
 ['Control Center API authenticates the bearer session',api.includes('growthContext(req)')],
 ['Control Center API requires an active workspace owner or manager',api.includes("['owner', 'manager']")],
 ['Control Center requires a selected workspace',api.includes("if (!organizationId) return apiJson({ error: 'Workspace is required.' }, 400)")],
 ['Lead KPI is scoped to the last 30 days and tenant',api.includes("count('growth_leads', q => q.gte('created_at', start))")],
 ['Conversation and human-handoff KPIs are separate',api.includes("count('growth_conversations')")&&api.includes("q.eq('needs_human', true)")],
 ['Content approval queue is included',api.includes("count('growth_content', q => q.eq('status', 'pending_approval'))")],
 ['Campaign approval queue is included',api.includes("count('growth_campaigns', q => q.eq('status', 'pending_approval'))")],
 ['Ads optimization approvals are included',api.includes("growth_campaign_optimization_actions")&&api.includes("q.eq('status', 'pending_approval')")],
 ['Overdue tasks exclude completed/cancelled states via open status scope',api.includes("q.in('status', ['open', 'in_progress']).lt('due_at'")],
 ['Failed jobs and exception details are included',api.includes("count('growth_jobs', q => q.eq('status', 'failed'))")&&api.includes('last_error')],
 ['Social account health fields are selected without credentials',api.includes('token_health,token_expires_at,last_error,last_synced_at')&&!api.includes('encrypted_credentials')],
 ['Open social comment queue is included',api.includes("count('growth_social_comments', q => q.eq('status', 'open'))")],
 ['AI usage estimate and token units are aggregated from usage logs',api.includes("rows('growth_usage_logs'")&&api.includes('estimated_cost')&&api.includes('input_units')&&api.includes('output_units')],
 ['AI usage row cap is surfaced as incomplete data quality',api.includes('usageCapped')&&api.includes("'usage_capped'")],
 ['Governance audit trail is tenant-filtered',api.includes("rows('growth_platform_audit_events'")&&api.includes(".eq('organization_id', organizationId)")],
 ['Data-source errors are reported rather than silently certified',api.includes('unavailableSources')&&api.includes('dataQuality')],
 ['Control Center UI fetches authenticated no-store data',ui.includes('Authorization: `Bearer ${session.access_token}`')&&ui.includes("cache: 'no-store'")],
 ['Control Center UI displays KPI tiles for CRM, inbox, social, approvals and costs',ui.includes('New Leads')&&ui.includes('Conversations')&&ui.includes('Social Accounts')&&ui.includes('Pending Approvals')&&ui.includes('AI Cost Estimate')],
 ['Control Center UI exposes human approval/action queue links',ui.includes('Human approval & action queue')&&ui.includes('item.href')],
 ['Control Center UI exposes connected social account health',ui.includes('Connected social accounts')&&ui.includes('token_health')],
 ['Control Center UI exposes open social comments',ui.includes('Latest inbox comments')&&ui.includes('recentComments')],
 ['Control Center UI exposes failed automation jobs',ui.includes('Automation exceptions')&&ui.includes('recentJobs')],
 ['Control Center UI exposes governance audit trail',ui.includes('Recent governance audit trail')&&ui.includes('data.audit')],
 ['Dashboard mounts Module 7 Control Center panel',dashboard.includes("activeTab==='control_center'&&<GrowthOperationsControlCenter")],
 ['Main AI Growth landing page opens the Complete Control Center',page.includes('initialTab="control_center"')],
 ['Primary navigation exposes the Control Center route',nav.includes("id:'control-center',label:'AI Command Center',href:'/admin/ai-growth'")],
 ['Control Center is restricted from non-manager workspace navigation',nav.includes("!['control-center','schedules','integrations','team','billing'].includes(item.id)")],
 ['Control Center navigation active state does not highlight every nested page',nav.includes("href==='/admin/ai-growth'?pathname===href")],
 ['Control Center responsive styles cover tablet and mobile layouts',css.includes('.growth-ops-grid')&&css.includes('@media(max-width:760px)')],
 ['AI cost is labelled as estimate without assuming a currency',ui.includes('AI Cost Estimate · 30 days')&&ui.includes('currency per provider')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;
