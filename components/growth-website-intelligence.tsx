'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Website = { id: string; name: string; domain: string | null; website_url: string; verification_status: string };
type Keyword = { id: string; keyword: string; country: string; device: string; target_url: string | null; latest_position: number | null; previous_position: number | null; clicks: number; impressions: number; ctr: number; priority: string; status: string; last_verified_at: string | null };
type SeoTask = { id: string; title: string; description: string; priority: string; status: string; task_type: string; created_at: string };

const number = (v: unknown) => Number(v || 0).toLocaleString('en-IN');
const position = (v: number | null) => v == null ? '—' : v.toFixed(1);

export default function GrowthWebsiteIntelligence() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [org, setOrg] = useState('');
  const [sites, setSites] = useState<Website[]>([]);
  const [site, setSite] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [properties, setProperties] = useState<any>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [tasks, setTasks] = useState<SeoTask[]>([]);
  const [keyword, setKeyword] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'error' | 'info'>('info');
  const [gscSiteUrl, setGscSiteUrl] = useState('');
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  const [tracking, setTracking] = useState<any>(null);
  const [newPublicKey, setNewPublicKey] = useState('');

  async function token() {
    if (!supabase) return '';
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }
  async function api(path: string, init: RequestInit = {}) {
    const accessToken = await token();
    const response = await fetch(path, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${accessToken}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'SEO request failed.');
    return body;
  }
  async function loadDashboard(organizationId = org, websiteId = site) {
    if (!organizationId || !websiteId) { setDashboard(null); setKeywords([]); setTasks([]); return; }
    setLoading(true);
    try {
      const data = await api(`/api/growth/seo?organizationId=${encodeURIComponent(organizationId)}&websiteId=${encodeURIComponent(websiteId)}`);
      setDashboard(data); setKeywords(data.keywords || []); setTasks(data.tasks || []);
      setReport(data.audits?.[0]?.report || null);
      setGscSiteUrl(data.connection?.settings?.gsc_site_url || ''); setGa4PropertyId(data.connection?.settings?.ga4_property_id || '');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'SEO dashboard could not load.'); setNoticeKind('error'); }
    finally { setLoading(false); }
  }
  async function loadHistory(organizationId: string, websiteId: string) {
    await loadDashboard(organizationId, websiteId);
  }
  async function loadProperties() {
    if (!org || !site) return;
    try { const data = await api(`/api/growth/seo?organizationId=${encodeURIComponent(org)}&websiteId=${encodeURIComponent(site)}&action=properties`); setProperties(data); if (data.gscError || data.ga4Error) { setNotice([data.gscError, data.ga4Error].filter(Boolean).join(' · ')); setNoticeKind('info'); } }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Google properties could not load.'); setNoticeKind('error'); }
  }
  async function postAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setNotice('');
    try {
      const data = await api('/api/growth/seo', { method: 'POST', body: JSON.stringify({ organizationId: org, websiteId: site, action, ...extra }) });
      setNotice(data.message || (data.rowsSynced != null ? `${data.rowsSynced.toLocaleString()} provider rows synced.` : 'Changes saved.'));
      setNoticeKind('success'); await loadHistory(org, site); return data;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'SEO operation failed.'); setNoticeKind('error'); return null; }
    finally { setBusy(false); }
  }
  async function runWebsiteAudit() {
    setBusy(true); setNotice('');
    try {
      const accessToken = await token();
      const response = await fetch('/api/growth/website-intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ organizationId: org, websiteId: site, action: 'scan' }), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Website audit failed.');
      setReport(data.report); setNotice(data.report?.summary || 'Website audit saved.'); setNoticeKind('success'); await loadHistory(org, site);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Website audit failed.'); setNoticeKind('error'); }
    finally { setBusy(false); }
  }
  async function connectGoogle() {
    setBusy(true); setNotice('');
    try { const data = await api('/api/growth/seo/oauth/start', { method: 'POST', body: JSON.stringify({ organizationId: org }) }); window.location.assign(data.authUrl); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Google OAuth could not start.'); setNoticeKind('error'); setBusy(false); }
  }
  async function loadTracking(organizationId = org, websiteId = site) {
    if (!organizationId || !websiteId) { setTracking(null); return; }
    try { const data = await api(`/api/growth/website-tracking?organizationId=${encodeURIComponent(organizationId)}&websiteId=${encodeURIComponent(websiteId)}`); setTracking(data); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Website analytics could not load.'); setNoticeKind('error'); }
  }
  async function trackingAction(action: 'issue_key' | 'revoke_key') {
    setBusy(true); setNotice('');
    try {
      const data = await api('/api/growth/website-tracking', { method: 'POST', body: JSON.stringify({ organizationId: org, websiteId: site, action }) });
      if (data.publicKey) setNewPublicKey(data.publicKey);
      setNotice(data.message || 'Tracking settings updated.'); setNoticeKind('success'); await loadTracking(org, site);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Tracking settings could not be updated.'); setNoticeKind('error'); }
    finally { setBusy(false); }
  }
  const trackingSnippet = newPublicKey && site ? `<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/anaira-growth-tracker.js" data-website-id="${site}" data-public-key="${newPublicKey}" data-api-base="${typeof window !== 'undefined' ? window.location.origin : ''}" async></script>` : '';

  async function addKeyword(event: React.FormEvent) {
    event.preventDefault(); if (!keyword.trim()) return;
    const saved = await postAction('add_keyword', { keyword, targetUrl, country: 'IND', device: 'ALL', priority: 'medium' });
    if (saved) { setKeyword(''); setTargetUrl(''); }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser(); if (!user || !active) return;
      const { data: memberships } = await supabase.from('growth_members').select('organization_id').eq('user_id', user.id);
      const ids = (memberships || []).map(item => item.organization_id); if (!ids.length || !active) return;
      const { data: organizations } = await supabase.from('growth_organizations').select('id,name').in('id', ids).order('name');
      if (!active) return; setOrgs(organizations || []);
      const saved = localStorage.getItem('anaira-growth-active-org') || ''; setOrg(ids.includes(saved) ? saved : ids[0]);
    })(); return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    if (!org || !supabase) { setSites([]); setSite(''); return; }
    localStorage.setItem('anaira-growth-active-org', org);
    (async () => { const { data } = await supabase.from('growth_websites').select('id,name,domain,website_url,verification_status').eq('organization_id', org).order('created_at', { ascending: false }); if (!active) return; const rows = (data || []) as Website[]; setSites(rows); setSite(current => rows.some(x => x.id === current) ? current : (rows[0]?.id || '')); })();
    return () => { active = false; };
  }, [org]);
  useEffect(() => { if (org && site) { loadHistory(org, site); loadTracking(org, site); setNewPublicKey(''); } else { setDashboard(null); setKeywords([]); setTasks([]); setTracking(null); } }, [org, site]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('google_seo'); const error = params.get('google_seo_error');
    if (connected === 'connected') { setNotice('Google Search Console + GA4 connected. Select the website properties below.'); setNoticeKind('success'); }
    else if (error) { setNotice(error); setNoticeKind('error'); }
  }, []);

  const search = dashboard?.search;
  const analytics = dashboard?.analytics;
  const selectedSite = sites.find(x => x.id === site);
  const positionChange = (item: Keyword) => item.latest_position == null || item.previous_position == null ? '—' : `${item.latest_position < item.previous_position ? '↑' : item.latest_position > item.previous_position ? '↓' : '→'} ${Math.abs(item.previous_position - item.latest_position).toFixed(1)}`;
  const latestAudit = dashboard?.audits?.[0];

  return (
    <main className="growth-admin">
      <header className="growth-head"><div><div className="eyebrow">WEBSITE PERFORMANCE &amp; ORGANIC SEARCH</div><h1>Website Intelligence</h1><p>Visitor analytics, conversion funnels, CRM form capture, campaign attribution, technical audits and verified Google Search Console / GA4 data.</p></div></header>
      <section className="growth-panel">
        <div className="growth-panel-head"><h2>Website workspace</h2><select aria-label="Workspace" value={org} onChange={e => setOrg(e.target.value)}>{orgs.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <select aria-label="Website" value={site} onChange={e => setSite(e.target.value)}>{sites.map(x => <option key={x.id} value={x.id}>{x.name} · {x.domain || x.website_url}</option>)}</select>
        <div className="growth-inline-controls"><span>{selectedSite?.verification_status === 'verified' ? 'Domain ownership verified' : 'DNS ownership verification required for website scans'}</span><button className="btn" disabled={busy || !site || selectedSite?.verification_status !== 'verified'} onClick={runWebsiteAudit}>{busy ? 'Scanning…' : 'Run technical SEO audit'}</button></div>
        {notice && <p role="status" className={`notice ${noticeKind === 'error' ? 'notice-error' : noticeKind === 'success' ? 'notice-success' : ''}`}>{notice}</p>}
      </section>

      <section className="growth-panel">
        <div className="growth-panel-head"><div><h2>Visitor analytics &amp; lead forms</h2><p>First-party page views, visitors, sessions, form funnel, chat opens and campaign attribution. Analytics events are not sent until the visitor grants analytics consent.</p></div><strong>{tracking?.tracking?.active ? 'Tracking active' : 'Not connected'}</strong></div>
        <div className="growth-stats">
          <div><strong>{number(tracking?.analytics?.visitors)}</strong><span>Unique visitors · 30 days</span></div>
          <div><strong>{number(tracking?.analytics?.sessions)}</strong><span>Sessions · 30 days</span></div>
          <div><strong>{number(tracking?.analytics?.pageViews)}</strong><span>Page views</span></div>
          <div><strong>{number(tracking?.analytics?.formStarts)}</strong><span>Form starts</span></div>
          <div><strong>{number(tracking?.analytics?.formSubmits)}</strong><span>Form submits · consented events</span></div>
          <div><strong>{number(tracking?.analytics?.formAbandonments)}</strong><span>Form abandons · consented events</span></div>
          <div><strong>{number(tracking?.analytics?.chatOpens)}</strong><span>Chat opens</span></div>
          <div><strong>{number(tracking?.analytics?.formRecords)}</strong><span>CRM form submissions</span></div>
          <div><strong>{number(tracking?.analytics?.conversions)}</strong><span>Tracked conversions</span></div>
        </div>
        <div className="growth-inline-controls"><span>{tracking?.tracking?.active ? `Key ${tracking.tracking.keyPrefix}… active` : 'Issue a site-specific tracking key after DNS verification.'}</span><button className="btn" disabled={busy || !site || selectedSite?.verification_status !== 'verified'} onClick={() => trackingAction('issue_key')}>{busy ? 'Please wait…' : tracking?.tracking?.active ? 'Rotate tracking key' : 'Generate tracking key'}</button>{tracking?.tracking?.active && <button className="btn" disabled={busy} onClick={() => trackingAction('revoke_key')}>Revoke key</button>}</div>
        {newPublicKey && <div className="growth-panel" style={{ marginTop: 12 }}><b>Copy this key now — it is displayed only once.</b><code style={{ display: 'block', overflowWrap: 'anywhere' }}>{newPublicKey}</code><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{trackingSnippet}</pre><button className="btn" onClick={() => navigator.clipboard.writeText(trackingSnippet)}>Copy installation snippet</button></div>}
        <p><small>After installing the script, call <code>window.anairaGrowth.setConsent(true)</code> only after your consent manager records analytics permission; call <code>setAdUserDataConsent(true)</code> separately only after ad measurement consent. To record a form, add <code>data-anaira-capture</code> and <code>data-anaira-form="contact"</code> to the form; use field names <code>name</code>, <code>email</code> or <code>phone</code>, <code>requirement</code>, and an optional checkbox named <code>consent</code>. The CRM stores submissions without contact consent but does not enqueue follow-up automation unless consent is checked. Chat widgets can call <code>window.anairaGrowth.track('chat_open')</code> when opened.</small></p>
        <div className="growth-stats"><div><label>Top landing pages</label>{(tracking?.analytics?.topPages || []).slice(0,5).map((x: any) => <small key={x.name}>{x.name} · {number(x.value)}</small>)}{!tracking?.analytics?.topPages?.length && <small>No page-view data yet</small>}</div><div><label>Form funnel</label><small>Starts: {number(tracking?.analytics?.formStarts)}</small><small>Submits: {number(tracking?.analytics?.formSubmits)}</small><small>Conversions: {number(tracking?.analytics?.conversions)}</small><small>Submit rate: {tracking?.analytics?.formAbandonmentRate == null ? '—' : `${((1-tracking.analytics.formAbandonmentRate)*100).toFixed(1)}%`}</small></div><div><label>Traffic sources</label>{(tracking?.analytics?.topSources || []).slice(0,5).map((x: any) => <small key={x.name}>{x.name} · {number(x.value)}</small>)}{!tracking?.analytics?.topSources?.length && <small>No attributed traffic yet</small>}</div></div>
        {tracking?.analytics?.dataCapped && <small>Display is capped at 10,000 recent events; figures may be partial.</small>}
      </section>

      <section className="growth-panel">
        <div className="growth-panel-head"><div><h2>Google Search Console + GA4</h2><p>Live provider connection. Data is fetched from properties the connected Google account can access.</p></div><strong>{dashboard?.connection?.connected ? 'Connected' : 'Not connected'}</strong></div>
        <div className="growth-inline-controls"><button className="btn" disabled={busy || !org} onClick={connectGoogle}>{busy ? 'Please wait…' : dashboard?.connection?.connected ? 'Reconnect Google' : 'Connect Google account'}</button>{dashboard?.connection?.lastSuccessAt && <span>Last successful sync: {new Date(dashboard.connection.lastSuccessAt).toLocaleString()}</span>}</div>
        {dashboard?.connection?.connected && <>
          <button className="btn" disabled={busy} onClick={loadProperties}>Load available Google properties</button>
          {properties && <div className="growth-stats" style={{ marginTop: 16 }}>
            <div><label>Search Console property</label><select value={gscSiteUrl} onChange={e => setGscSiteUrl(e.target.value)}><option value="">Select verified property</option>{properties.gscProperties.map((p: any) => <option key={p.siteUrl} value={p.siteUrl}>{p.siteUrl} · {p.permissionLevel}</option>)}</select></div>
            <div><label>GA4 property</label><select value={ga4PropertyId} onChange={e => setGa4PropertyId(e.target.value)}><option value="">Select GA4 property</option>{properties.ga4Properties.map((p: any) => <option key={p.propertyId} value={p.propertyId}>{p.displayName} · {p.propertyId} · {p.account}</option>)}</select></div>
            <button className="btn" disabled={busy || (!gscSiteUrl && !ga4PropertyId)} onClick={() => postAction('save_properties', { gscSiteUrl, ga4PropertyId })}>Save property selection</button>
          </div>}
          <div className="growth-inline-controls" style={{ marginTop: 14 }}><button className="btn" disabled={busy || !dashboard.connection.settings?.gsc_site_url} onClick={() => postAction('sync_search_console')}>Sync Search Console</button><button className="btn" disabled={busy || !dashboard.connection.settings?.ga4_property_id} onClick={() => postAction('sync_ga4')}>Sync GA4</button></div>
        </>}
      </section>

      {report && <section className="growth-panel"><div className="growth-panel-head"><div><h2>Latest technical SEO audit</h2><p>{report.domain} · {report.scannedAt ? new Date(report.scannedAt).toLocaleString() : ''}</p></div><strong style={{ fontSize: 30 }}>{report.score}/100</strong></div><div className="growth-stats"><div><strong>{report.httpStatus || '—'}</strong><span>HTTP status</span></div><div><strong>{report.elapsedMs || 0} ms</strong><span>Response time</span></div><div><strong>{report.internalLinks || 0}</strong><span>Internal links</span></div><div><strong>{report.externalLinks || 0}</strong><span>External links</span></div></div>{(report.checks || []).map((check: any) => <article className="growth-row" key={check.key}><div><b>{check.label}</b><small>{check.detail}</small></div><strong>{check.pass ? 'Passed' : 'Needs attention'}</strong></article>)}</section>}

      {!!dashboard?.audits?.length && <section className="growth-panel"><h2>Previous website audits</h2>{dashboard.audits.map((item: any) => <button type="button" className="growth-row" key={item.id} onClick={() => setReport(item.report)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 0 }}><b>{item.audit_type === 'seo' ? 'SEO & health scan' : 'Website scan'} · {item.score}/100</b><small>{new Date(item.created_at).toLocaleString()}</small></button>)}</section>}

      <section className="growth-panel"><h2>Organic search · Last 28 days of synced data</h2><div className="growth-stats"><div><strong>{number(search?.clicks)}</strong><span>Search clicks</span></div><div><strong>{number(search?.impressions)}</strong><span>Impressions</span></div><div><strong>{search?.ctr == null ? '—' : `${(search.ctr * 100).toFixed(2)}%`}</strong><span>CTR</span></div><div><strong>{search?.averagePosition == null ? '—' : search.averagePosition.toFixed(1)}</strong><span>Avg. position</span></div><div><strong>{number(analytics?.sessions)}</strong><span>GA4 sessions</span></div><div><strong>{number(analytics?.conversions)}</strong><span>GA4 conversions</span></div></div><small>Search Console average position is aggregated over the reporting period, not a real-time live SERP rank. Google reporting may be delayed by several days. {search?.dataCapped || analytics?.dataCapped ? 'The dashboard reached its 5,000-row display cap; KPI totals shown here may be partial.' : ''}</small></section>

      <section className="growth-panel"><div className="growth-panel-head"><div><h2>Keyword ranking verification</h2><p>Track target queries against actual Search Console impressions, clicks and average position.</p></div><span>{keywords.length} tracked</span></div>
        <form onSubmit={addKeyword} className="growth-inline-controls"><input aria-label="Keyword" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Add target keyword" maxLength={200}/><input aria-label="Target URL" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="Target landing page (optional)"/><button className="btn" disabled={busy || !keyword.trim()}>Add keyword</button></form>
        <div style={{ overflowX: 'auto' }}><table className="growth-table"><thead><tr><th>Keyword</th><th>Avg. position</th><th>Change</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Last verified</th></tr></thead><tbody>{keywords.map(k => <tr key={k.id}><td><b>{k.keyword}</b><small>{k.target_url || 'No target URL'}</small></td><td>{position(k.latest_position)}</td><td>{positionChange(k)}</td><td>{number(k.clicks)}</td><td>{number(k.impressions)}</td><td>{(Number(k.ctr || 0) * 100).toFixed(2)}%</td><td>{k.last_verified_at ? new Date(k.last_verified_at).toLocaleDateString() : 'Not synced'}</td></tr>)}</tbody></table></div>
        {!keywords.length && <p>Add target keywords, then sync Search Console to verify actual query performance.</p>}
      </section>

      <section className="growth-panel"><div className="growth-panel-head"><div><h2>Prioritized SEO tasks</h2><p>Convert failed technical audit checks into assignable work items. No page content is changed automatically.</p></div><button className="btn" disabled={busy || !latestAudit} onClick={() => postAction('generate_tasks')}>Generate from latest audit</button></div>
        {tasks.map(task => <article className="growth-row" key={task.id}><div><b>{task.title}</b><small>{task.description}</small></div><div><strong>{task.priority.toUpperCase()}</strong><select aria-label={`Task status ${task.title}`} value={task.status} onChange={e => postAction('update_task', { taskId: task.id, status: e.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option></select></div></article>)}
        {!tasks.length && <p>No SEO tasks yet. Run a website audit and generate tasks from its findings.</p>}
      </section>
      {loading && <p>Refreshing SEO data…</p>}
      <section className="growth-panel"><h2>SEO scope & data quality</h2><ul><li>Homepage technical audit and saved audit history are available.</li><li>Search Console query/page data and GA4 landing-page/source data are stored only after successful provider sync.</li><li>Competitor visibility and third-party live SERP rank tracking are not enabled in this release; no competitor rank data is fabricated.</li><li>Multi-page crawling, automatic SEO edits/publishing and scheduled provider sync still require separate implementation and live verification.</li></ul></section>
    </main>
  );
}
