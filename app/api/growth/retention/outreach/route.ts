import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { evaluateLeadChannelSuppression } from '@/lib/growth-send-policy';

export const runtime = 'nodejs';
const TYPES = ['repeat_purchase', 'feedback', 'review', 'reactivation', 'renewal', 'loyalty'] as const;
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const EMAIL_FIELDS = 'id,name,email,status,consent_to_contact,contact_opted_out_at,channel_consents,channel_suppressions,email_bounced_at,email_complained_at';

async function access(db: any, userId: string, organizationId: string, write = false) {
  return Boolean(organizationId)
    && await requireGrowthRole(db, userId, organizationId, write ? ['owner', 'manager', 'editor'] : ['owner', 'manager', 'editor', 'viewer', 'client'])
    && await requireGrowthFeature(db, userId, organizationId, 'crm');
}

function emailEligibility(lead: any) {
  const policy = evaluateLeadChannelSuppression(lead, 'email');
  if (!lead?.email) return { allowed: false, reason: 'Customer email address is missing.' };
  if (!policy.allowed) return policy;
  return { allowed: true, reason: null };
}

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = clean(req.nextUrl.searchParams.get('organizationId'), 80);
  if (!await access(ctx.db, ctx.userId, organizationId)) return apiJson({ error: 'Workspace CRM access denied.' }, 403);

  const [leadResult, activityResult, touchpointResult] = await Promise.all([
    ctx.db.from('growth_leads').select(EMAIL_FIELDS + ',created_at,lead_temperature,lead_score,source').eq('organization_id', organizationId).eq('status', 'won').order('created_at', { ascending: false }).limit(500),
    ctx.db.from('growth_lead_activities').select('lead_id,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(5000),
    ctx.db.from('growth_retention_touchpoints').select('id,lead_id,touchpoint_type,channel,subject,status,scheduled_at,approved_at,sent_at,failure_reason,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200)
  ]);
  if (leadResult.error || activityResult.error || touchpointResult.error) return apiJson({ error: 'Retention data is unavailable. Confirm the Module 13 migration is applied.' }, 503);

  const lastActivity = new Map<string, string>();
  for (const row of activityResult.data || []) if (row.lead_id && !lastActivity.has(row.lead_id)) lastActivity.set(row.lead_id, row.created_at);
  const now = Date.now();
  const customers = (leadResult.data || []).map((lead: any) => {
    const activityAt = lastActivity.get(lead.id) || lead.created_at;
    const daysSinceActivity = Math.max(0, Math.floor((now - Date.parse(activityAt)) / 86400000));
    const segment = daysSinceActivity >= 61 ? 'dormant' : daysSinceActivity >= 31 ? 'at_risk' : 'engaged';
    const eligibility = emailEligibility(lead);
    return { id: lead.id, name: lead.name, email: lead.email, source: lead.source, leadTemperature: lead.lead_temperature, leadScore: lead.lead_score, lastActivityAt: activityAt, daysSinceActivity, segment, emailEligible: eligibility.allowed, emailBlockReason: eligibility.reason };
  });
  const counts = { engaged: customers.filter((x: any) => x.segment === 'engaged').length, atRisk: customers.filter((x: any) => x.segment === 'at_risk').length, dormant: customers.filter((x: any) => x.segment === 'dormant').length, emailEligible: customers.filter((x: any) => x.emailEligible).length };
  return apiJson({ customers, touchpoints: touchpointResult.data || [], counts, limits: { customers: 500, activities: 5000, touchpoints: 200 }, segmentation: { method: 'days since last recorded CRM activity; falls back to customer created_at when no activity exists', engaged: '0–30 days', atRisk: '31–60 days', dormant: '61+ days', predictiveModel: false } });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80), leadId = clean(body.leadId, 80);
    const type = clean(body.touchpointType, 40), subject = clean(body.subject, 180), messageBody = clean(body.messageBody, 10000);
    const scheduledAt = typeof body.scheduledAt === 'string' && !Number.isNaN(Date.parse(body.scheduledAt)) ? new Date(body.scheduledAt).toISOString() : null;
    if (!organizationId || !leadId || !TYPES.includes(type as any) || !subject || !messageBody || !scheduledAt) return apiJson({ error: 'Workspace, customer, touchpoint type, subject, message and valid schedule are required.' }, 400);
    if (!await access(ctx.db, ctx.userId, organizationId, true)) return apiJson({ error: 'CRM editor permission is required.' }, 403);
    if (Date.parse(scheduledAt) < Date.now() - 60000) return apiJson({ error: 'Schedule must be in the future.' }, 400);
    const { data: lead } = await ctx.db.from('growth_leads').select(EMAIL_FIELDS).eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (!lead || lead.status !== 'won') return apiJson({ error: 'A Won customer in this workspace is required.' }, 409);
    const { data: row, error } = await ctx.db.from('growth_retention_touchpoints').insert({ organization_id: organizationId, lead_id: leadId, touchpoint_type: type, channel: 'email', subject, message_body: messageBody, scheduled_at: scheduledAt, status: 'draft', created_by: ctx.userId }).select('id,lead_id,touchpoint_type,channel,subject,status,scheduled_at,created_at').single();
    if (error || !row) return apiJson({ error: 'Retention message draft could not be saved.' }, 500);
    const eligibility = emailEligibility(lead);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: leadId, activity_type: 'note', body: `Retention email draft created (${type}). It requires human approval and a fresh consent check before dispatch.`, created_by: ctx.userId, metadata: { retention_touchpoint_id: row.id, status: 'draft' } });
    return apiJson({ touchpoint: row, eligibility, message: eligibility.allowed ? 'Draft saved. A manager/editor must approve it before sending.' : `Draft saved but cannot currently be approved: ${eligibility.reason}` }, 201);
  } catch { return apiJson({ error: 'Invalid retention draft request.' }, 400); }
}

