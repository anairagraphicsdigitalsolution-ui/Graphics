import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const since = () => new Date(Date.now() - 30 * 86400000).toISOString();

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = String(req.nextUrl.searchParams.get('organizationId') || '').trim();
  if (!organizationId) return apiJson({ error: 'Workspace is required.' }, 400);
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) {
    return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
  }

  const start = since();
  const db = ctx.db;
  const count = async (table: string, configure?: (query: any) => any) => {
    let query = db.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId);
    if (configure) query = configure(query);
    const { count: total, error } = await query;
    return { total: Number(total || 0), error: error?.message || null };
  };
  const rows = async (table: string, columns: string, configure?: (query: any) => any, limit = 8) => {
    let query = db.from(table).select(columns, { count: 'exact' }).eq('organization_id', organizationId);
    if (configure) query = configure(query);
    const { data, error, count } = await query.limit(limit);
    return { rows: data || [], total: Number(count || 0), error: error?.message || null };
  };

  const [leads, conversations, handoffs, contentPending, contentScheduled, campaignsPending, optimizationPending,
    tasksOpen, tasksOverdue, failedJobs, connectedAccounts, commentsOpen, recentComments, recentJobs,
    usage, audit, recentContent, recentCampaigns] = await Promise.all([
    count('growth_leads', q => q.gte('created_at', start)),
    count('growth_conversations'),
    count('growth_conversations', q => q.eq('needs_human', true)),
    count('growth_content', q => q.eq('status', 'pending_approval')),
    count('growth_content', q => q.eq('status', 'scheduled')),
    count('growth_campaigns', q => q.eq('status', 'pending_approval')),
    count('growth_campaign_optimization_actions', q => q.eq('status', 'pending_approval')),
    count('growth_tasks', q => q.in('status', ['open', 'in_progress'])),
    count('growth_tasks', q => q.in('status', ['open', 'in_progress']).lt('due_at', new Date().toISOString())),
    count('growth_jobs', q => q.eq('status', 'failed')),
    rows('growth_social_accounts', 'id,platform,account_name,connection_status,token_health,token_expires_at,last_error,last_synced_at', q => q.order('created_at', { ascending: false }), 20),
    count('growth_social_comments', q => q.eq('status', 'open')),
    rows('growth_social_comments', 'id,platform,author_name,message,status,provider_created_at,permalink', q => q.eq('status', 'open').order('provider_created_at', { ascending: false }), 6),
    rows('growth_jobs', 'id,job_type,status,run_at,attempts,last_error,created_at', q => q.eq('status', 'failed').order('created_at', { ascending: false }), 6),
    rows('growth_usage_logs', 'provider,model,operation,input_units,output_units,estimated_cost,created_at', q => q.gte('created_at', start).order('created_at', { ascending: false }), 500),
    rows('growth_platform_audit_events', 'id,event_type,metadata,created_at,actor_user_id', q => q.order('created_at', { ascending: false }), 10),
    rows('growth_content', 'id,title,platform,status,updated_at', q => q.in('status', ['pending_approval', 'approved', 'scheduled']).order('updated_at', { ascending: false }), 6),
    rows('growth_campaigns', 'id,name,channel,status,created_at', q => q.in('status', ['pending_approval', 'active', 'paused']).order('created_at', { ascending: false }), 6),
  ]);

  const sources = { leads, conversations, handoffs, contentPending, contentScheduled, campaignsPending, optimizationPending,
    tasksOpen, tasksOverdue, failedJobs, connectedAccounts, commentsOpen, recentComments, recentJobs, usage, audit, recentContent, recentCampaigns };
  const unavailableSources = Object.entries(sources).filter(([, value]: any) => Boolean(value.error)).map(([name]) => name);
  const usageRows = usage.rows || [];
  const usageCapped = Number(usage.total || 0) > usageRows.length;
  const aiCost = usageRows.reduce((sum: number, item: any) => sum + Number(item.estimated_cost || 0), 0);
  const inputUnits = usageRows.reduce((sum: number, item: any) => sum + Number(item.input_units || 0), 0);
  const outputUnits = usageRows.reduce((sum: number, item: any) => sum + Number(item.output_units || 0), 0);
  const accounts = connectedAccounts.rows || [];
  const connected = accounts.filter((item: any) => item.connection_status === 'connected').length;
  const unhealthy = accounts.filter((item: any) => item.token_health === 'expired' || item.token_health === 'error' || Boolean(item.last_error)).length;
  const actionQueue = [
    { id: 'content_approval', label: 'Content awaiting approval', count: contentPending.total, href: '/admin/ai-growth/marketing', severity: contentPending.total ? 'action' : 'ok' },
    { id: 'campaign_approval', label: 'Campaigns awaiting approval', count: campaignsPending.total, href: '/admin/ai-growth/campaigns', severity: campaignsPending.total ? 'action' : 'ok' },
    { id: 'optimization_approval', label: 'Ad optimizations awaiting approval', count: optimizationPending.total, href: '/admin/ai-growth/ads-autopilot', severity: optimizationPending.total ? 'action' : 'ok' },
    { id: 'human_handoff', label: 'Conversations needing a human', count: handoffs.total, href: '/admin/ai-growth/channels', severity: handoffs.total ? 'action' : 'ok' },
    { id: 'overdue_tasks', label: 'Overdue follow-ups', count: tasksOverdue.total, href: '/admin/ai-growth/tasks', severity: tasksOverdue.total ? 'risk' : 'ok' },
    { id: 'failed_jobs', label: 'Failed automation jobs', count: failedJobs.total, href: '/admin/ai-growth/automation/logs', severity: failedJobs.total ? 'risk' : 'ok' },
    { id: 'social_comments', label: 'Open social comments', count: commentsOpen.total, href: '/admin/ai-growth/social', severity: commentsOpen.total ? 'action' : 'ok' },
  ];
  const auditRows = (audit.rows || []).filter((item: any) => item.organization_id === organizationId || !item.organization_id);

  return apiJson({
    generatedAt: new Date().toISOString(), period: 'last_30_days',
    summary: {
      newLeads30d: leads.total, conversations: conversations.total, humanHandoffs: handoffs.total,
      connectedSocialAccounts: connected, totalSocialAccounts: accounts.length, unhealthySocialAccounts: unhealthy,
      pendingApprovals: contentPending.total + campaignsPending.total + optimizationPending.total,
      scheduledContent: contentScheduled.total, openTasks: tasksOpen.total, overdueTasks: tasksOverdue.total,
      failedJobs: failedJobs.total, openSocialComments: commentsOpen.total,
      aiEstimatedCost: Number(aiCost.toFixed(6)), aiInputUnits: inputUnits, aiOutputUnits: outputUnits,
    },
    actionQueue,
    accounts,
    recentComments: recentComments.rows || [],
    recentJobs: recentJobs.rows || [],
    recentContent: recentContent.rows || [],
    recentCampaigns: recentCampaigns.rows || [],
    audit: auditRows,
    dataQuality: { complete: unavailableSources.length === 0 && !usageCapped, unavailableSources: usageCapped ? [...unavailableSources, 'usage_capped'] : unavailableSources, note: unavailableSources.length || usageCapped ? 'Some sources could not be read or the 30-day AI usage sample reached its 500-row cap; affected totals may be incomplete.' : 'All configured control-center sources responded successfully.' },
  });
}
