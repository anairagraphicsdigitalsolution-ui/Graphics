import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 500;
const MAX_PAGES = 40;

/**
 * Supabase/PostgREST applies a row limit to each response. Fetch every page so
 * dashboard ratios and money totals are not silently calculated from only the
 * first page. If the safety cap is reached, the response explicitly says so.
 */
async function loadAll(queryFactory: () => any) {
  const rows: any[] = [];
  let exactCount: number | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], count: exactCount, truncated: false, error };
    if (page === 0 && typeof count === 'number') exactCount = count;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { rows, count: exactCount, truncated, error: null };
}

const countBy = (rows: any[], key: string) => rows.reduce((result: Record<string, number>, row) => {
  const value = String(row?.[key] || 'unknown');
  result[value] = (result[value] || 0) + 1;
  return result;
}, {});

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;

  const organizationId = String(req.nextUrl.searchParams.get('organizationId') || '').trim();
  if (!organizationId) return apiJson({ error: 'Workspace is required.' }, 400);
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) {
    return apiJson({ error: 'Workspace permission denied.' }, 403);
  }
  if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')) {
    return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const scoped = (table: string, columns: string, dateColumn?: string) => () => {
    let query = ctx.db.from(table).select(columns, { count: 'exact' }).eq('organization_id', organizationId);
    if (dateColumn) query = query.gte(dateColumn, since);
    return query.order(dateColumn || 'id', { ascending: true }).order('id', { ascending: true });
  };

  const [leads, content, campaigns, usage, tasks, conversations, attribution] = await Promise.all([
    loadAll(scoped('growth_leads', 'id,status,lead_temperature,lead_score,source,created_at', 'created_at')),
    loadAll(scoped('growth_content', 'id,status,platform,created_at', 'created_at')),
    loadAll(scoped('growth_campaigns', 'id,status,channel')),
    loadAll(scoped('growth_usage_logs', 'id,provider,model,operation,input_units,output_units,estimated_cost,created_at', 'created_at')),
    loadAll(scoped('growth_tasks', 'id,status,due_at')),
    loadAll(scoped('growth_conversations', 'id,channel,needs_human,status,created_at', 'created_at')),
    loadAll(scoped('growth_attribution_events', 'id,event_id,source,campaign_id,event_name,revenue,currency,occurred_at', 'occurred_at')),
  ]);

  const results = [leads, content, campaigns, usage, tasks, conversations, attribution];
  if (results.some((result) => result.error)) return apiJson({ error: 'Analytics could not be loaded.' }, 500);

  const leadRows = leads.rows;
  const contentRows = content.rows;
  const campaignRows = campaigns.rows;
  const usageRows = usage.rows;
  const taskRows = tasks.rows;
  const conversationRows = conversations.rows;
  const attributionRows = attribution.rows;
  const now = Date.now();

  const wonLeads = leadRows.filter((row) => row.status === 'won').length;
  const qualifiedLeads = leadRows.filter((row) => ['qualified', 'proposal', 'won'].includes(String(row.status || '').toLowerCase())).length;
  const revenueByCurrency = attributionRows.reduce((result: Record<string, number>, row) => {
    const currency = String(row.currency || 'INR').toUpperCase();
    result[currency] = (result[currency] || 0) + Number(row.revenue || 0);
    return result;
  }, {});
  const inputUnits = usageRows.reduce((sum, row) => sum + Number(row.input_units || 0), 0);
  const outputUnits = usageRows.reduce((sum, row) => sum + Number(row.output_units || 0), 0);
  const estimatedAiCost = usageRows.reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);
  const coverage = (result: { rows: any[]; count: number | null; truncated: boolean }) => ({
    sourceTotal: result.count,
    rowsLoaded: result.rows.length,
    complete: !result.truncated && result.count !== null && result.count === result.rows.length,
    truncated: result.truncated,
  });
  const metricCoverage = {
    leads: coverage(leads), content: coverage(content), campaigns: coverage(campaigns),
    usage: coverage(usage), tasks: coverage(tasks), conversations: coverage(conversations), attribution: coverage(attribution),
  };
  const dataQuality = {
    complete: Object.values(metricCoverage).every((item) => item.complete),
    truncatedSources: Object.entries(metricCoverage).filter(([, item]) => !item.complete).map(([name]) => name),
    maxRowsPerSource: PAGE_SIZE * MAX_PAGES,
    note: results.some((result) => result.truncated)
      ? 'One or more datasets reached the analytics safety cap. Totals and ratios are partial; increase the cap or use database aggregates for this workspace.'
      : results.some((result) => result.count === null)
        ? 'One or more sources did not return an exact database count. Displayed totals use loaded rows and are marked partial; verify those sources before relying on the totals.'
        : 'All available pages were loaded and reconciled against exact database counts for the selected period.',
  };

  return apiJson({
    period: 'last_30_days',
    dataQuality,
    metricCoverage,
    leads: {
      total: leads.count ?? leadRows.length,
      hot: leadRows.filter((row) => row.lead_temperature === 'hot').length,
      warm: leadRows.filter((row) => row.lead_temperature === 'warm').length,
      cold: leadRows.filter((row) => row.lead_temperature === 'cold').length,
      won: wonLeads,
      qualified: qualifiedLeads,
      qualificationRate: leadRows.length ? Number((qualifiedLeads / leadRows.length * 100).toFixed(1)) : 0,
      winRate: leadRows.length ? Number((wonLeads / leadRows.length * 100).toFixed(1)) : 0,
      averageScore: leadRows.length ? Math.round(leadRows.reduce((sum, row) => sum + Number(row.lead_score || 0), 0) / leadRows.length) : 0,
      bySource: countBy(leadRows, 'source'),
    },
    content: { total: content.count ?? contentRows.length, byStatus: countBy(contentRows, 'status'), byPlatform: countBy(contentRows, 'platform') },
    campaigns: { total: campaigns.count ?? campaignRows.length, byStatus: countBy(campaignRows, 'status'), byChannel: countBy(campaignRows, 'channel') },
    usage: {
      inputUnits, outputUnits, estimatedCost: Number(estimatedAiCost.toFixed(6)),
      records: usage.count ?? usageRows.length,
      byProvider: usageRows.reduce((result: Record<string, { inputUnits: number; outputUnits: number; estimatedCost: number; records: number }>, row) => {
        const provider = String(row.provider || 'unknown');
        const item = result[provider] || (result[provider] = { inputUnits: 0, outputUnits: 0, estimatedCost: 0, records: 0 });
        item.inputUnits += Number(row.input_units || 0);
        item.outputUnits += Number(row.output_units || 0);
        item.estimatedCost += Number(row.estimated_cost || 0);
        item.records += 1;
        return result;
      }, {}),
    },
    tasks: {
      total: tasks.count ?? taskRows.length,
      open: taskRows.filter((row) => row.status === 'open' || row.status === 'in_progress').length,
      overdue: taskRows.filter((row) => !['done', 'cancelled'].includes(String(row.status)) && row.due_at && Date.parse(row.due_at) < now).length,
    },
    conversations: {
      total: conversations.count ?? conversationRows.length,
      humanHandoff: conversationRows.filter((row) => row.needs_human).length,
      byChannel: countBy(conversationRows, 'channel'),
    },
    attribution: {
      events: attribution.count ?? attributionRows.length,
      revenueByCurrency,
      bySource: countBy(attributionRows, 'source'),
    },
    efficiency: {
      qualificationRate: leadRows.length ? Number((qualifiedLeads / leadRows.length * 100).toFixed(1)) : 0,
      winRate: leadRows.length ? Number((wonLeads / leadRows.length * 100).toFixed(1)) : 0,
      costPerLead: null,
      customerAcquisitionCost: null,
      returnOnAdSpend: null,
      unavailableMetrics: [
        'CPL, CAC and ROAS are not calculated because this endpoint does not have reconciled channel spend and currency-normalized revenue by campaign.',
      ],
    },
  });
}