export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80), touchpointId = clean(body.touchpointId, 80), action = clean(body.action, 20);
    if (!organizationId || !touchpointId || !['approve', 'cancel'].includes(action)) return apiJson({ error: 'Workspace, touchpoint and supported action are required.' }, 400);
    if (!await access(ctx.db, ctx.userId, organizationId, true)) return apiJson({ error: 'CRM editor permission is required.' }, 403);
    const { data: item } = await ctx.db.from('growth_retention_touchpoints').select('*').eq('id', touchpointId).eq('organization_id', organizationId).maybeSingle();
    if (!item) return apiJson({ error: 'Retention touchpoint not found in this workspace.' }, 404);
    if (action === 'cancel') {
      if (!['draft', 'queued', 'failed'].includes(item.status)) return apiJson({ error: 'Only draft, queued or failed touchpoints can be cancelled.' }, 409);
      if (item.job_id) {
        const { data: cancelledJob, error: cancelJobError } = await ctx.db.from('growth_jobs').update({ status: 'cancelled', last_error: 'Cancelled by workspace user.', locked_at: null }).eq('id', item.job_id).eq('organization_id', organizationId).in('status', ['queued', 'failed']).select('id').maybeSingle();
        if (cancelJobError) return apiJson({ error: 'Queued email could not be cancelled safely.' }, 500);
        if (!cancelledJob) return apiJson({ error: 'The email is already processing or completed and cannot be cancelled safely.' }, 409);
      }
      const { data: cancelledTouchpoint, error } = await ctx.db.from('growth_retention_touchpoints').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', touchpointId).eq('organization_id', organizationId).eq('status', item.status).select('id').maybeSingle();
      if (error || !cancelledTouchpoint) return apiJson({ error: 'Touchpoint changed concurrently and could not be cancelled.' }, 409);
      return apiJson({ success: true, status: 'cancelled' });
    }
    if (!['draft', 'failed'].includes(item.status)) return apiJson({ error: 'Only a draft or failed touchpoint can be approved.' }, 409);
    if (Date.parse(item.scheduled_at) < Date.now() - 60000) return apiJson({ error: 'Scheduled time has passed. Create a new draft with a future schedule.' }, 409);
    const { data: lead } = await ctx.db.from('growth_leads').select(EMAIL_FIELDS).eq('id', item.lead_id).eq('organization_id', organizationId).maybeSingle();
    if (!lead || lead.status !== 'won') return apiJson({ error: 'Customer is no longer an eligible Won customer.' }, 409);
    const eligibility = emailEligibility(lead);
    if (!eligibility.allowed) return apiJson({ error: `Approval blocked: ${eligibility.reason}` }, 409);
    const idempotencyKey = `retention-touchpoint:${item.id}`;
    const { data: job, error: jobError } = await ctx.db.from('growth_jobs').upsert({ organization_id: organizationId, job_type: 'send_email', idempotency_key: idempotencyKey, payload: { lead_id: lead.id, subject: item.subject, text: item.message_body, retention_touchpoint_id: item.id }, status: 'queued', run_at: item.scheduled_at, attempts: 0, max_attempts: 5, completed_at: null, locked_at: null, external_effect_started_at: null, last_error: null }, { onConflict: 'organization_id,job_type,idempotency_key' }).select('id').single();
    if (jobError || !job) return apiJson({ error: 'Approved email could not be queued.' }, 500);
    const { error: updateError } = await ctx.db.from('growth_retention_touchpoints').update({ status: 'queued', approved_by: ctx.userId, approved_at: new Date().toISOString(), job_id: job.id, failure_reason: null, updated_at: new Date().toISOString() }).eq('id', item.id).eq('organization_id', organizationId);
    if (updateError) return apiJson({ error: 'Email was queued but the retention record needs reconciliation.' }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: lead.id, activity_type: 'note', body: `Retention email approved and queued for ${item.scheduled_at}. Provider dispatch will re-check consent, suppression and workspace send policy.`, created_by: ctx.userId, metadata: { retention_touchpoint_id: item.id, job_id: job.id, status: 'queued' } });
    return apiJson({ success: true, status: 'queued', jobId: job.id, message: 'Approved and queued. Consent, suppression, deliverability and quiet-hours policy are checked again by the worker before provider dispatch.' });
  } catch { return apiJson({ error: 'Retention approval request failed.' }, 400); }
}
