import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
import { consumeGrowthQuota } from '@/lib/growth-quota';
import { enforceGrowthRateLimit } from '@/lib/growth-rate-limit';
import { estimateOpenAICost } from '@/lib/growth-cost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BriefItem = { title: string; detail: string; metric?: string };
const safeItems = (value: unknown, max = 4): BriefItem[] => Array.isArray(value)
  ? value.slice(0, max).map((item: any) => ({
      title: String(item?.title || '').slice(0, 120),
      detail: String(item?.detail || '').slice(0, 360),
      ...(item?.metric ? { metric: String(item.metric).slice(0, 80) } : {}),
    })).filter(item => item.title && item.detail)
  : [];

function buildRuleBrief(metrics: Record<string, number>, sampledAt: string) {
  const priorities: BriefItem[] = [];
  const wins: BriefItem[] = [];
  if (metrics.overdueTasks > 0) priorities.push({ title: 'Clear overdue follow-ups', detail: 'Review the overdue internal CRM tasks and reassign or complete them. No customer message has been sent by this briefing.', metric: `${metrics.overdueTasks} overdue` });
  if (metrics.proposalsAwaitingApproval > 0) priorities.push({ title: 'Review proposal approvals', detail: 'Commercial proposals are waiting for an owner or manager decision before customer delivery.', metric: `${metrics.proposalsAwaitingApproval} awaiting approval` });
  if (metrics.failedJobs > 0) priorities.push({ title: 'Investigate failed automation jobs', detail: 'Open the worker logs, check provider configuration and retry only after the underlying issue is understood.', metric: `${metrics.failedJobs} failed jobs` });
  if (metrics.newLeads24h > 0) priorities.push({ title: 'Review new leads', detail: 'Check fit, assign an owner and verify channel-specific consent before initiating any outreach.', metric: `${metrics.newLeads24h} new in 24h` });
  if (metrics.upcomingMeetings7d > 0) wins.push({ title: 'Upcoming sales conversations', detail: 'Meetings are already on the workspace calendar. Confirm owners, agenda and preparation.', metric: `${metrics.upcomingMeetings7d} in next 7 days` });
  if (metrics.wonLeads30d > 0) wins.push({ title: 'Deals won in the last 30 days', detail: 'Use the Customer Retention planner to schedule renewal, feedback and relationship check-ins.', metric: `${metrics.wonLeads30d} won` });
  if (metrics.qualifiedLeads30d > 0) wins.push({ title: 'Qualified pipeline activity', detail: 'Qualified leads are present. Keep qualification evidence and the next action current in CRM.', metric: `${metrics.qualifiedLeads30d} qualified` });
  if (metrics.proposalsSent > 0) wins.push({ title: 'Proposals delivered', detail: 'Customer proposals have been marked as sent by the delivery worker. Review replies and record the next sales action in CRM.', metric: `${metrics.proposalsSent} sent` });
  if (!priorities.length) priorities.push({ title: 'Keep the pipeline current', detail: 'No urgent overdue tasks, failed jobs or pending proposal approvals were found in the available workspace records.', metric: 'No urgent blockers found' });
  return {
    summary: `${metrics.newLeads24h} new leads arrived in the last 24 hours. ${metrics.openLeads} leads remain open in the pipeline; ${metrics.overdueTasks} tasks are overdue and ${metrics.upcomingMeetings7d} meetings are scheduled in the next 7 days.`,
    priorities,
    wins,
    watchouts: metrics.failedJobs ? [`${metrics.failedJobs} failed worker jobs need review.`] : [],
    sampledAt,
  };
}

