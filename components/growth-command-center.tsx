'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GrowthDailyBriefing from '@/components/growth-daily-briefing';
import GrowthCommandActionExecution from '@/components/growth-command-action-execution';
import GrowthCommandAlerts from '@/components/growth-command-alerts';
import GrowthCommandPredictiveInsights from '@/components/growth-command-predictive-insights';

type Analytics = {
  period?: string;
  dataQuality?: { complete?: boolean; truncatedSources?: string[]; note?: string };
  metricCoverage?: Record<string, { sourceTotal?: number | null; rowsLoaded?: number; complete?: boolean; truncated?: boolean }>; 
  leads?: { total?: number; qualified?: number; won?: number; qualificationRate?: number; winRate?: number };
  content?: { total?: number };
  campaigns?: { total?: number };
  tasks?: { total?: number; open?: number; overdue?: number };
  conversations?: { total?: number; humanHandoff?: number };
  attribution?: { events?: number; revenueByCurrency?: Record<string, number> };
  efficiency?: { costPerLead?: number | null; customerAcquisitionCost?: number | null; returnOnAdSpend?: number | null; unavailableMetrics?: string[] };
};

const fmt = (value: unknown) => Number(value || 0).toLocaleString('en-IN');

export default function GrowthCommandCenter({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) { setError('Authentication service is not configured.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to load Command Center analytics.');
      const response = await fetch(`/api/growth/analytics?organizationId=${encodeURIComponent(organizationId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Command Center analytics could not be loaded.');
      setData(result as Analytics);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Command Center analytics could not be loaded.');
    } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return <section className="growth-command-center" aria-labelledby="growth-command-center-title">
    <div className="growth-panel-head">
      <div><h2 id="growth-command-center-title">AI Command Center</h2><p>Workspace KPIs, operational risks and evidence-based next actions.</p></div>
      <button type="button" className="btn btn-small" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh KPIs'}</button>
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
    {!data && loading && <p className="growth-empty">Loading workspace KPIs…</p>}
    {data && <>
      <div className="growth-stats" aria-label="Command Center key performance indicators">
        <div><strong>{fmt(data.leads?.total)}</strong><span>Leads · last 30 days</span></div>
        <div><strong>{fmt(data.leads?.qualified)}</strong><span>Qualified pipeline</span></div>
        <div><strong>{fmt(data.leads?.won)}</strong><span>Won leads</span></div>
        <div><strong>{fmt(data.tasks?.overdue)}</strong><span>Overdue tasks</span></div>
        <div><strong>{fmt(data.content?.total)}</strong><span>Content items</span></div>
        <div><strong>{fmt(data.campaigns?.total)}</strong><span>Campaign records</span></div>
        <div><strong>{fmt(data.conversations?.humanHandoff)}</strong><span>Human handoffs</span></div>
        <div><strong>{fmt(data.attribution?.events)}</strong><span>Attribution events</span></div>
      </div>
      <div className="growth-note" role="status">
        <b>Data quality: {data.dataQuality?.complete ? 'Complete — exact counts reconciled' : 'Partial — verify flagged sources'}</b>
        <p>{data.dataQuality?.note || 'Data quality information is unavailable.'}</p>
        {!!data.dataQuality?.truncatedSources?.length && <p>Truncated sources: {data.dataQuality.truncatedSources.join(', ')}</p>}
        <small>Lead, content, campaign, task and attribution totals are sourced from workspace-scoped database queries. CPL, CAC and ROAS remain unavailable until spend and revenue are reconciled by campaign and currency.</small>
        <div style={{ marginTop: 10 }}><b>KPI source reconciliation</b>
          <div className="growth-table-wrap"><table className="growth-table"><thead><tr><th>Dataset</th><th>Database rows</th><th>Loaded rows</th><th>Coverage</th></tr></thead><tbody>
            {Object.entries(data.metricCoverage || {}).map(([name, item]) => <tr key={name}><td>{name.replace(/([A-Z])/g, ' $1')}</td><td>{item.sourceTotal ?? 'Unknown'}</td><td>{item.rowsLoaded ?? 0}</td><td><span className="growth-status-pill">{item.complete ? 'Reconciled' : 'Partial / check'}</span></td></tr>)}
          </tbody></table></div>
        </div>
      </div>
      <section className="growth-note growth-command-action-queue" aria-labelledby="growth-action-queue-title">
        <div className="growth-panel-head">
          <div><h3 id="growth-action-queue-title">AI Action Queue</h3><p>Prioritized next steps generated from this workspace’s current KPI evidence.</p></div>
          <span className="growth-status-pill" aria-live="polite">{[data.tasks?.overdue, data.conversations?.humanHandoff, data.leads?.total, data.campaigns?.total, data.content?.total].filter((value) => Number(value || 0) > 0).length} signals</span>
        </div>
        <div className="growth-action-queue-list">
          {Number(data.tasks?.overdue || 0) > 0 && <article className="growth-action-queue-item"><div><span className="growth-status-pill">HIGH PRIORITY</span><h4>Resolve overdue tasks</h4><p>{fmt(data.tasks?.overdue)} open task(s) are past their due date. Review ownership and next follow-up.</p></div><a className="btn btn-small" href="/admin/ai-growth/tasks">Open Tasks ↗</a></article>}
          {Number(data.conversations?.humanHandoff || 0) > 0 && <article className="growth-action-queue-item"><div><span className="growth-status-pill">HIGH PRIORITY</span><h4>Review customer handoffs</h4><p>{fmt(data.conversations?.humanHandoff)} conversation(s) are flagged for human attention.</p></div><a className="btn btn-small" href="/admin/ai-growth/communications">Open Conversations ↗</a></article>}
          {Number(data.leads?.total || 0) > 0 && <article className="growth-action-queue-item"><div><span className="growth-status-pill">FOLLOW-UP</span><h4>Work the lead pipeline</h4><p>{fmt(data.leads?.total)} lead(s) are in the last-30-day dataset; prioritize qualified and high-intent prospects.</p></div><a className="btn btn-small" href="/admin/ai-growth/crm">Open CRM ↗</a></article>}
          {Number(data.campaigns?.total || 0) > 0 && <article className="growth-action-queue-item"><div><span className="growth-status-pill">OPTIMIZATION</span><h4>Review campaign performance</h4><p>{fmt(data.campaigns?.total)} campaign record(s) are available for status and performance review.</p></div><a className="btn btn-small" href="/admin/ai-growth/campaigns">Open Campaigns ↗</a></article>}
          {Number(data.content?.total || 0) > 0 && <article className="growth-action-queue-item"><div><span className="growth-status-pill">PUBLISHING</span><h4>Review content pipeline</h4><p>{fmt(data.content?.total)} content item(s) are available for editorial and publishing review.</p></div><a className="btn btn-small" href="/admin/ai-growth/marketing">Open Content Studio ↗</a></article>}
          {!([data.tasks?.overdue, data.conversations?.humanHandoff, data.leads?.total, data.campaigns?.total, data.content?.total].some((value) => Number(value || 0) > 0)) && <p className="growth-empty">No actionable KPI signals were found in the current dataset. Refresh KPIs after new workspace activity.</p>}
        </div>
        <small>Recommendations are based only on the returned workspace KPI snapshot. Opening a destination does not execute changes or contact customers.</small>
      </section>
      <GrowthCommandPredictiveInsights organizationId={organizationId} />
      <div className="growth-note">
        <b>Conversion indicators</b>
        <p>Qualification rate: {Number(data.leads?.qualificationRate || 0).toFixed(1)}% · Win rate: {Number(data.leads?.winRate || 0).toFixed(1)}%</p>
        <p>Open tasks: {fmt(data.tasks?.open)} · Total task records: {fmt(data.tasks?.total)}</p>
        <p>Revenue by currency: {Object.entries(data.attribution?.revenueByCurrency || {}).map(([currency, amount]) => `${currency} ${Number(amount).toLocaleString('en-IN')}`).join(' · ') || 'No attributed revenue events recorded'}</p>
      </div>
    </>}
    <GrowthCommandActionExecution organizationId={organizationId} />
    <GrowthCommandAlerts organizationId={organizationId} />
    <GrowthDailyBriefing organizationId={organizationId} />
  </section>;
}
