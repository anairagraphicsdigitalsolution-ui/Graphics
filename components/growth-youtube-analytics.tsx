'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
type Account = { id: string; platform: string; account_name: string; connection_status: string };
export default function GrowthYouTubeAnalytics({ organizationId, accounts }: { organizationId: string; accounts: Account[] }) {
  const channels = accounts.filter(a => a.platform === 'youtube' && a.connection_status === 'connected');
  const [accountId, setAccountId] = useState(channels[0]?.id || '');
  const [days, setDays] = useState('28');
  const [report, setReport] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice(''); setReport(null);
    try {
      if (!supabase) throw new Error('Supabase client unavailable.');
      const { data: { session } } = await supabase.auth.getSession();
      const q = new URLSearchParams({ organizationId, socialAccountId: accountId, days });
      const response = await fetch(`/api/growth/youtube-analytics?${q}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analytics request failed.');
      setReport(data);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Analytics request failed.'); }
    finally { setBusy(false); }
  }
  const metrics = report?.totals;
  return <section className="growth-note"><h3>YouTube Advanced Analytics</h3><p>Channel-owned performance from YouTube Analytics: views, watch time, average view duration, likes, comments and subscriber movement. Recent two days are excluded because provider reports may be delayed.</p>
    {channels.length ? <form className="growth-content-form" onSubmit={load}><label>YouTube channel<select value={accountId} onChange={e => setAccountId(e.target.value)}>{channels.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></label><label>Reporting period<select value={days} onChange={e => setDays(e.target.value)}><option value="7">Last 7 days</option><option value="28">Last 28 days</option><option value="90">Last 90 days</option></select></label><button className="btn" disabled={busy || !accountId}>{busy ? 'Loading…' : 'Load YouTube Analytics'}</button></form> : <p>No connected YouTube channel found.</p>}
    {notice && <p role="alert">{notice}</p>}
    {metrics && <><p><b>{report.period.startDate} – {report.period.endDate}</b> · {report.channel}</p><div className="growth-stats"><div><strong>{Number(metrics.views).toLocaleString()}</strong><span>Views</span></div><div><strong>{(Number(metrics.estimatedMinutesWatched) / 60).toFixed(1)} h</strong><span>Watch time</span></div><div><strong>{Math.floor(Number(metrics.averageViewDuration) / 60)}m {Number(metrics.averageViewDuration) % 60}s</strong><span>Avg. view duration</span></div><div><strong>{Number(metrics.subscribersGained - metrics.subscribersLost).toLocaleString()}</strong><span>Net subscribers</span></div></div><div className="growth-row"><span>Likes {Number(metrics.likes).toLocaleString()} · Comments {Number(metrics.comments).toLocaleString()}</span><small>Subscribers +{metrics.subscribersGained} / −{metrics.subscribersLost}</small></div><h4>Daily views</h4>{(report.rows || []).slice(-14).map((row: any) => <div className="growth-row" key={row.day}><span>{row.day}</span><b>{Number(row.views || 0).toLocaleString()} views</b></div>)}<small>Source: YouTube Analytics API · Retrieved {new Date(report.fetchedAt).toLocaleString()}</small></>}
  </section>;
}
