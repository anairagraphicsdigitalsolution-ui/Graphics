'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RetentionTask = { id: string; title: string; description: string | null; task_type: string; status: string; due_at: string | null; completed_at: string | null; created_at: string };
type Props = { organizationId: string; leadId: string };
const localDateTime = (date: Date) => { const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return value.toISOString().slice(0, 16); };

export default function GrowthCRMRetention({ organizationId, leadId }: Props) {
  const [tasks, setTasks] = useState<RetentionTask[]>([]), [metrics, setMetrics] = useState({ total: 0, open: 0, overdue: 0, completed: 0 });
  const [eligible, setEligible] = useState(false), [contactNote, setContactNote] = useState('');
  const [title, setTitle] = useState('Customer check-in'), [taskType, setTaskType] = useState('retention'), [description, setDescription] = useState(''), [dueAt, setDueAt] = useState(() => localDateTime(new Date(Date.now() + 7 * 86400000)));
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const token = useCallback(async () => { if (!supabase) return ''; const { data: { session } } = await supabase.auth.getSession(); return session?.access_token || ''; }, []);
  const load = useCallback(async () => {
    if (!supabase || !organizationId || !leadId) return;
    const response = await fetch(`/api/growth/retention?organizationId=${encodeURIComponent(organizationId)}&leadId=${encodeURIComponent(leadId)}`, { headers: { Authorization: `Bearer ${await token()}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Retention tasks could not be loaded.');
    setTasks(data.tasks || []); setMetrics(data.metrics || { total: 0, open: 0, overdue: 0, completed: 0 });
    setEligible(Boolean(data.contactPolicy?.eligibleForApprovedContact));
    setContactNote(data.contactPolicy?.note || 'Internal tasks only.');
  }, [organizationId, leadId, token]);
  useEffect(() => { load().catch(e => setNotice(e instanceof Error ? e.message : 'Retention tasks could not be loaded.')); }, [load]);
  async function createTask(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/growth/retention', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, leadId, title, taskType, description, dueAt: dueAt ? new Date(dueAt).toISOString() : null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Retention task could not be saved.');
      setNotice(data.message || 'Retention reminder created.'); setDescription(''); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Retention task could not be saved.'); } finally { setBusy(false); }
  }
  async function updateTask(taskId: string, status: string) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/growth/retention', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ organizationId, taskId, status }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Retention task could not be updated.');
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Retention task could not be updated.'); } finally { setBusy(false); }
  }
  return <section className="growth-panel" aria-labelledby="customer-retention-title">
    <div className="growth-panel-head"><div><h3 id="customer-retention-title">Customer Retention</h3><p>Post-sale check-ins, renewals, feedback and review reminders.</p></div></div>
    <div className="growth-stats"><div><strong>{metrics.open}</strong><span>Open tasks</span></div><div><strong>{metrics.overdue}</strong><span>Overdue</span></div><div><strong>{metrics.completed}</strong><span>Completed</span></div></div>
    <p className="growth-note"><b>Contact policy</b><br/>{eligible ? 'A consent record exists and no opt-out is recorded. External contact still requires a separate approved channel action.' : 'No active contact consent, or the customer opted out. Create internal reminders only; do not contact the customer.'}<br/><small>{contactNote}</small></p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <form className="growth-content-form" onSubmit={createTask}>
      <label>Reminder title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required/></label>
      <label>Type<select value={taskType} onChange={e => setTaskType(e.target.value)}><option value="retention">Relationship check-in</option><option value="renewal">Renewal reminder</option><option value="feedback">Feedback collection</option><option value="review">Review request reminder</option></select></label>
      <label>Due at<input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}/></label>
      <label>Internal notes<textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Context for the assigned teammate…" maxLength={2000}/></label>
      <button className="btn" disabled={busy || !title.trim()}>Create retention reminder</button>
    </form>
    <h4>Retention history</h4>
    {tasks.map(task => <article className="growth-row" key={task.id}>
      <div className="growth-panel-head"><div><b>{task.title}</b><small>{task.task_type} · {task.due_at ? `Due ${new Date(task.due_at).toLocaleString()}` : 'No due date'}</small></div><span>{task.status.replace('_', ' ')}</span></div>
      {task.description && <p>{task.description}</p>}
      {task.status !== 'done' && task.status !== 'cancelled' && <div className="growth-inline-controls"><button type="button" className="btn btn-small" disabled={busy} onClick={() => updateTask(task.id, 'done')}>Complete</button><button type="button" className="btn btn-small" disabled={busy} onClick={() => updateTask(task.id, 'cancelled')}>Cancel</button></div>}
    </article>)}
    {!tasks.length && <p className="growth-empty">No retention tasks yet. Create a reminder to start the customer retention plan.</p>}
  </section>;
}
