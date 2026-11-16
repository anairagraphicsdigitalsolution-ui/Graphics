import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const orgId = String(req.nextUrl.searchParams.get('organizationId') || '');
  if (!await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager','editor','viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  const { data, error } = await ctx.db.from('growth_command_actions').select('id,action_type,title,description,due_at,status,created_by,approved_by,approved_at,rejected_by,rejected_at,reviewed_by,reviewed_at,approval_note,rejection_reason,executed_by,executed_at,result,error_message,created_at,updated_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100);
  if (error) return apiJson({ error: 'Action history unavailable. Apply the Command Action Execution migration.' }, 503);
  const actions = data || [];
  const taskIds = actions.map((a:any) => a.result?.task_id).filter((id:any): id is string => typeof id === 'string');
  const [taskResult, feedbackResult] = await Promise.all([
    taskIds.length ? ctx.db.from('growth_tasks').select('id,status,completed_at,updated_at').eq('organization_id', orgId).in('id', taskIds) : Promise.resolve({ data: [], error: null } as any),
    ctx.db.from('growth_command_action_feedback').select('id,action_id,feedback_type,rating,notes,created_by,created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(250)
  ]);
  if (taskResult.error || feedbackResult.error) return apiJson({ error: 'Action outcome tracking is unavailable. Apply the Function 7 migration.' }, 503);
  const taskById = new Map((taskResult.data || []).map((t:any) => [t.id, t]));
  const feedbackByAction = new Map<string, any[]>();
  for (const f of feedbackResult.data || []) { const list = feedbackByAction.get(f.action_id) || []; list.push(f); feedbackByAction.set(f.action_id, list); }
  const enriched = actions.map((a:any) => ({ ...a, task_outcome: a.result?.task_id ? taskById.get(a.result.task_id) || null : null, feedback: feedbackByAction.get(a.id) || [] }));
  const outcomes = enriched.reduce((acc:any, a:any) => { const status = a.task_outcome?.status; if (status === 'done') acc.completed++; else if (status === 'cancelled') acc.cancelled++; else if (status) acc.open++; if (a.status === 'executed') acc.executed++; return acc; }, { executed: 0, completed: 0, open: 0, cancelled: 0 });
  // Descriptive governance metrics over the same bounded, workspace-scoped history.
  const statusCounts = enriched.reduce((acc:any, a:any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const approvedCount = (statusCounts.approved || 0) + (statusCounts.executed || 0);
  const rejectedCount = statusCounts.rejected || 0;
  const decisionCount = approvedCount + rejectedCount;
  const executionAttempts = (statusCounts.executed || 0) + (statusCounts.failed || 0);
  const executionSuccesses = statusCounts.executed || 0;
  const reviewerMap = new Map<string, any>();
  for (const action of enriched) {
    if (!action.reviewed_by) continue;
    const reviewer = reviewerMap.get(action.reviewed_by) || { reviewer_id: action.reviewed_by, reviews: 0, approvals: 0, rejections: 0 };
    reviewer.reviews++;
    if (action.status === 'approved' || action.status === 'executed') reviewer.approvals++;
    if (action.status === 'rejected') reviewer.rejections++;
    reviewerMap.set(action.reviewed_by, reviewer);
  }
  const failureReasons = enriched.filter((a:any) => a.status === 'failed' || a.error_message).map((a:any) => ({ action_id: a.id, title: a.title, reason: String(a.error_message || 'Execution failed without a recorded reason').slice(0, 500), created_at: a.updated_at || a.created_at })).slice(0, 20);
  const feedbackCounts = (feedbackResult.data || []).reduce((acc:any, f:any) => { acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1; if (Number.isInteger(f.rating) && f.rating >= 1 && f.rating <= 5) { acc.rated_count++; acc.rating_total += f.rating; } return acc; }, { positive: 0, neutral: 0, negative: 0, rated_count: 0, rating_total: 0 });
  const governancePerformance = {
    window: { actions: enriched.length, bounded: true, action_limit: 100, feedback_limit: 250, history_limited: enriched.length === 100 || (feedbackResult.data || []).length === 250 },
    status_counts: statusCounts,
    pending_reviews: statusCounts.pending_approval || 0,
    approval_rate: decisionCount ? Number((approvedCount / decisionCount * 100).toFixed(1)) : null,
    rejection_rate: decisionCount ? Number((rejectedCount / decisionCount * 100).toFixed(1)) : null,
    execution_success_rate: executionAttempts ? Number((executionSuccesses / executionAttempts * 100).toFixed(1)) : null,
    execution_attempts: executionAttempts,
    execution_successes: executionSuccesses,
    execution_failures: statusCounts.failed || 0,
    reviewer_activity: [...reviewerMap.values()].sort((a:any, b:any) => b.reviews - a.reviews).slice(0, 20),
    failure_reasons: failureReasons,
    feedback_quality: { ...feedbackCounts, average_rating: feedbackCounts.rated_count ? Number((feedbackCounts.rating_total / feedbackCounts.rated_count).toFixed(2)) : null }
  };
  // Descriptive feedback aggregation only: no model training or automatic ranking changes.
  const actionById = new Map(enriched.map((a:any) => [a.id, a]));
  const learningGroups = new Map<string, any>();
  for (const feedback of feedbackResult.data || []) {
    const action:any = actionById.get(feedback.action_id);
    if (!action) continue;
    const key = String(action.action_type || 'unknown');
    const group = learningGroups.get(key) || { action_type: key, sample_size: 0, distinct_action_ids: new Set<string>(), positive: 0, neutral: 0, negative: 0, ratings: 0, rating_total: 0 };
    group.sample_size++;
    group.distinct_action_ids.add(action.id);
    group[feedback.feedback_type] = (group[feedback.feedback_type] || 0) + 1;
    if (Number.isInteger(feedback.rating) && feedback.rating >= 1 && feedback.rating <= 5) { group.ratings++; group.rating_total += feedback.rating; }
    learningGroups.set(key, group);
  }
  const recommendationLearning = [...learningGroups.values()].map((g:any) => ({
    action_type: g.action_type, sample_size: g.sample_size, distinct_actions: g.distinct_action_ids.size, positive: g.positive, neutral: g.neutral, negative: g.negative,
    positive_rate: g.sample_size ? Number((g.positive / g.sample_size).toFixed(3)) : null,
    average_rating: g.ratings ? Number((g.rating_total / g.ratings).toFixed(2)) : null,
    evidence_level: g.distinct_action_ids.size >= 5 ? 'directional' : 'insufficient_sample',
    recommendation: g.distinct_action_ids.size < 5 ? 'Collect feedback across at least 5 distinct actions before changing guidance.' : g.negative > g.positive ? 'Human review recommended: negative feedback exceeds positive feedback.' : 'Continue monitoring; no automatic ranking change is applied.'
  }));
  return apiJson({ actions: enriched, outcomes, governancePerformance, outcomeAttribution: 'Operational task status only; revenue or KPI causality is not inferred.', recommendationLearning, learningWindow: { actions: actions.length, feedback: (feedbackResult.data || []).length, bounded: true, action_limit: 100, feedback_limit: 250, history_limited: actions.length === 100 || (feedbackResult.data || []).length === 250 }, learningPolicy: 'Descriptive human-feedback aggregation only. No model training, automatic recommendation ranking changes, or revenue/KPI causality claims.' });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), title = String(b.title || '').trim().slice(0,160), description = String(b.description || '').trim().slice(0,2000);
    if (!await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager'])) return apiJson({ error: 'Owner or manager permission required to propose an executable action.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    if (!title) return apiJson({ error: 'Action title is required.' }, 400);
    const dueAt = b.dueAt ? new Date(String(b.dueAt)) : null;
    if (dueAt && !Number.isFinite(dueAt.getTime())) return apiJson({ error: 'Due date is invalid.' }, 400);
    const { data, error } = await ctx.db.from('growth_command_actions').insert({ organization_id: orgId, action_type: 'create_task', title, description, due_at: dueAt?.toISOString() || null, status: 'pending_approval', created_by: ctx.userId }).select('*').single();
    if (error) return apiJson({ error: 'Could not save action proposal.' }, 503);
    await ctx.db.from('growth_platform_audit_events').insert({ organization_id: orgId, actor_user_id: ctx.userId, event_type: 'growth.command_action.proposed', metadata: { action_id: data.id, action_type: data.action_type } });
    return apiJson({ success: true, action: data, notice: 'Proposal saved. No task has been created yet; approval is required.' }, 201);
  } catch { return apiJson({ error: 'Invalid action proposal.' }, 400); }
}

export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), id = String(b.id || ''), operation = String(b.operation || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager'])) return apiJson({ error: 'Owner or manager permission required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    if (operation === 'feedback') {
      if (!id) return apiJson({ error: 'Action ID is required.' }, 400);
      const feedbackType = String(b.feedbackType || '');
      if (!['positive','negative','neutral'].includes(feedbackType)) return apiJson({ error: 'Feedback must be positive, negative or neutral.' }, 400);
      const rating = b.rating == null || b.rating === '' ? null : Number(b.rating);
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return apiJson({ error: 'Rating must be a whole number from 1 to 5.' }, 400);
      const { data: action, error: actionError } = await ctx.db.from('growth_command_actions').select('id,status,result').eq('id', id).eq('organization_id', orgId).maybeSingle();
      if (actionError || !action) return apiJson({ error: 'Action not found in this workspace.' }, 404);
      if (action.status !== 'executed' || !action.result?.task_id) return apiJson({ error: 'Feedback is available after an action has executed.' }, 409);
      const { data: task } = await ctx.db.from('growth_tasks').select('id').eq('id', action.result.task_id).eq('organization_id', orgId).maybeSingle();
      if (!task) return apiJson({ error: 'Linked CRM task was not found in this workspace.' }, 409);
      const { data: feedback, error: feedbackError } = await ctx.db.from('growth_command_action_feedback').insert({ organization_id: orgId, action_id: id, task_id: task.id, feedback_type: feedbackType, rating, notes: String(b.notes || '').trim().slice(0,1200) || null, created_by: ctx.userId }).select('id,action_id,feedback_type,rating,notes,created_by,created_at').single();
      if (feedbackError) return apiJson({ error: 'Could not save action feedback. Apply the Function 7 migration.' }, 503);
      await ctx.db.from('growth_platform_audit_events').insert({ organization_id: orgId, actor_user_id: ctx.userId, event_type: 'growth.command_action.feedback_recorded', metadata: { action_id: id, feedback_id: feedback.id, feedback_type: feedbackType, rating } });
      return apiJson({ success: true, feedback, notice: 'Outcome feedback saved for the AI learning and review loop.' }, 201);
    }
    if (!id || !['approve','reject','execute'].includes(operation)) return apiJson({ error: 'Action ID and supported operation are required.' }, 400);
    const { data: action, error: readError } = await ctx.db.from('growth_command_actions').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle();
    if (readError || !action) return apiJson({ error: 'Action proposal not found in this workspace.' }, 404);
    const now = new Date().toISOString();
    if (operation === 'approve' || operation === 'reject') {
      if (action.status !== 'pending_approval') return apiJson({ error: 'Only pending proposals can be reviewed.' }, 409);
      const reviewNote = String(b.reviewNote || '').trim().slice(0, 1200);
      if (operation === 'reject' && !reviewNote) return apiJson({ error: 'A rejection reason is required.' }, 400);
      if (action.created_by === ctx.userId) return apiJson({ error: 'You cannot review your own proposal. Ask another workspace owner or manager.' }, 403);
      const { data: decision, error: reviewError } = await ctx.db.rpc('review_growth_command_action', {
        p_organization_id: orgId, p_action_id: id, p_actor_id: ctx.userId,
        p_decision: operation, p_note: reviewNote || null
      });
      if (reviewError || !decision?.success) return apiJson({ error: decision?.error || 'Review could not be recorded. Apply the Function 9 governance migration.' }, decision?.status || 503);
      const { data, error } = await ctx.db.from('growth_command_actions').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle();
      if (error || !data) return apiJson({ success: true, decision, warning: 'Review and audit were recorded; refresh to reload the proposal.' }, 200);
      return apiJson({ success: true, action: data, decision, notice: operation === 'approve' ? 'Independent approval recorded. The action is ready for its separately controlled execution step.' : 'Proposal rejected with a recorded reason and audit event.' });
    }
    if (action.status !== 'approved') return apiJson({ error: 'Only approved actions can execute.' }, 409);
    // The database function locks the proposal and creates the task + execution ledger
    // update in one transaction. A unique workflow_step_key makes retries/concurrent
    // requests idempotent without relying on a text search in task descriptions.
    const { data: execution, error: executionError } = await ctx.db.rpc('execute_growth_command_action', {
      p_organization_id: orgId, p_action_id: id, p_actor_id: ctx.userId
    });
    if (executionError || !execution?.success) return apiJson({ error: execution?.error || 'Approved action could not be executed. No duplicate task was created.' }, execution?.status || 503);
    const taskId = execution.task_id;
    const { data, error } = await ctx.db.from('growth_command_actions').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle();
    if (error || !data) return apiJson({ error: 'Task was created but action history could not be reloaded. Refresh to reconcile.' }, 503);
    const { error: auditError } = await ctx.db.from('growth_platform_audit_events').insert({ organization_id: orgId, actor_user_id: ctx.userId, event_type: 'growth.command_action.executed', metadata: { action_id: id, task_id: taskId } });
    if (auditError) return apiJson({ success: true, action: data, taskId, warning: 'Task was created, but the audit event could not be recorded. Contact an administrator.' }, 200);
    return apiJson({ success: true, action: data, taskId, notice: execution.already_executed ? 'This approved action was already executed; the existing CRM task was returned.' : 'Internal CRM task created. No external message, campaign or payment action was performed.' });
  } catch { return apiJson({ error: 'Command action operation failed.' }, 400); }
}