/**
 * Workspace-scoped, evidence-only briefing. If OpenAI is unavailable or quota is
 * exhausted, return the deterministic facts and priorities rather than fabricating AI output.
 */
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = String((await req.json().catch(() => ({})))?.organizationId || '').trim();
  if (!organizationId) return apiJson({ error: 'Workspace is required.' }, 400);
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')) return apiJson({ error: 'CRM analytics are not included in this workspace plan.' }, 402);

  try {
    const rate = await enforceGrowthRateLimit(ctx.db, req, 'growth-daily-briefing', 5, 60);
    if (!rate.allowed) return apiJson({ error: 'Briefing refresh limit reached. Please wait before trying again.', retryAfter: rate.retryAfter }, 429);

    const now = new Date();
    const sampledAt = now.toISOString();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [totalLeads, openLeads, newLeads, qualifiedEvents, wonEvents, dueTasks, meetings, proposals, content, jobs] = await Promise.all([
      ctx.db.from('growth_leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      ctx.db.from('growth_leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).not('status', 'in', '("won","lost")'),
      ctx.db.from('growth_leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', since24h),
      ctx.db.from('growth_lead_activities').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('activity_type', 'status_change').gte('created_at', since30d).contains('metadata', { to: 'qualified' }),
      ctx.db.from('growth_lead_activities').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('activity_type', 'status_change').gte('created_at', since30d).contains('metadata', { to: 'won' }),
      ctx.db.from('growth_tasks').select('id,title,status,due_at,task_type').eq('organization_id', organizationId).lte('due_at', sampledAt).neq('status', 'done').order('due_at', { ascending: true }).limit(500),
      ctx.db.from('growth_meetings').select('id,title,status,starts_at').eq('organization_id', organizationId).eq('status', 'scheduled').gte('starts_at', sampledAt).lte('starts_at', next7d).order('starts_at', { ascending: true }).limit(100),
      ctx.db.from('growth_proposals').select('id,status,delivery_status,total_amount,currency').eq('organization_id', organizationId).limit(500),
      ctx.db.from('growth_content').select('id,status,created_at').eq('organization_id', organizationId).gte('created_at', since30d).limit(500),
      ctx.db.from('growth_jobs').select('id,status,job_type,created_at').eq('organization_id', organizationId).in('status', ['failed', 'queued', 'processing']).gte('created_at', since24h).limit(500),
    ]);

    const queryErrors = [totalLeads, openLeads, newLeads, qualifiedEvents, wonEvents, dueTasks, meetings, proposals, content, jobs].filter(x => x.error);
    if (queryErrors.length) {
      console.error('[growth-briefing] Metrics query failed', queryErrors.map(x => x.error?.message));
      return apiJson({ error: 'Daily briefing metrics could not be loaded. Check the workspace database schema and permissions.' }, 500);
    }

    const proposalRows = proposals.data || [];
    const contentRows = content.data || [];
    const jobRows = jobs.data || [];
    const taskRows = dueTasks.data || [];
    const metrics: Record<string, number> = {
      totalLeads: totalLeads.count || 0,
      openLeads: openLeads.count || 0,
      newLeads24h: newLeads.count || 0,
      qualifiedLeads30d: qualifiedEvents.count || 0,
      wonLeads30d: wonEvents.count || 0,
      overdueTasks: taskRows.filter((x: any) => x.due_at && Date.parse(x.due_at) < now.getTime() && !['done', 'cancelled'].includes(String(x.status))).length,
      dueTasks: taskRows.filter((x: any) => x.due_at && Date.parse(x.due_at) <= now.getTime() && !['done', 'cancelled'].includes(String(x.status))).length,
      upcomingMeetings7d: meetings.data?.length || 0,
      proposalsAwaitingApproval: proposalRows.filter((x: any) => x.status === 'pending_approval').length,
      proposalsQueued: proposalRows.filter((x: any) => x.delivery_status === 'queued').length,
      proposalsSent: proposalRows.filter((x: any) => x.delivery_status === 'sent').length,
      pendingContent: contentRows.filter((x: any) => ['draft', 'pending_approval', 'pending_review'].includes(String(x.status))).length,
      failedJobs: jobRows.filter((x: any) => x.status === 'failed').length,
      queuedJobs: jobRows.filter((x: any) => ['queued', 'processing'].includes(String(x.status))).length,
    };

    const deterministic = buildRuleBrief(metrics, sampledAt);
    let briefing: any = deterministic;
    let aiMode: 'openai' | 'rules' = 'rules';
    let aiNotice = 'Rule-based briefing shown. Connect OpenAI in this workspace to generate an AI-written analysis.';
    const integration = await getWorkspaceIntegration(ctx.db, organizationId, 'openai');
    const apiKey = String(integration.credentials.api_key || process.env.OPENAI_API_KEY || '').trim();
    const model = String(integration.settings.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini').trim();

    if (apiKey) {
      const dateKey = `daily-briefing:${organizationId}:${now.toISOString().slice(0, 10)}`;
      const quota = await consumeGrowthQuota(ctx.db, organizationId, 'ai_messages', 1, dateKey, { operation: 'daily_business_briefing' });
      if (!quota.allowed) {
        aiNotice = quota.reason === 'quota_exceeded' ? 'AI quota reached. Rule-based metrics are shown instead.' : 'AI usage metering is unavailable. Rule-based metrics are shown instead.';
      } else {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            body: JSON.stringify({
              model, temperature: 0.2, max_tokens: 650, response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: 'You are a careful business operations analyst. Analyze only the supplied workspace metrics. Do not invent, infer or exaggerate numbers, revenue, ad spend, customer intent or provider delivery. Return JSON with keys summary (string), priorities (array of {title,detail,metric}), wins (array of {title,detail,metric}), watchouts (array of strings). Limit priorities to 4, wins to 3 and watchouts to 3. Use concise, actionable language. Respect that no outbound communication may occur without valid consent and approved channel policies.' },
                { role: 'user', content: JSON.stringify({ metrics, deterministicInsights: deterministic, sampledAt, currencyNote: 'No revenue or ad-spend figures were provided; do not state revenue or ROAS.' }) },
              ],
            }),
          });
          const result: any = await response.json().catch(() => ({}));
          if (response.ok) {
            const raw = String(result.choices?.[0]?.message?.content || '');
            const parsed = JSON.parse(raw);
            if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
              briefing = {
                summary: parsed.summary.slice(0, 1200),
                priorities: safeItems(parsed.priorities, 4).length ? safeItems(parsed.priorities, 4) : deterministic.priorities,
                wins: safeItems(parsed.wins, 3),
                watchouts: Array.isArray(parsed.watchouts) ? parsed.watchouts.slice(0, 3).map((x: unknown) => String(x).slice(0, 240)) : [],
                sampledAt,
              };
              aiMode = 'openai';
              aiNotice = `AI analysis generated using ${model}. Metrics are from workspace records sampled at ${sampledAt}.`;
              const usage = result.usage || {};
              await ctx.db.from('growth_usage_logs').insert({ organization_id: organizationId, provider: 'openai', model, operation: 'daily_business_briefing', input_units: usage.prompt_tokens || 0, output_units: usage.completion_tokens || 0, estimated_cost: estimateOpenAICost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0) });
            } else {
              aiNotice = 'AI returned an incomplete analysis. Rule-based metrics are shown instead.';
            }
          } else {
            console.error('[growth-briefing] OpenAI request failed', { status: response.status, message: String(result.error?.message || '').slice(0, 240) });
            aiNotice = 'AI provider request failed. Rule-based metrics are shown instead.';
          }
        } catch (error) {
          console.error('[growth-briefing] AI analysis failed', error instanceof Error ? error.message : 'unknown error');
          aiNotice = 'AI analysis could not be completed. Rule-based metrics are shown instead.';
        }
      }
    }

    return apiJson({ briefing, metrics, aiMode, aiNotice });
  } catch (error) {
    console.error('[growth-briefing] Request failed', error instanceof Error ? error.message : 'unknown error');
    return apiJson({ error: 'Daily business briefing could not be generated.' }, 500);
  }
}
