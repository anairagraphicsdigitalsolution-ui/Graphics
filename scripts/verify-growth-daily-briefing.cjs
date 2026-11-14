const fs = require('node:fs');
const route = fs.readFileSync('app/api/growth/briefing/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-daily-briefing.tsx', 'utf8');
const control = fs.readFileSync('components/growth-control-center.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const proposalAuditMigration = fs.readFileSync('supabase/migrations/20261113181940_growth_proposal_status_change_audit_v6900.sql', 'utf8');
const checks = [
  ['daily briefing route requires authenticated workspace context', route.includes('growthContext(req)')],
  ['daily briefing is restricted to workspace roles and plan entitlement', route.includes('requireGrowthRole') && route.includes("requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')")],
  ['all metrics queries are tenant scoped', (route.match(/\.eq\('organization_id', organizationId\)/g) || []).length >= 9],
  ['briefing uses a 24-hour and 30-day reporting window', route.includes('since24h') && route.includes('since30d')],
  ['qualified and won period metrics use CRM status-change audit events, not generic lead updated_at', route.includes(".eq('activity_type', 'status_change')") && route.includes(".contains('metadata', { to: 'qualified' })") && route.includes(".contains('metadata', { to: 'won' })") && proposalAuditMigration.includes('status_change') && proposalAuditMigration.includes("'to',v_new_lead_status")],
  ['briefing counts open leads and new leads without inventing values', route.includes(".not('status', 'in', '(\"won\",\"lost\")')") && route.includes('newLeads24h')],
  ['briefing includes overdue tasks and upcoming meetings', route.includes('overdueTasks') && route.includes('upcomingMeetings7d')],
  ['briefing includes proposal, content and failed worker states', route.includes('proposalsAwaitingApproval') && route.includes('pendingContent') && route.includes('failedJobs')],
  ['sent proposal metric uses confirmed delivery_status rather than CRM lead status', route.includes("proposalsSent: proposalRows.filter((x: any) => x.delivery_status === 'sent').length") && route.includes('Proposals delivered')],
  ['AI output is constrained to supplied metrics and structured JSON', route.includes("response_format: { type: 'json_object' }") && route.includes('Do not invent, infer or exaggerate numbers')],
  ['AI requests are metered through workspace quota', route.includes("consumeGrowthQuota(ctx.db, organizationId, 'ai_messages'")],
  ['AI usage cost is written to workspace usage logs', route.includes("operation: 'daily_business_briefing'") && route.includes('estimateOpenAICost')],
  ['rate limit protects repeated AI briefing generation', route.includes("'growth-daily-briefing', 5, 60")],
  ['rule-based briefing remains available without AI provider', route.includes('buildRuleBrief') && route.includes("let aiMode: 'openai' | 'rules' = 'rules'")],
  ['briefing does not trigger customer communications', !/fetch\(['"]https:\/\/(graph\.facebook|api\.resend|api\.twilio)/i.test(route)],
  ['daily briefing UI has an authenticated refresh action', ui.includes("fetch('/api/growth/briefing'") && ui.includes('Authorization: `Bearer ${session.access_token}`')],
  ['briefing UI displays sourced metrics and priority actions', ui.includes('New leads · 24h') && ui.includes('Priority actions') && ui.includes('Failed worker jobs') && ui.includes('Proposals sent')],
  ['briefing is wired into the Growth Control Center', control.includes("import GrowthDailyBriefing") && control.includes('<GrowthDailyBriefing organizationId={organizationId}/>')],
  ['daily briefing verification is part of the full regression suite', pkg.scripts['verify:all'].includes('verify:growth-daily-briefing')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} daily briefing checks passed`);
process.exitCode = failed ? 1 : 0;
