'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { title: string; detail: string; metric?: string };
type BriefingResponse = {
  briefing: { summary: string; priorities: Item[]; wins: Item[]; watchouts: string[]; sampledAt: string };
  metrics: Record<string, number>;
  aiMode: 'openai' | 'rules';
  aiNotice: string;
};

function number(value: unknown) { return Number(value || 0).toLocaleString('en-IN'); }
function time(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function GrowthDailyBriefing({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!supabase) { setError('Authentication service is not configured.'); return; }
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to load the workspace briefing.');
      const response = await fetch('/api/growth/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ organizationId }), cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Daily briefing could not be loaded.');
      setData(result as BriefingResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Daily briefing could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, [organizationId]);

  return <section className="growth-panel" aria-labelledby="growth-daily-briefing-title">
    <div className="growth-panel-head">
      <div><h3 id="growth-daily-briefing-title">AI Daily Business Briefing</h3><p>Workspace facts, urgent actions and sales opportunities from current records.</p></div>
      <button type="button" className="btn btn-small" disabled={loading} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh briefing'}</button>
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
    {loading && !data && <p className="growth-empty">Preparing the latest workspace briefing…</p>}
    {data && <>
      <div className="growth-inline-controls" style={{ marginBottom: 12 }}>
        <span className="growth-status-pill">{data.aiMode === 'openai' ? 'AI analysis' : 'Rule-based briefing'}</span>
        <small>Updated {time(data.briefing.sampledAt)}</small>
      </div>
      <div className="growth-note"><b>Business summary</b><p>{data.briefing.summary}</p><small>{data.aiNotice}</small></div>
      <div className="growth-stats" aria-label="Daily business metrics">
        <div><strong>{number(data.metrics.newLeads24h)}</strong><span>New leads · 24h</span></div>
        <div><strong>{number(data.metrics.openLeads)}</strong><span>Open pipeline</span></div>
        <div><strong>{number(data.metrics.overdueTasks)}</strong><span>Overdue follow-ups</span></div>
        <div><strong>{number(data.metrics.upcomingMeetings7d)}</strong><span>Meetings · 7 days</span></div>
        <div><strong>{number(data.metrics.proposalsAwaitingApproval)}</strong><span>Proposals to approve</span></div>
        <div><strong>{number(data.metrics.proposalsSent)}</strong><span>Proposals sent</span></div>
        <div><strong>{number(data.metrics.failedJobs)}</strong><span>Failed worker jobs</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginTop: 14 }}>
        <div className="growth-note"><b>Priority actions</b>
          {data.briefing.priorities?.length ? data.briefing.priorities.map((item, index) => <article className="growth-row" key={`${item.title}-${index}`}><div><b>{item.title}</b><small>{item.detail}</small></div>{item.metric && <span>{item.metric}</span>}</article>) : <p>No priority actions were identified from the available records.</p>}
        </div>
        <div className="growth-note"><b>Wins & opportunities</b>
          {data.briefing.wins?.length ? data.briefing.wins.map((item, index) => <article className="growth-row" key={`${item.title}-${index}`}><div><b>{item.title}</b><small>{item.detail}</small></div>{item.metric && <span>{item.metric}</span>}</article>) : <p>No wins or upcoming opportunities were identified in the sampled records.</p>}
          {!!data.briefing.watchouts?.length && <><b style={{ display: 'block', marginTop: 12 }}>Watchouts</b>{data.briefing.watchouts.map((item, index) => <p key={index}>• {item}</p>)}</>}
        </div>
      </div>
      <p className="growth-note"><small>Briefing uses workspace CRM, task, meeting, proposal, content and worker records. No revenue, ad spend or customer buying intent is invented. No outbound message or call is initiated by this report.</small></p>
    </>}
    {!loading && !data && !error && <p className="growth-empty">No briefing available yet.</p>}
  </section>;
}
