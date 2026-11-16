import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400000;
const pct = (value: number) => Number(value.toFixed(1));

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = String(req.nextUrl.searchParams.get('organizationId') || '').trim();
  if (!organizationId) return apiJson({ error: 'Workspace is required.' }, 400);
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);

  const now = Date.now();
  const currentStart = new Date(now - 30 * DAY).toISOString();
  const previousStart = new Date(now - 60 * DAY).toISOString();
  const [currentLeads, previousLeads, tasks, actions, campaigns] = await Promise.all([
    ctx.db.from('growth_leads').select('id,name,status,lead_temperature,lead_score,created_at', { count: 'exact' }).eq('organization_id', organizationId).gte('created_at', currentStart).order('created_at', { ascending: false }).limit(1000),
    ctx.db.from('growth_leads').select('id,status,lead_temperature,created_at', { count: 'exact' }).eq('organization_id', organizationId).gte('created_at', previousStart).lt('created_at', currentStart).order('created_at', { ascending: false }).limit(1000),
    ctx.db.from('growth_tasks').select('id,status,due_at', { count: 'exact' }).eq('organization_id', organizationId).limit(2000),
    ctx.db.from('growth_command_actions').select('id,status,created_at,updated_at', { count: 'exact' }).eq('organization_id', organizationId).gte('created_at', currentStart).order('created_at', { ascending: false }).limit(1000),
    ctx.db.from('growth_campaigns').select('id,name,status,created_at', { count: 'exact' }).eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200),
  ]);
  if (currentLeads.error || previousLeads.error || tasks.error || actions.error || campaigns.error) return apiJson({ error: 'Business risk insights are unavailable. Verify that the CRM, task and Command Center migrations are applied.' }, 503);

  const current = currentLeads.data || [], previous = previousLeads.data || [], taskRows = tasks.data || [], actionRows = actions.data || [], campaignRows = campaigns.data || [];
  const activeTasks = taskRows.filter((row: any) => !['done', 'completed', 'cancelled'].includes(String(row.status || '').toLowerCase()));
  const overdueTasks = activeTasks.filter((row: any) => row.due_at && Date.parse(row.due_at) < now);
  const coldLeads = current.filter((row: any) => String(row.lead_temperature || '').toLowerCase() === 'cold');
  const terminalActions = actionRows.filter((row: any) => ['executed', 'failed'].includes(String(row.status || '').toLowerCase()));
  const failedActions = terminalActions.filter((row: any) => row.status === 'failed');
  const insights: Array<{ key: string; severity: 'high' | 'medium' | 'low'; title: string; evidence: string; recommendation: string; confidence: 'limited' | 'moderate' | 'strong' }> = [];
  let riskIndex = 0;

  const prior = previousLeads.count ?? previous.length, recent = currentLeads.count ?? current.length;
  if (prior >= 5) {
    const change = pct(((recent - prior) / prior) * 100);
    if (change <= -20) {
      const severity = change <= -40 ? 'high' : 'medium'; riskIndex += severity === 'high' ? 30 : 20;
      insights.push({ key: 'lead_volume_decline', severity, title: 'Lead inflow has declined', evidence: `New leads decreased ${Math.abs(change)}%: ${recent} in the last 30 days versus ${prior} in the previous 30 days.`, recommendation: 'Review lead sources, campaign activity and website enquiry capture before changing budgets.', confidence: Math.min(recent, prior) >= 10 ? 'strong' : 'moderate' });
    }
  }
  const activeCount = activeTasks.length, overdueCount = overdueTasks.length, overdueShare = activeCount ? overdueCount / activeCount : 0;
  if (overdueCount >= 3 && overdueShare >= 0.2) {
    const severity = overdueCount >= 8 || overdueShare >= 0.4 ? 'high' : 'medium'; riskIndex += severity === 'high' ? 30 : 20;
    insights.push({ key: 'overdue_task_pressure', severity, title: 'Overdue task pressure is elevated', evidence: `${overdueCount} of ${activeCount} active tasks are overdue (${pct(overdueShare * 100)}%).`, recommendation: 'Review task ownership, due dates and blockers; prioritize customer-facing commitments first.', confidence: activeCount >= 20 ? 'strong' : 'moderate' });
  }
  const coldShare = current.length ? coldLeads.length / current.length : 0;
  if (current.length >= 10 && coldShare >= 0.6) {
    riskIndex += coldShare >= 0.8 ? 20 : 10;
    insights.push({ key: 'cold_lead_mix', severity: coldShare >= 0.8 ? 'high' : 'medium', title: 'Lead pipeline is heavily cold-weighted', evidence: `${coldLeads.length} of ${current.length} loaded recent leads are marked cold (${pct(coldShare * 100)}%).`, recommendation: 'Audit lead qualification criteria and source quality; confirm whether high-intent leads are being followed up promptly.', confidence: (currentLeads.count ?? current.length) === current.length && current.length >= 20 ? 'strong' : 'moderate' });
  }
  const failedShare = terminalActions.length ? failedActions.length / terminalActions.length : 0;
  if (terminalActions.length >= 4 && failedShare >= 0.25) {
    const severity = failedShare >= 0.5 ? 'high' : 'medium'; riskIndex += severity === 'high' ? 20 : 10;
    insights.push({ key: 'action_execution_reliability', severity, title: 'AI action execution reliability needs review', evidence: `${failedActions.length} of ${terminalActions.length} completed execution attempts failed in the last 30 days (${pct(failedShare * 100)}%).`, recommendation: 'Inspect failure reasons and retry only after correcting the underlying issue; do not repeatedly replay failed actions blindly.', confidence: terminalActions.length >= 10 ? 'strong' : 'moderate' });
  }
  const incompleteSources = [currentLeads.count === null || current.length >= 1000, previousLeads.count === null || previous.length >= 1000, tasks.count === null || taskRows.length >= 2000, actions.count === null || actionRows.length >= 1000, campaigns.count === null || campaignRows.length >= 200].filter(Boolean).length;
  // Opportunity signals are deterministic, evidence-backed prompts. They never execute outreach or mutate CRM/campaign records.
  const openLeads = current.filter((row: any) => !['won', 'lost', 'closed', 'converted'].includes(String(row.status || '').toLowerCase()));
  const highIntentLeads = openLeads.filter((row: any) => String(row.lead_temperature || '').toLowerCase() === 'hot' || Number(row.lead_score || 0) >= 75);
  const warmLeads = openLeads.filter((row: any) => String(row.lead_temperature || '').toLowerCase() === 'warm');
  const draftCampaigns = campaignRows.filter((row: any) => String(row.status || '').toLowerCase() === 'draft');
  const opportunities: Array<{ key: string; priority: 'high' | 'medium'; title: string; evidence: string; recommendation: string; destination: string; approvalRequired: true }> = [];
  if (highIntentLeads.length >= 3) opportunities.push({ key: 'high_intent_lead_followup', priority: 'high', title: 'High-intent lead follow-up opportunity', evidence: `${highIntentLeads.length} open leads from the last 30 days are marked hot or have a lead score of 75 or higher.`, recommendation: 'Review ownership and recent activity, then approve a prioritized follow-up plan for the most relevant leads.', destination: '/admin/ai-growth/crm', approvalRequired: true });
  if (warmLeads.length >= 5) opportunities.push({ key: 'warm_lead_nurture', priority: 'medium', title: 'Warm lead nurture opportunity', evidence: `${warmLeads.length} open leads from the last 30 days are marked warm.`, recommendation: 'Review segmentation and consent before approving a nurture sequence; do not contact opted-out leads.', destination: '/admin/ai-growth/crm', approvalRequired: true });
  if (draftCampaigns.length > 0) opportunities.push({ key: 'draft_campaign_review', priority: 'medium', title: 'Campaign draft ready for review', evidence: `${draftCampaigns.length} campaign draft(s) are available in this workspace.`, recommendation: 'Review audience, channel, budget and approval requirements before publishing any campaign.', destination: '/admin/ai-growth/campaigns', approvalRequired: true });
  const ordered = insights.sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));
  // Strategy plans are deterministic, bounded and grounded in the same workspace evidence.
  // Targets describe review/operational work, not promised revenue or conversion outcomes.
  const strategies: Array<{ key: string; priority: 'high' | 'medium'; title: string; rationale: string; evidence: string[]; target: string; measure: string; timelineDays: number; tasks: string[]; approvalRequired: true }> = [];
  if (highIntentLeads.length >= 3 || warmLeads.length >= 5) {
    const leadTarget = highIntentLeads.length ? `${highIntentLeads.length} high-intent lead(s)` : `${warmLeads.length} warm lead(s)`;
    strategies.push({ key: 'pipeline_followup_sprint', priority: highIntentLeads.length >= 3 ? 'high' : 'medium', title: '7-day lead pipeline follow-up sprint', rationale: 'Prioritize the open lead segments already visible in this workspace before creating new outreach.', evidence: [`${highIntentLeads.length} high-intent open leads`, `${warmLeads.length} warm open leads`], target: `Review and assign an explicit next step to all ${leadTarget} within 2 business days; record disposition and next follow-up date for every reviewed lead.`, measure: 'Leads reviewed / eligible leads; leads with an owner, disposition and next follow-up date.', timelineDays: 7, tasks: ['Export or filter the eligible open lead segment in CRM.', 'Check owner, last activity, consent and contact suppression before any outreach.', 'Prioritize high-intent leads and assign a named owner.', 'Record disposition and next follow-up date for each reviewed lead.', 'Review completion against the eligible lead count at day 7.'], approvalRequired: true });
  }
  if (draftCampaigns.length > 0) {
    strategies.push({ key: 'campaign_readiness_review', priority: 'medium', title: '5-day campaign readiness review', rationale: 'Draft campaigns exist and can be moved through a documented readiness review without publishing automatically.', evidence: [`${draftCampaigns.length} campaign draft(s) currently exist`], target: `Review 100% of the ${draftCampaigns.length} available draft campaign(s) within 5 days and record approve, revise or hold for each.`, measure: 'Draft campaigns with completed audience, consent, content, channel and budget checks / total draft campaigns.', timelineDays: 5, tasks: ['Open each draft and confirm its objective and audience.', 'Verify consent, suppression and channel eligibility.', 'Review copy, landing destination, tracking and schedule.', 'Check budget and authorization separately from content approval.', 'Record approve, revise or hold; publishing remains a separate authorized action.'], approvalRequired: true });
  }
  if (overdueCount >= 3 || ordered.some((item) => ['lead_volume_decline', 'overdue_task_pressure', 'action_execution_reliability'].includes(item.key))) {
    const operationalEvidence = [`${overdueCount} overdue task(s) among ${activeCount} active tasks`, ...ordered.map((item) => item.title)];
    strategies.push({ key: 'operations_recovery_plan', priority: overdueCount >= 8 ? 'high' : 'medium', title: '14-day operational recovery plan', rationale: 'Address measured delivery and execution risks through owner-assigned review work; no automatic reassignment or retry is performed.', evidence: operationalEvidence.slice(0, 5), target: overdueCount > 0 ? `Triage all ${overdueCount} currently overdue task(s) within 2 business days; document blocker, owner and revised due date for each.` : 'Complete a documented review of each currently flagged operational risk within 5 business days.', measure: 'Overdue tasks triaged / current overdue tasks; flagged risks with a documented owner and corrective next step.', timelineDays: 14, tasks: ['Review overdue tasks and confirm whether each is still active.', 'Record a blocker, accountable owner and realistic due date for each active item.', 'Review the lead-volume or execution reliability evidence where flagged.', 'Escalate customer commitments and unresolved blockers to the responsible manager.', 'Recheck overdue count and unresolved risk items at day 14.'], approvalRequired: true });
  }
  const score = Math.min(100, riskIndex);
  return apiJson({ generatedAt: new Date(now).toISOString(), horizon: 'last_30_days_vs_previous_30_days', riskIndex: score, riskLabel: score >= 60 ? 'Elevated' : score >= 30 ? 'Watch' : 'Low signal', dataQuality: { partial: incompleteSources > 0, incompleteSources, note: incompleteSources ? 'One or more sources may be capped or lack exact counts. Treat these insights as partial.' : 'Source queries returned within configured row limits. These are rule-based indicators, not machine-learning forecasts.' }, metrics: { leadsLast30Days: recent, leadsPrevious30Days: prior, activeTasks: activeCount, overdueTasks: overdueCount, coldLeadsLoaded: coldLeads.length, terminalActions: terminalActions.length, failedActions: failedActions.length, highIntentLeads: highIntentLeads.length, warmLeads: warmLeads.length, draftCampaigns: draftCampaigns.length }, insights: ordered, opportunities, strategies, strategyPolicy: 'Strategies are deterministic plans based on bounded workspace records. Targets measure review and operational completion, not guaranteed revenue, conversion or causal business impact. Proposing a strategy creates one approval-gated internal CRM task containing its checklist; it does not create child tasks or execute external work.', notice: 'Risk index is a deterministic heuristic from workspace records, not a probability, financial forecast or causal estimate. Recommendations require human review.' });
}
