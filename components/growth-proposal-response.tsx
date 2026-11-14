'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
type Proposal = { referenceNo: string; title: string; summary: string | null; lineItems: Array<{ description?: string; quantity?: number; amount?: number; taxAmount?: number }>; currency: string; totalAmount: number; validUntil: string | null; expiresAt: string };
export default function GrowthProposalResponse() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [proposal, setProposal] = useState<Proposal | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState('');
  useEffect(() => {
    let active = true;
    if (!token) { setError('Proposal response link is missing.'); return; }
    fetch(`/api/growth/proposals/respond?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Proposal could not be loaded.'); return d.proposal as Proposal; })
      .then(p => { if (active) setProposal(p); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Proposal could not be loaded.'); });
    return () => { active = false; };
  }, [token]);
  async function respond(decision: 'accepted' | 'rejected') {
    if (!token || busy || !window.confirm(decision === 'accepted' ? 'Accept this proposal?' : 'Reject this proposal?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/growth/proposals/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, decision }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Response could not be saved.');
      setResult(data.status === 'accepted' ? 'Proposal accepted successfully. Thank you.' : 'Proposal declined. Thank you for letting us know.'); setProposal(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Response could not be saved.'); } finally { setBusy(false); }
  }
  return <main style={{ minHeight: '100vh', background: '#f5f2e9', padding: '48px 16px', color: '#183c31' }}><section style={{ maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 12px 40px rgba(20,50,40,.10)' }}><p style={{ letterSpacing: 2, fontWeight: 700, color: '#a17b32' }}>ANAIRA · PROPOSAL</p><h1 style={{ fontSize: 30, margin: '8px 0 18px' }}>Proposal review</h1>{error && <p role="alert" style={{ color: '#9b2424' }}>{error}</p>}{result && <p role="status" style={{ color: '#17633d', fontWeight: 700 }}>{result}</p>}{proposal && <><h2>{proposal.title}</h2><p>Reference: <b>{proposal.referenceNo}</b></p>{proposal.summary && <p>{proposal.summary}</p>}<div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', margin: '18px 0' }}><thead><tr><th align="left">Description</th><th align="right">Qty</th><th align="right">Amount</th></tr></thead><tbody>{(proposal.lineItems || []).map((item, i) => <tr key={i}><td style={{ padding: 10, borderTop: '1px solid #e5e5e5' }}>{item.description || `Item ${i + 1}`}</td><td align="right" style={{ padding: 10, borderTop: '1px solid #e5e5e5' }}>{item.quantity ?? 0}</td><td align="right" style={{ padding: 10, borderTop: '1px solid #e5e5e5' }}>{proposal.currency} {Number(item.amount || 0).toFixed(2)}</td></tr>)}</tbody></table></div><h2 style={{ textAlign: 'right' }}>Total: {proposal.currency} {Number(proposal.totalAmount).toFixed(2)}</h2><p>Valid until: {proposal.validUntil || new Date(proposal.expiresAt).toLocaleDateString()}</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}><button disabled={busy} onClick={() => respond('accepted')} style={{ background: '#18513e', color: '#fff', border: 0, borderRadius: 8, padding: '12px 22px', cursor: 'pointer' }}>{busy ? 'Saving…' : 'Accept proposal'}</button><button disabled={busy} onClick={() => respond('rejected')} style={{ background: '#fff', color: '#8c2929', border: '1px solid #d8b5b5', borderRadius: 8, padding: '12px 22px', cursor: 'pointer' }}>Decline proposal</button></div></>}</section></main>;
}
