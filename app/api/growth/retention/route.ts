import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
const RETENTION_TYPES = ['retention', 'renewal', 'feedback', 'review'] as const;
const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

async function canUseCrm(db: any, userId: string, organizationId: string, roles: string[]) {
  return Boolean(organizationId)
    && await requireGrowthRole(db, userId, organizationId, roles)
    && await requireGrowthFeature(db, userId, organizationId, 'crm');
}

/** Internal retention planner for won customers. It never sends customer communications. */
export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = clean(req.nextUrl.searchParams.get('organizationId'), 80);
  const leadId = clean(req.nextUrl.searchParams.get('leadId'), 80);
  if (!await canUseCrm(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) {
    return apiJson({ error: 'Workspace CRM access denied.' }, 403);
  }
  if (!leadId) return apiJson({ error: 'A customer record is required.' }, 400);
  const { data: lead, error: leadError } = await ctx.db.from('growth_leads')
    .select('id,name,status,consent_to_contact,contact_opted_out_at,email,phone,assigned_to')
    .eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
  if (leadError || !lead) return apiJson({ error: 'Customer not found in this workspace.' }, 404);
  if (lead.status !== 'won') return apiJson({ error: 'Retention planning is available after a lead is marked Won.' }, 409);
  const { data: tasks, error: taskError } = await ctx.db.from('growth_tasks')
    .select('id,title,description,task_type,status,due_at,assigned_to,completed_at,created_at')
    .eq('organization_id', organizationId).eq('lead_id', leadId)
    .in('task_type', [...RETENTION_TYPES]).order('due_at', { ascending: true }).limit(100);
  if (taskError) return apiJson({ error: 'Unable to load customer retention tasks.' }, 500);
  const now = Date.now();
  const items = tasks || [];
  return apiJson({
    customer: { id: lead.id, name: lead.name, status: lead.status },
    contactPolicy: {
      eligibleForApprovedContact: Boolean(lead.consent_to_contact) && !lead.contact_opted_out_at,
      consentRecorded: Boolean(lead.consent_to_contact), optedOut: Boolean(lead.contact_opted_out_at),
      availableChannels: [lead.email ? 'email' : null, lead.phone ? 'phone_or_whatsapp' : null].filter(Boolean),
      note: 'This planner creates internal tasks only. It never sends email, WhatsApp, SMS or calls.'
    },
    metrics: {
      total: items.length,
      open: items.filter((task: any) => ['open', 'in_progress'].includes(task.status)).length,
      overdue: items.filter((task: any) => ['open', 'in_progress'].includes(task.status) && task.due_at && Date.parse(task.due_at) < now).length,
      completed: items.filter((task: any) => task.status === 'done').length
    },
    tasks: items
  });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80);
    const leadId = clean(body.leadId, 80);
    const title = clean(body.title, 160);
    const description = clean(body.description, 2000);
    const taskType = clean(body.taskType, 30);
    const dueAt = typeof body.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : null;
    if (!organizationId || !leadId || !title || !RETENTION_TYPES.includes(taskType as any)) {
      return apiJson({ error: 'Workspace, Won customer, title and a valid retention task type are required.' }, 400);
    }
    if (!await canUseCrm(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor'])) {
      return apiJson({ error: 'CRM editor permission is required.' }, 403);
    }
    const { data: lead } = await ctx.db.from('growth_leads').select('id,name,status')
      .eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (!lead || lead.status !== 'won') return apiJson({ error: 'Retention tasks can only be created for Won customers in this workspace.' }, 409);
    const requestedAssignee = clean(body.assignedTo, 80) || ctx.userId;
    const { data: member } = await ctx.db.from('growth_members').select('user_id')
      .eq('organization_id', organizationId).eq('user_id', requestedAssignee).maybeSingle();
    if (!member) return apiJson({ error: 'Assignee must be a member of this workspace.' }, 400);
    const { data: task, error } = await ctx.db.from('growth_tasks').insert({
      organization_id: organizationId, lead_id: leadId, title, description: description || null,
      task_type: taskType, status: 'open', due_at: dueAt, assigned_to: requestedAssignee, created_by: ctx.userId
    }).select('id,title,description,task_type,status,due_at,assigned_to,completed_at,created_at').single();
    if (error || !task) return apiJson({ error: 'Retention task could not be saved.' }, 500);
    const { error: activityError } = await ctx.db.from('growth_lead_activities').insert({
      organization_id: organizationId, lead_id: leadId, activity_type: 'note',
      body: `Customer retention task created: ${title}${dueAt ? ` (due ${dueAt})` : ''}. Internal reminder only; no customer message was sent.`,
      created_by: ctx.userId, metadata: { retention_task_id: task.id, task_type: taskType, due_at: dueAt }
    });
    if (activityError) return apiJson({ task, warning: 'Task saved, but the CRM timeline entry could not be recorded.' }, 201);
    return apiJson({ task, message: 'Internal retention task created. No customer communication was sent.' }, 201);
  } catch {
    return apiJson({ error: 'Invalid retention task request.' }, 400);
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80);
    const taskId = clean(body.taskId, 80);
    const status = clean(body.status, 30);
    if (!organizationId || !taskId || !TASK_STATUSES.includes(status as any)) return apiJson({ error: 'Workspace, task and valid status are required.' }, 400);
    if (!await canUseCrm(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor'])) return apiJson({ error: 'CRM editor permission is required.' }, 403);
    const { data, error } = await ctx.db.from('growth_tasks').update({
      status, completed_at: status === 'done' ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    }).eq('id', taskId).eq('organization_id', organizationId).in('task_type', [...RETENTION_TYPES])
      .select('id,lead_id,title,status,due_at,task_type').maybeSingle();
    if (error || !data) return apiJson({ error: 'Retention task not found or could not be updated.' }, 404);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: data.lead_id,
      activity_type: 'note', body: `Retention task ${data.title} marked ${status.replace('_', ' ')}.`,
      created_by: ctx.userId, metadata: { retention_task_id: taskId, task_type: data.task_type, status } });
    return apiJson({ task: data });
  } catch {
    return apiJson({ error: 'Invalid retention task update.' }, 400);
  }
}
