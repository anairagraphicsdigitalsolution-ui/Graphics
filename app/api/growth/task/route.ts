import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const orgId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner','manager','editor','viewer','client'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
  const { data, error } = await ctx.db.from('growth_tasks').select('*').eq('organization_id', orgId).order('due_at', { ascending: true }).limit(100);
  if (error) return apiJson({ error: 'Unable to load tasks.' }, 500);
  return apiJson({ tasks: data || [] });
}
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), title = String(b.title || '').trim().slice(0,160);
    if (!title || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Title and workspace manager permission are required.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    const due = typeof b.due_at === 'string' && !Number.isNaN(Date.parse(b.due_at)) ? new Date(b.due_at).toISOString() : null;
    const leadId = typeof b.lead_id === 'string' ? b.lead_id : null;
    if (leadId) { const { data: lead } = await ctx.db.from('growth_leads').select('id').eq('id', leadId).eq('organization_id', orgId).maybeSingle(); if (!lead) return apiJson({ error: 'Lead does not belong to this workspace.' }, 400); }
    const assignee = typeof b.assigned_to === 'string' ? b.assigned_to : ctx.userId;
    const { data: assigneeMember } = await ctx.db.from('growth_members').select('user_id').eq('organization_id', orgId).eq('user_id', assignee).maybeSingle();
    if (!assigneeMember) return apiJson({ error: 'Assignee must be a member of this workspace.' }, 400);
    const row = { organization_id: orgId, lead_id: leadId, title, description: String(b.description || '').slice(0,2000) || null, task_type: ['follow_up','call','email','meeting','review','other'].includes(b.task_type) ? b.task_type : 'follow_up', due_at: due, assigned_to: assignee, created_by: ctx.userId };
    const { data, error } = await ctx.db.from('growth_tasks').insert(row).select('*').single();
    if (error) return apiJson({ error: 'Task could not be saved.' }, 500);
    return apiJson({ task: data }, 201);
  } catch { return apiJson({ error: 'Invalid task data.' }, 400); }
}
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json(), orgId = String(b.organizationId || ''), id = String(b.id || '');
    if (!id || !await requireGrowthRole(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Workspace permission denied.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, orgId, 'crm')) return apiJson({ error: 'CRM is not included in this workspace plan.' }, 402);
    if (!['open','in_progress','done','cancelled'].includes(b.status)) return apiJson({ error: 'Invalid task status.' }, 400);
    const { data, error } = await ctx.db.from('growth_tasks').update({ status: b.status, completed_at: b.status === 'done' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', orgId).select('*').maybeSingle();
    if (error || !data) return apiJson({ error: 'Task update failed.' }, 400);
    return apiJson({ task: data });
  } catch { return apiJson({ error: 'Invalid task update.' }, 400); }
}
