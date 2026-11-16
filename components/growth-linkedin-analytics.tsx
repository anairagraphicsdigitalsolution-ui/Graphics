'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Account = { id: string; platform: string; account_name: string; connection_status: string; scopes?: string[]; metadata?: any };
export default function GrowthLinkedInAnalytics({ organizationId, accounts }: { organizationId: string; accounts: Account[] }) {
  const linkedInAccounts = useMemo(() => accounts.filter(a => a.platform === 'linkedin' && a.connection_status === 'connected'), [accounts]);
  const [accountId, setAccountId] = useState(linkedInAccounts[0]?.id || '');
  const selected = linkedInAccounts.find(a => a.id === accountId) || linkedInAccounts[0];
  const organizations = Array.isArray(selected?.metadata?.organization_urns) ? selected.metadata.organization_urns : [];
  const [organizationUrn, setOrganizationUrn] = useState(organizations[0]?.urn || '');
  useEffect(() => {
    if (!accountId && linkedInAccounts[0]) setAccountId(linkedInAccounts[0].id);
    if (!organizationUrn && organizations[0]?.urn) setOrganizationUrn(organizations[0].urn);
  }, [accountId, linkedInAccounts, organizationUrn, organizations]);
  const [days, setDays] = useState('28');
  const [report, setReport] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice(''); setReport(null);
    try {
      if (!supabase) throw new Error('Supabase client unavailable.');
      const { data: { session } } = await supabase.auth.getSession();
      const q = new URLSearchParams({ organizationId, socialAccountId: accountId, organizationUrn, days });
      const response = await fetch(`/api/growth/linkedin-analytics?${q}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'LinkedIn analytics request failed.');
      setReport(data);
      if (data.warnings?.length) setNotice(`Partial provider response: ${data.warnings.join(' · ')}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'LinkedIn analytics request failed.'); }
    finally { setBusy(false); }
  }
  return <section className="growth-note"><h3>LinkedIn Organization Analytics</h3><p>Company Page views, follower gains and post engagement from LinkedIn's organization analytics APIs. Requires approved LinkedIn organization analytics scopes and an administrator/authorized role on the Company Page.</p>
    {linkedInAccounts.length ? <form className="growth-content-form" onSubmit={load}>
      <label>LinkedIn member<select value={accountId} onChange={e => { const id = e.target.value; setAccountId(id); const account = linkedInAccounts.find(a => a.id === id); const orgs = Array.isArray(account?.metadata?.organization_urns) ? account.metadata.organization_urns : []; setOrganizationUrn(orgs[0]?.urn || ''); setReport(null); }}>{linkedInAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></label>
      <label>Authorized Company Page<select value={organizationUrn} onChange={e => setOrganizationUrn(e.target.value)}>{organizations.map((o: any) => <option key={o.urn} value={o.urn}>{o.urn}{o.role ? ` · ${o.role}` : ''}</option>)}</select></label>
      <label>Reporting period<select value={days} onChange={e => setDays(e.target.value)}><option value="7">Last 7 days</option><option value="28">Last 28 days</option><option value="90">Last 90 days</option></select></label>
      <button className="btn" disabled={busy || !accountId || !organizationUrn}>{busy ? 'Loading…' : 'Load LinkedIn Analytics'}</button>
    </form> : <p>No connected LinkedIn member account found.</p>}
    {selected && !organizations.length && <p role="status">No approved Company Page was discovered for this connection. Enable `LINKEDIN_ORGANIZATION_ANALYTICS_ENABLED`, ensure the LinkedIn app has the required API product access, then reconnect and grant the requested scopes.</p>}
    {notice && <p role="alert">{notice}</p>}
    {report?.totals && <><p><b>{report.period.startDate} – {report.period.endDate}</b> · {report.account} · {report.organizationUrn}</p><div className="growth-stats">
      <div><strong>{Number(report.totals.pageViews).toLocaleString()}</strong><span>Page views</span></div>
      <div><strong>{Number(report.totals.followerGains).toLocaleString()}</strong><span>Follower gains</span></div>
      <div><strong>{Number(report.totals.impressionCount).toLocaleString()}</strong><span>Post impressions</span></div>
      <div><strong>{Number(report.totals.likeCount + report.totals.commentCount + report.totals.shareCount).toLocaleString()}</strong><span>Likes + comments + shares</span></div>
    </div><small>Source: {report.source} · API version {report.sourceVersion} · Retrieved {new Date(report.fetchedAt).toLocaleString()}{report.partial ? ' · Partial endpoint response' : ''}</small></>}
  </section>;
}
