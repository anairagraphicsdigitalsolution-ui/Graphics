'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Insight = { key: string; severity: 'high' | 'medium' | 'low'; title: string; evidence: string; recommendation: string; confidence: 'limited' | 'moderate' | 'strong' };
type Opportunity = { key: string; priority: 'high' | 'medium'; title: string; evidence: string; recommendation: string; destination: string; approvalRequired: true };
type Strategy = { key: string; priority: 'high' | 'medium'; title: string; rationale: string; evidence: string[]; target: string; measure: string; timelineDays: number; tasks: string[]; approvalRequired: true };
type Result = { generatedAt: string; riskIndex: number; riskLabel: string; dataQuality: { partial: boolean; note: string }; metrics: Record<string, number>; insights: Insight[]; opportunities: Opportunity[]; strategies: Strategy[]; strategyPolicy: string; notice: string };
export default function GrowthCommandPredictiveInsights({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [proposing, setProposing] = useState(''), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (!supabase) { setError('Authentication service is not configured.'); return; }
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to load business insights.');
      const response = await fetch(`/api/growth/command-insights?organizationId=${encodeURIComponent(organizationId)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Business insights could not be loaded.');
      setResult(payload as Result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Business insights could not be loaded.'); }
    finally { setBusy(false); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  const proposeStrategy = async (strategy: Strategy) => {
    if (!supabase) { setError('Authentication service is not configured.'); return; }
    setProposing(strategy.key); setError(''); setNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to propose a growth strategy.');
      const description = [strategy.rationale, `TARGET: ${strategy.target}`, `MEASURE: ${strategy.measure}`, `TIMELINE: ${strategy.timelineDays} days`, `EVIDENCE: ${strategy.evidence.join('; ')}`, 'APPROVAL CHECKLIST:', ...strategy.tasks.map((task, index) => `${index + 1}. ${task}`), 'GOVERNANCE: Approval is required. Execution creates one internal CRM task containing this plan. No child tasks, external messages, campaign publishing, budget changes or payments are executed automatically.'].join('\n').slice(0, 1950);
      const dueAt = new Date(Date.now() + strategy.timelineDays * 86400000).toISOString();
      const response = await fetch('/api/growth/command-actions', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, title: `Growth strategy: ${strategy.title}`.slice(0, 160), description, dueAt }), cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Strategy proposal could not be saved.');
      setNotice(`Strategy proposed for independent approval. Proposal ID: ${payload.action?.id || 'saved'}. No work has been executed yet.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Strategy proposal failed.'); }
    finally { setProposing(''); }
  };
  return <section className="growth-note growth-command-predictive-insights" aria-labelledby="growth-command-insights-title">
    <div className="growth-panel-head"><div><h3 id="growth-command-insights-title">Smart Business Insights &amp; Risk Signals</h3><p>Rule-based signals from the last 30 days, compared with the previous 30 days where applicable.</p></div><button type="button" className="btn btn-small" disabled={busy} onClick={() => void load()}>{busy ? 'Analyzing…' : 'Refresh insights'}</button></div>
    {error && <p className="notice" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}{!result && busy && <p className="growth-empty">Analyzing workspace signals…</p>}
    {result && <><div className="growth-stats"><div><strong>{result.riskIndex}/100</strong><span>Heuristic risk index</span></div><div><strong>{result.riskLabel}</strong><span>Signal level</span></div><div><strong>{result.metrics.leadsLast30Days ?? 0}</strong><span>Leads · last 30 days</span></div><div><strong>{result.metrics.overdueTasks ?? 0}</strong><span>Overdue tasks</span></div></div>
      <p className="growth-status-pill">{result.dataQuality.partial ? 'PARTIAL DATA · VERIFY SOURCES' : 'SOURCE CHECKS WITHIN LIMITS'}</p><p>{result.dataQuality.note}</p>
      <div className="growth-action-queue-list">{result.insights.map(item => <article className="growth-action-queue-item" key={item.key}><div><span className="growth-status-pill">{item.severity.toUpperCase()} · {item.confidence.toUpperCase()} EVIDENCE</span><h4>{item.title}</h4><p>{item.evidence}</p><p><b>Recommended review:</b> {item.recommendation}</p></div></article>)}{!result.insights.length && <p className="growth-empty">No current risk thresholds were triggered by the available workspace data.</p>}</div>
      <div className="growth-panel-head"><div><h3>Business Opportunities &amp; Approval Queue</h3><p>Evidence-based opportunities for human review. Nothing is published, sent or changed automatically.</p></div></div>
      <div className="growth-action-queue-list">{(result.opportunities || []).map(item => <article className="growth-action-queue-item" key={item.key}><div><span className="growth-status-pill">{item.priority.toUpperCase()} PRIORITY · APPROVAL REQUIRED</span><h4>{item.title}</h4><p>{item.evidence}</p><p><b>Recommended next step:</b> {item.recommendation}</p><a className="btn btn-small" href={item.destination}>Review opportunity ↗</a></div></article>)}{!(result.opportunities || []).length && <p className="growth-empty">No opportunity threshold was met by the available records.</p>}</div>
      <div className="growth-panel-head"><div><h3>Business Growth Strategy Generator</h3><p>Structured, measurable review plans generated from current workspace risks and opportunities.</p></div></div>
      <div className="growth-action-queue-list">{(result.strategies || []).map(strategy => <article className="growth-action-queue-item" key={strategy.key}><div><span className="growth-status-pill">{strategy.priority.toUpperCase()} PRIORITY · APPROVAL REQUIRED</span><h4>{strategy.title}</h4><p>{strategy.rationale}</p><p><b>Evidence:</b> {strategy.evidence.join(' · ')}</p><p><b>Measurable target:</b> {strategy.target}</p><p><b>Success measure:</b> {strategy.measure}</p><p><b>Timeline:</b> {strategy.timelineDays} days</p><ol>{strategy.tasks.map((task, index) => <li key={`${strategy.key}-${index}`}>{task}</li>)}</ol><button type="button" className="btn btn-small" disabled={!!proposing} onClick={() => void proposeStrategy(strategy)}>{proposing === strategy.key ? 'Submitting…' : 'Propose strategy for approval'}</button></div></article>)}{!(result.strategies || []).length && <p className="growth-empty">No strategy threshold was met by current workspace evidence. Refresh after relevant CRM, campaign or task activity.</p>}</div>
      <small>{result.strategyPolicy} Proposing requires Workspace Owner or Manager permission. {result.notice} · Generated {new Date(result.generatedAt).toLocaleString()}</small></>}
  </section>;
}
