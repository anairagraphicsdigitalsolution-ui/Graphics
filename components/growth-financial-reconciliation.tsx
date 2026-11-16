"use client";
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Reconciliation = { totalsByCurrency: Record<string, { spend: number; grossRevenue: number; refunds: number; netRevenue: number; roas: number | null; records: number }>; campaigns: Array<{ campaignId: string; campaignName: string; leads: number; wonLeads: number; perCurrency: Record<string, { spend: number; netRevenue: number; attributedRevenue: number; revenueVariance: number; roas: number | null; cpl: number | null; cac: number | null }> }>; attributedRevenueByCurrency: Record<string, number>; reconciliationVarianceByCurrency: Record<string, number>; attributionEventCount: number; entries: any[]; coverage: { spendRecords: number; revenueRecords: number; refundRecords: number; currencies: string[]; note: string }; truncated: boolean; truncatedSources?: string[] };
const fmt = (n: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
export default function GrowthFinancialReconciliation({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<Reconciliation | null>(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [entryType, setEntryType] = useState('spend'), [amount, setAmount] = useState(''), [currency, setCurrency] = useState('INR'), [channel, setChannel] = useState('meta_ads'), [campaignId, setCampaignId] = useState(''), [campaignName, setCampaignName] = useState(''), [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10)), [externalRef, setExternalRef] = useState(''), [notes, setNotes] = useState('');
  const load = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/growth/analytics/reconciliation?organizationId=${encodeURIComponent(organizationId)}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Financial reconciliation could not be loaded.');
      setData(result); setNotice('');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Analytics unavailable.'); }
    finally { setBusy(false); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return; setSaving(true); setNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/growth/analytics/reconciliation', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ organizationId, entryType, amount: Number(amount), currency, channel, campaignId, campaignName, entryDate, externalRef, notes }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Entry could not be saved.');
      setAmount(''); setExternalRef(''); setNotes(''); setNotice('Financial entry saved.'); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Entry could not be saved.'); }
    finally { setSaving(false); }
  }
  return <section className="growth-note" aria-label="Marketing financial reconciliation">
    <div className="growth-inline-controls" style={{ justifyContent: 'space-between' }}><div><h3>Actual Spend & Revenue Reconciliation</h3><p>Actual financial ledger. Currency totals remain separate; no estimated FX conversion is applied.</p></div><button type="button" className="btn btn-small btn-secondary" disabled={busy} onClick={() => void load()}>{busy ? 'Refreshing…' : 'Refresh'}</button></div>
    {notice && <p role="status" className="notice">{notice}</p>}
    {data && <>
      <div className="growth-stats">{Object.entries(data.totalsByCurrency).map(([code, x]) => <div key={code}><strong>{fmt(x.spend, code)}</strong><span>Actual spend</span><small>{code}</small></div>)}{Object.entries(data.totalsByCurrency).map(([code, x]) => <div key={`net-${code}`}><strong>{fmt(x.netRevenue, code)}</strong><span>Net revenue</span><small>{code} · refunds {fmt(x.refunds, code)}</small></div>)}{Object.entries(data.totalsByCurrency).map(([code, x]) => <div key={`roas-${code}`}><strong>{x.roas === null ? '—' : `${x.roas.toFixed(2)}×`}</strong><span>ROAS</span><small>{code} · actual spend only</small></div>)}</div>
      <p><small>Ledger coverage: {data.coverage.spendRecords} spend · {data.coverage.revenueRecords} revenue · {data.coverage.refundRecords} refunds. {data.truncated ? `Some datasets reached the 5,000-row cap (${(data.truncatedSources || []).join(', ')}); narrow the reporting range before relying on ratios.` : 'All returned datasets fit within the reporting cap.'}</small></p>
      <h4>Revenue attribution reconciliation</h4><p>Attributed events: {data.attributionEventCount}. Ledger-versus-attribution variance is shown per currency; positive means posted ledger revenue exceeds attributed event revenue.</p><div className="growth-stats">{Object.entries(data.reconciliationVarianceByCurrency || {}).map(([code, variance]) => <div key={`variance-${code}`}><strong>{fmt(variance, code)}</strong><span>Revenue variance</span><small>{code} · attributed {fmt(data.attributedRevenueByCurrency?.[code] || 0, code)}</small></div>)}</div><h4>Campaign performance</h4>{data.campaigns.length ? <div style={{ overflowX: 'auto', maxWidth: '100%' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr><th>Campaign</th><th>Leads</th><th>Won</th><th>Currency</th><th>Spend</th><th>Net revenue</th><th>Attributed</th><th>Variance</th><th>ROAS</th><th>CPL</th><th>CAC</th></tr></thead><tbody>{data.campaigns.flatMap(c => Object.entries(c.perCurrency).map(([code, x]) => <tr key={`${c.campaignId}-${code}`}><td>{c.campaignName}</td><td>{c.leads}</td><td>{c.wonLeads}</td><td>{code}</td><td>{fmt(x.spend, code)}</td><td>{fmt(x.netRevenue, code)}</td><td>{fmt(x.attributedRevenue, code)}</td><td>{fmt(x.revenueVariance, code)}</td><td>{x.roas === null ? '—' : `${x.roas.toFixed(2)}×`}</td><td>{x.cpl === null ? '—' : fmt(x.cpl, code)}</td><td>{x.cac === null ? '—' : fmt(x.cac, code)}</td></tr>))}</tbody></table></div> : <p className="growth-empty">No campaign-linked actual financial entries yet.</p>}
      <h4>Recent actual entries</h4>{data.entries.length ? data.entries.slice(0, 12).map(row => <article className="growth-row" key={row.id}><div><b>{String(row.entry_type).toUpperCase()} · {fmt(Number(row.amount), String(row.currency).trim())}</b><small>{row.entry_date} · {row.channel} · {row.campaign_name || row.campaign_id || 'No campaign'} · {row.source}{row.external_ref ? ` · Ref ${row.external_ref}` : ''}</small>{row.notes && <small>{row.notes}</small>}</div></article>) : <p className="growth-empty">No actual spend, revenue or refund entries have been recorded yet.</p>}
    </>}
    <h4>Record actual financial entry</h4><form onSubmit={submit} className="growth-content-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
      <label>Entry type<select value={entryType} onChange={e => setEntryType(e.target.value)}><option value="spend">Marketing spend</option><option value="revenue">Recognized revenue</option><option value="refund">Refund</option></select></label>
      <label>Amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></label>
      <label>Currency<input required maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label>
      <label>Channel<select value={channel} onChange={e => setChannel(e.target.value)}>{['meta_ads','google_ads','facebook','instagram','linkedin','youtube','email','whatsapp','organic','referral','other'].map(x => <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Campaign ID<input value={campaignId} onChange={e => setCampaignId(e.target.value)} placeholder="Exact campaign / UTM ID" /></label>
      <label>Campaign name<input value={campaignName} onChange={e => setCampaignName(e.target.value)} /></label>
      <label>Entry date<input required type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} /></label>
      <label>External reference<input value={externalRef} onChange={e => setExternalRef(e.target.value)} placeholder="Provider transaction / invoice ID" /></label>
      <label style={{ gridColumn: '1 / -1' }}>Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Source document or reconciliation note" /></label>
      <div style={{ gridColumn: '1 / -1' }}><button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save financial entry'}</button><small>Only workspace owners/managers can add ledger entries. Duplicate provider references are rejected.</small></div>
    </form>
  </section>;
}
