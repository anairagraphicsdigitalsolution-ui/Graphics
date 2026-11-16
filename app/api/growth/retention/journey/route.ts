import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
const clean = (value: unknown, max = 80) => String(value ?? '').trim().slice(0, max);
const MARKER = '[ANAIRA_RETENTION_JOURNEY_V6942]';
const STEPS = [
  { days: 7, type: 'retention', title: '7-day customer success check-in', description: 'Internal task: review onboarding, confirm the customer reached the expected first outcome, and record any support needs.' },
  { days: 30, type: 'feedback', title: '30-day feedback review', description: 'Internal task: review customer feedback, unresolved issues and satisfaction notes. Request feedback only through a separately approved, consent-checked channel.' },
  { days: 60, type: 'retention', title: '60-day value and adoption review', description: 'Internal task: check product/service adoption, value delivered and potential churn risks. Assign a human follow-up if needed.' },
  { days: 90, type: 'renewal', title: '90-day renewal and relationship review', description: 'Internal task: review renewal timing, account health and next steps. No customer message is sent automatically.' }
] as const;

/** Creates an internal-only 7/30/60/90-day customer-success task sequence. */
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId);
    const leadId = clean(body.leadId);
    if (!organizationId || !leadId) return apiJson({ error: 'Workspace and customer are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor']) || !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'crm')) {
      return apiJson({ error: 'CRM editor permission is required.' }, 403);
    }
    const { data: lead, error: leadError } = await ctx.db.from('growth_leads').select('id,name,status')
      .eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (leadError || !lead || lead.status !== 'won') return apiJson({ error: 'A Won customer in this workspace is required.' }, 409);
    const { data: existing, error: existingError } = await ctx.db.from('growth_tasks').select('id,status,description')
      .eq('organization_id', organizationId).eq('lead_id', leadId).in('task_type', ['retention', 'feedback', 'renewal'])
      .in('status', ['open', 'in_progress']).ilike('description', `%${MARKER}%`).limit(1);
    if (existingError) return apiJson({ error: 'Unable to check for an existing retention sequence.' }, 500);
    if (existing?.length) return apiJson({ error: 'An active 90-day retention sequence already exists for this customer.' }, 409);
    const { data: member } = await ctx.db.from('growth_members').select('user_id')
      .eq('organization_id', organizationId).eq('user_id', ctx.userId).maybeSingle();
    if (!member) return apiJson({ error: 'Workspace membership could not be verified.' }, 403);
    const start = new Date();
    const rows = STEPS.map(step => {
      const due = new Date(start.getTime() + step.days * 86400000);
      return {
        organization_id: organizationId, lead_id: leadId, title: `[Journey] ${step.title}`,
        description: `${step.description}\n${MARKER}`, task_type: step.type, status: 'open',
        due_at: due.toISOString(), assigned_to: ctx.userId, created_by: ctx.userId
      };
    });
    const { data: tasks, error: insertError } = await ctx.db.from('growth_tasks').insert(rows)
      .select('id,title,task_type,status,due_at,assigned_to,created_at');
    if (insertError || !tasks || tasks.length !== STEPS.length) return apiJson({ error: 'The retention sequence could not be created. No customer communication was sent.' }, 500);
    const { error: activityError } = await ctx.db.from('growth_lead_activities').insert({
      organization_id: organizationId, lead_id: leadId, activity_type: 'note',
      body: 'A 90-day internal customer-success sequence (7/30/60/90 days) was created. No customer communication was sent.',
      created_by: ctx.userId, metadata: { retention_journey: '90_day_v6942', task_ids: tasks.map((task: any) => task.id), external_messages_sent: 0 }
    });
    return apiJson({ tasks, warning: activityError ? 'Tasks were created, but the CRM timeline entry could not be recorded.' : undefined,
      message: 'Four internal retention tasks created for days 7, 30, 60 and 90. No customer message was sent.' }, 201);
  } catch {
    return apiJson({ error: 'Invalid retention sequence request.' }, 400);
  }
}
