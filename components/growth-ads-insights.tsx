'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Account = { id: string; account_name: string; platform: string; connection_status: string };
type Snapshot = { id: string; ad_account_id: string; period_start: string; period_end: string; metrics: any[]; synced_at: string; source_status: string };

export default function GrowthAdsInsights({ organizationId, accounts }: { organizationId: string; accounts: Account[] }) {
  const [socialAccountId, setSocialAccountId] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const facebookAccounts = accounts.filter(a => a.platform === 'facebook' && a.connection_status === 'connected');
  async function token() { const { data } = await supabase!.auth.getSession(); return data.session?.access_token || ''; }
  async function load() {
    const response = await fetch(`/api/growth/ads-insights?organizationId=${organizationId}`, { headers: { Authorization: `Bearer ${await token()}` } });
    const data = await response.json();
    if (response.ok) setSnapshots(data.snapshots || []);
  }
  useEffect(() => { if (facebookAccounts.length && !socialAccountId) setSocialAccountId(facebookAccounts[0].id); load(); }, [organizationId]);
  async function sync() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/growth/ads-insights', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, socialAccountId, adAccountId, days: 7 }) });
      const data = await response.json();
      setMessage(response.ok ? `Synced ${data.campaignRows} campaign/day rows for ${data.period.since} to ${data.period.until}.` : data.error || 'Ads sync failed.');
      if (response.ok) await load();
    } catch { setMessage('Unable to reach the Ads Insights endpoint.'); }
    finally { setBusy(false); }
  }
  const latest = snapshots[0];
  const total = (key: string) => (latest?.metrics || []).reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  return <section className="growth-note">
    <h3>Meta Ads Reporting (Read-only)</h3>
    <p>Fetch campaign-level spend, impressions, reach, clicks, CPC, CTR and action metrics. This module does not create, edit, pause or publish campaigns and cannot spend ad budget.</p>
    {facebookAccounts.length ? <>
      <label>Connected Facebook Page token<select value={socialAccountId} onChange={e => setSocialAccountId(e.target.value)}>{facebookAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></label>
      <label>Meta Ad Account ID<input value={adAccountId} onChange={e => setAdAccountId(e.target.value)} placeholder="act_1234567890" /></label>
      <button className="btn" onClick={sync} disabled={busy || !socialAccountId || !adAccountId.trim()}>{busy ? 'Syncing Ads…' : 'Sync Meta Ads Insights'}</button>
      <small>Required: Meta `ads_read` permission and access to the selected Ad Account. Use the Ad Account ID from Meta Ads Manager.</small>
    </> : <p className="growth-empty">Connect a Facebook Page through Meta OAuth first.</p>}
    {message && <p role="status">{message}</p>}
    {latest && <>
      <p><b>Latest:</b> {latest.ad_account_id} · {latest.period_start} – {latest.period_end}</p>
      <div className="growth-stats"><div><strong>{total('spend').toFixed(2)}</strong><span>Spend (account currency)</span></div><div><strong>{Math.round(total('impressions')).toLocaleString()}</strong><span>Impressions (daily rows summed)</span></div><div><strong>{Math.round(total('clicks')).toLocaleString()}</strong><span>Clicks (daily rows summed)</span></div></div>
      {(latest.metrics || []).slice(0, 12).map((row, index) => <article className="growth-row" key={`${row.campaign_id || 'campaign'}-${row.date_start || index}`}><b>{row.campaign_name || row.campaign_id || 'Campaign'}</b><small>{row.date_start} · Spend {row.spend ?? '—'} · Impressions {row.impressions ?? '—'} · Clicks {row.clicks ?? '—'} · CTR {row.ctr ?? '—'}%</small></article>)}
    </>}
    {!snapshots.length && <p className="growth-empty">No Meta Ads snapshots synced yet.</p>}
  </section>;
}
