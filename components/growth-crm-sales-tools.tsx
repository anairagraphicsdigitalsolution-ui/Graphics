'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = { organizationId: string; leadId: string };
type Meeting = { id: string; title: string; starts_at: string; ends_at: string | null; meeting_mode: string; meeting_url: string | null; location: string | null; status: string; agenda: string | null };
type Proposal = { id: string; reference_no: string; title: string; currency: string; total_amount: number; status: string; delivery_status?: string; valid_until: string | null; created_at: string };
const localDateTime = (date: Date) => { const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

export default function GrowthCRMSalesTools({ organizationId, leadId }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([]), [proposals, setProposals] = useState<Proposal[]>([]);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('Sales consultation'), [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState('30'), [meetingMode, setMeetingMode] = useState('online'), [meetingUrl, setMeetingUrl] = useState(''), [location, setLocation] = useState(''), [agenda, setAgenda] = useState('');
  const [proposalTitle, setProposalTitle] = useState('Business Proposal'), [summary, setSummary] = useState(''), [itemDescription, setItemDescription] = useState('Professional services'), [quantity, setQuantity] = useState('1'), [unitPrice, setUnitPrice] = useState(''), [taxRate, setTaxRate] = useState('18'), [discount, setDiscount] = useState('0'), [validUntil, setValidUntil] = useState('');
  const token = useCallback(async () => { if (!supabase) return ''; const { data: { session } } = await supabase.auth.getSession(); return session?.access_token || ''; }, []);
  const load = useCallback(async () => {
    if (!supabase || !organizationId || !leadId) return;
    const auth = { Authorization: `Bearer ${await token()}` };
    const [m, p] = await Promise.all([
      fetch(`/api/growth/crm/meetings?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}`, { headers: auth, cache: 'no-store' }),
      fetch(`/api/growth/crm/proposals?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}`, { headers: auth, cache: 'no-store' }),
    ]);
    const [md, pd] = await Promise.all([m.json(), p.json()]);
    if (m.ok) setMeetings(md.meetings || []); else setNotice(md.error || 'Meetings could not be loaded.');
    if (p.ok) setProposals(pd.proposals || []); else setNotice(pd.error || 'Proposals could not be loaded.');
  }, [organizationId, leadId, token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!startsAt) setStartsAt(localDateTime(new Date(Date.now() + 86400000))); }, [startsAt]);

  async function scheduleMeeting(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      const start = new Date(startsAt); const end = new Date(start.getTime() + Math.max(15, Math.min(480, Number(duration) || 30)) * 60000);
      const r = await fetch('/api/growth/crm/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, leadId, title: meetingTitle, startsAt: start.toISOString(), endsAt: end.toISOString(), meetingMode, meetingUrl: meetingMode === 'online' ? meetingUrl : '', location: meetingMode === 'in_person' ? location : '', agenda, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Meeting could not be scheduled.');
      setNotice('Meeting saved in CRM. No calendar invitation was sent.'); setAgenda(''); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Meeting scheduling failed.'); } finally { setBusy(false); }
  }
  async function updateMeeting(meetingId: string, status: string) {
    setBusy(true); try { const r = await fetch('/api/growth/crm/meetings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, meetingId, status }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Meeting update failed.'); setNotice(`Meeting marked ${status.replace('_', ' ')}.`); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Meeting update failed.'); } finally { setBusy(false); }
  }
  function downloadCalendarEvent(meeting: Meeting) {
    const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const start = new Date(meeting.starts_at);
    const end = meeting.ends_at ? new Date(meeting.ends_at) : new Date(start.getTime() + 30 * 60000);
    const description = [meeting.agenda || '', meeting.meeting_url || ''].filter(Boolean).join('\n');
    const locationText = meeting.location || (meeting.meeting_mode === 'online' ? meeting.meeting_url || 'Online meeting' : meeting.meeting_mode === 'phone' ? 'Phone meeting' : '');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Anaira//AI Growth Engine//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${meeting.id}@anaira-growth`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeIcs(meeting.title)}`,`DESCRIPTION:${escapeIcs(description)}`,`LOCATION:${escapeIcs(locationText)}`,'END:VEVENT','END:VCALENDAR'];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `anaira-meeting-${meeting.id.slice(0,8)}.ics`; link.click(); URL.revokeObjectURL(url);
    setNotice('Calendar file downloaded. Import it into Google Calendar, Outlook or Apple Calendar; no invitation has been sent.');
  }
  async function createProposal(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      const r = await fetch('/api/growth/crm/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, leadId, title: proposalTitle, summary, lineItems: [{ description: itemDescription, quantity: Number(quantity), unitPrice: Number(unitPrice), taxRate: Number(taxRate) }], discountAmount: Number(discount), currency: 'INR', validUntil: validUntil || null }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Proposal draft failed.');
      setNotice(d.notice || 'Proposal draft saved.'); setUnitPrice(''); setSummary(''); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Proposal creation failed.'); } finally { setBusy(false); }
  }
  async function proposalAction(proposalId: string, status: string) {
    setBusy(true); try { const r = await fetch('/api/growth/crm/proposals', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, proposalId, status }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Proposal update failed.'); setNotice(`Proposal updated to ${status.replace('_', ' ')}.`); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Proposal update failed.'); } finally { setBusy(false); }
  }
  async function sendProposal(proposalId: string) {
    if (!window.confirm('Queue this approved proposal for email delivery? The customer must have active email consent.')) return;
    setBusy(true); try { const r = await fetch('/api/growth/crm/proposals/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, proposalId }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Proposal delivery could not be queued.'); setNotice(d.message || 'Proposal queued. Provider delivery is pending.'); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Proposal delivery failed.'); } finally { setBusy(false); }
  }

  return <section className="growth-panel" style={{ marginTop: 18 }}>
    <h2>Sales execution</h2><p>Internal meeting scheduling, proposal drafts and approval tracking for this CRM lead.</p>
    {notice && <p className="growth-note" role="status">{notice}</p>}
    <div className="growth-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 18 }}>
      <div>
        <h3>Schedule a meeting</h3>
        <form className="growth-content-form" onSubmit={scheduleMeeting}>
          <label>Meeting title<input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} maxLength={180} required /></label>
          <label>Start date & time<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required /></label>
          <label>Duration<select value={duration} onChange={e => setDuration(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label>
          <label>Meeting type<select value={meetingMode} onChange={e => setMeetingMode(e.target.value)}><option value="online">Online</option><option value="phone">Phone</option><option value="in_person">In person</option></select></label>
          {meetingMode === 'online' ? <label>Meeting URL (optional, HTTPS)<input type="url" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://..." /></label> : meetingMode === 'in_person' ? <label>Meeting location<input value={location} onChange={e => setLocation(e.target.value)} maxLength={500} /></label> : null}
          <label>Agenda / notes<textarea rows={2} value={agenda} onChange={e => setAgenda(e.target.value)} maxLength={3000} /></label>
          <button className="btn" disabled={busy || !meetingTitle.trim() || !startsAt}>Save meeting</button>
        </form>
        <div style={{ marginTop: 12 }}>{meetings.map(m => <article className="growth-row" key={m.id}><b>{m.title}</b><p>{new Date(m.starts_at).toLocaleString()} · {m.meeting_mode.replace('_', ' ')} · {m.status}</p>{m.meeting_url && <a href={m.meeting_url} target="_blank" rel="noreferrer">Open meeting link</a>}{m.location && <p>{m.location}</p>}<button className="btn btn-small btn-secondary" type="button" onClick={() => downloadCalendarEvent(m)}>Download calendar event (.ics)</button>{m.status === 'scheduled' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-small" disabled={busy} onClick={() => updateMeeting(m.id, 'completed')}>Complete</button><button className="btn btn-small" disabled={busy} onClick={() => updateMeeting(m.id, 'no_show')}>No show</button><button className="btn btn-small" disabled={busy} onClick={() => updateMeeting(m.id, 'cancelled')}>Cancel</button></div>}</article>)}{!meetings.length && <p className="growth-empty">No meetings scheduled.</p>}</div>
      </div>
      <div>
        <h3>Proposal / quotation draft</h3>
        <form className="growth-content-form" onSubmit={createProposal}>
          <label>Proposal title<input value={proposalTitle} onChange={e => setProposalTitle(e.target.value)} maxLength={180} required /></label>
          <label>Summary<textarea rows={2} value={summary} onChange={e => setSummary(e.target.value)} maxLength={3000} placeholder="Scope, deliverables and assumptions" /></label>
          <label>Item / service<input value={itemDescription} onChange={e => setItemDescription(e.target.value)} maxLength={240} required /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}><label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} required /></label><label>Unit price (₹)<input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required /></label><label>GST / tax %<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} /></label><label>Discount (₹)<input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label></div>
          <label>Valid until<input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label>
          <button className="btn" disabled={busy || !proposalTitle.trim() || !itemDescription.trim() || unitPrice === ''}>Save proposal draft</button>
        </form>
        <div style={{ marginTop: 12 }}>{proposals.map(p => <article className="growth-row" key={p.id}><b>{p.title}</b><p>{p.reference_no} · {p.currency} {Number(p.total_amount).toFixed(2)} · {p.status}</p>{p.valid_until && <small>Valid until {p.valid_until}</small>}<small>Delivery: {p.delivery_status || 'not requested'}</small>{p.status === 'draft' && <button className="btn btn-small" disabled={busy} onClick={() => proposalAction(p.id, 'pending_approval')}>Submit for approval</button>}{p.status === 'pending_approval' && <button className="btn btn-small" disabled={busy} onClick={() => proposalAction(p.id, 'approved')}>Approve proposal</button>}{p.status === 'approved' && p.delivery_status !== 'sent' && <button className="btn btn-small" disabled={busy || p.delivery_status === 'queued'} onClick={() => sendProposal(p.id)}>{p.delivery_status === 'queued' ? 'Email queued' : p.delivery_status === 'failed' ? 'Retry email' : 'Send by email'}</button>}</article>)}{!proposals.length && <p className="growth-empty">No proposals created.</p>}</div>
        <p className="growth-note"><small>Drafting and approval are internal CRM actions. This module does not send proposals, create external calendar invitations, or mark messages delivered without a configured provider integration.</small></p>
      </div>
    </div>
  </section>;
}
