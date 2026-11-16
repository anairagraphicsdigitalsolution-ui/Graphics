'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ControlData = {
  generatedAt: string;
  summary: Record<string, number>;
  actionQueue: Array<{ id: string; label: string; count: number; href: string; severity: string }>;
  accounts: Array<{ id: string; platform: string; account_name: string; connection_status: string; token_health: string; token_expires_at: string | null; last_error: string | null; last_synced_at: string | null }>;
  recentComments: Array<{ id: string; platform: string; author_name: string; message: string; permalink: string | null; provider_created_at: string | null }>;
  recentJobs: Array<{ id: string; job_type: string; status: string; attempts: number; last_error: string | null; created_at: string }>;
  recentContent: Array<{ id: string; title: string; platform: string | null; status: string; updated_at: string }>;
  recentCampaigns: Array<{ id: string; name: string; channel: string; status: string; created_at: string }>;
  audit: Array<{ id: string; event_type: string; metadata: Record<string, unknown>; created_at: string }>;
  dataQuality: { complete: boolean; unavailableSources: string[]; note: string };
};

const number = (v: unknown) => Number(v || 0).toLocaleString('en-IN');
const date = (v?: string | null) => v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function GrowthOperationsControlCenter({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<ControlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase) { setError('Authentication service is not configured.'); return; }
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch(`/api/growth/control-center?organizationId=${encodeURIComponent(organizationId)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Control Center could not be loaded.');
      setData(result as ControlData);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Control Center could not be loaded.'); }
    finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const summary = data?.summary || {};
  const tiles = useMemo(() => [
    ['New Leads', summary.newLeads30d, 'CRM & Leads', '/admin/ai-growth/crm'],
    ['Conversations', summary.conversations, 'Unified Inbox', '/admin/ai-growth/channels'],
    ['Human Handoffs', summary.humanHandoffs, 'Needs attention', '/admin/ai-growth/channels'],
    ['Social Accounts', `${number(summary.connectedSocialAccounts)} / ${number(summary.totalSocialAccounts)}`, 'Connected', '/admin/ai-growth/social'],
    ['Pending Approvals', summary.pendingApprovals, 'Human approval queue', '/admin/ai-growth/marketing'],
    ['Scheduled Content', summary.scheduledContent, 'Publishing calendar', '/admin/ai-growth/marketing'],
    ['Open Follow-ups', summary.openTasks, 'Tasks', '/admin/ai-growth/tasks'],
    ['Overdue Follow-ups', summary.overdueTasks, 'Needs attention', '/admin/ai-growth/tasks'],
    ['Failed Jobs', summary.failedJobs, 'Automation logs', '/admin/ai-growth/automation/logs'],
    ['Open Comments', summary.openSocialComments, 'Social moderation', '/admin/ai-growth/social'],
    ['AI Cost Estimate · 30 days', number(summary.aiEstimatedCost), 'Provider usage estimate · currency per provider', '/admin/ai-growth/billing'],
    ['AI Units · 30 days', number(Number(summary.aiInputUnits || 0) + Number(summary.aiOutputUnits || 0)), 'Input + output units', '/admin/ai-growth/analytics'],
  ], [summary]);

  return <section className="growth-ops-control" aria-labelledby="growth-ops-title">
    <div className="growth-ops-head">
      <div><div className="eyebrow">MODULE 7 · CENTRAL OPERATIONS</div><h2 id="growth-ops-title">Complete AI Growth Control Center</h2><p>One workspace view for AI Employee, customer pipeline, channels, approvals, campaigns, automation and usage.</p></div>
      <button type="button" className="btn btn-small" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh Control Center'}</button>
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
    {!data && loading && <p className="growth-empty">Loading operational data…</p>}
    {data && <>
      <div className={`growth-ops-quality ${data.dataQuality.complete ? 'is-complete' : 'is-partial'}`} role="status"><b>{data.dataQuality.complete ? 'All control-center sources responding' : 'Partial operational data'}</b><span>{data.dataQuality.note}{data.dataQuality.unavailableSources.length ? ` Sources: ${data.dataQuality.unavailableSources.join(', ')}` : ''}</span><small>Updated {date(data.generatedAt)} · AI cost is estimated from recorded usage logs, not an invoice.</small></div>
      <div className="growth-ops-grid">{tiles.map(([label, value, hint, href]) => <Link className="growth-ops-tile" href={String(href)} key={String(label)}><span>{label}</span><strong>{typeof value === 'number' ? number(value) : value ?? '—'}</strong><small>{hint} ↗</small></Link>)}</div>
      <div className="growth-ops-columns">
        <section className="growth-panel"><div className="growth-panel-head"><div><h3>Human approval & action queue</h3><p>These items need a review or operational follow-up.</p></div></div>
          <div className="growth-ops-list">{data.actionQueue.map(item => <Link href={item.href} key={item.id} className="growth-ops-row"><span className={`growth-ops-dot ${item.severity}`} /><span>{item.label}</span><b>{number(item.count)}</b><small>Open ↗</small></Link>)}</div>
        </section>
        <section className="growth-panel"><div className="growth-panel-head"><div><h3>Connected social accounts</h3><p>Connection and token-health snapshot.</p></div><Link href="/admin/ai-growth/social">Manage ↗</Link></div>
          {data.accounts.length ? data.accounts.map(account => <div className="growth-ops-account" key={account.id}><div><b>{account.account_name}</b><small>{account.platform} · {account.connection_status}</small>{account.last_error && <small className="growth-ops-error">{account.last_error}</small>}</div><span className={`growth-ops-pill ${account.token_health === 'healthy' ? 'good' : account.token_health === 'expired' || account.token_health === 'error' ? 'bad' : ''}`}>{account.token_health || 'unknown'}</span></div>) : <p className="growth-empty">No social accounts connected in this workspace.</p>}
          {Number(summary.unhealthySocialAccounts || 0) > 0 && <p className="notice">{number(summary.unhealthySocialAccounts)} account(s) need token or connection attention.</p>}
        </section>
      </div>
      <div className="growth-ops-columns">
        <section className="growth-panel"><div className="growth-panel-head"><div><h3>Latest inbox comments</h3><p>Open Facebook / Instagram comments waiting for review.</p></div><Link href="/admin/ai-growth/social">Open Social ↗</Link></div>
          {data.recentComments.length ? data.recentComments.map(comment => <article className="growth-ops-feed" key={comment.id}><b>{comment.author_name} · {comment.platform}</b><p>{comment.message}</p><small>{date(comment.provider_created_at)} {comment.permalink ? <>· <a href={comment.permalink} target="_blank" rel="noreferrer">View source ↗</a></> : null}</small></article>) : <p className="growth-empty">No open social comments found.</p>}
        </section>
        <section className="growth-panel"><div className="growth-panel-head"><div><h3>Automation exceptions</h3><p>Recent failed jobs; inspect before retrying.</p></div><Link href="/admin/ai-growth/automation/logs">Job logs ↗</Link></div>
          {data.recentJobs.length ? data.recentJobs.map(job => <article className="growth-ops-feed" key={job.id}><b>{job.job_type} · {job.status}</b><small>{date(job.created_at)} · {job.attempts} attempt(s)</small><p>{job.last_error || 'No error detail recorded.'}</p></article>) : <p className="growth-empty">No failed jobs currently recorded.</p>}
        </section>
      </div>
      <section className="growth-panel"><div className="growth-panel-head"><div><h3>Recent governance audit trail</h3><p>Workspace events visible to owners and managers.</p></div><Link href="/admin/ai-growth/team">Team & Permissions ↗</Link></div>
        {data.audit.length ? <div className="growth-ops-audit">{data.audit.map(event => <div key={event.id}><b>{event.event_type}</b><small>{date(event.created_at)}</small><span>{Object.keys(event.metadata || {}).length ? JSON.stringify(event.metadata) : 'No additional metadata'}</span></div>)}</div> : <p className="growth-empty">No audit events recorded yet.</p>}
      </section>
      <div className="growth-ops-shortcuts"><Link href="/admin/ai-growth/employee">AI Employee ↗</Link><Link href="/admin/ai-growth/crm">CRM & Pipeline ↗</Link><Link href="/admin/ai-growth/channels">Unified Inbox ↗</Link><Link href="/admin/ai-growth/marketing">Content Studio ↗</Link><Link href="/admin/ai-growth/campaigns">Campaigns & Ads ↗</Link><Link href="/admin/ai-growth/analytics">Analytics ↗</Link><Link href="/admin/ai-growth/billing">AI Usage & Costs ↗</Link><Link href="/admin/ai-growth/integrations">Integrations ↗</Link></div>
    </>}
  </section>;
}
