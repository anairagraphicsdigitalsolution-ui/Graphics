import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { evaluateLeadChannelSuppression } from '@/lib/growth-send-policy';

export const runtime = 'nodejs';
const TYPES = ['repeat_purchase', 'feedback', 'review', 'reactivation', 'renewal', 'loyalty'] as const;
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const LEAD_FIELDS = 'id,name,email,phone,status,consent_to_contact,contact_opted_out_at,channel_consents,channel_suppressions,email_bounced_at,email_complained_at,conversation_id';

async function access(db: any, userId: string, organizationId: string, write = false) {
  return Boolean(organizationId)
    && await requireGrowthRole(db, userId, organizationId, write ? ['owner', 'manager', 'editor'] : ['owner', 'manager', 'editor', 'viewer', 'client'])
    && await requireGrowthFeature(db, userId, organizationId, 'crm');
}

function channelEligibility(lead: any, channel: 'email' | 'whatsapp' | 'sms') {
  const policy = evaluateLeadChannelSuppression(lead, channel);
  if (channel === 'email' && !lead?.email) return { allowed: false, reason: 'Customer email address is missing.' };
  if (channel !== 'email' && !lead?.phone) return { allowed: false, reason: 'Customer phone number is missing.' };
  if (channel === 'sms' && !/^\+[1-9]\d{7,14}$/.test(String(lead?.phone || ''))) return { allowed: false, reason: 'Customer phone number must use E.164 format for SMS.' };
  if (!policy.allowed) return policy;
  return { allowed: true, reason: null };
}
function renderTemplate(template: string, lead: any) {
  return String(template || '').replaceAll('{{name}}', String(lead?.name || 'there')).replaceAll('{{email}}', String(lead?.email || '')).replaceAll('{{phone}}', String(lead?.phone || ''));
}

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = clean(req.nextUrl.searchParams.get('organizationId'), 80);
  if (!await access(ctx.db, ctx.userId, organizationId)) return apiJson({ error: 'Workspace CRM access denied.' }, 403);

  const [leadResult, activityResult, touchpointResult, templateResult] = await Promise.all([
    ctx.db.from('growth_leads').select(LEAD_FIELDS + ',created_at,lead_temperature,lead_score,source').eq('organization_id', organizationId).eq('status', 'won').order('created_at', { ascending: false }).limit(500),
    ctx.db.from('growth_lead_activities').select('lead_id,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(5000),
    ctx.db.from('growth_retention_touchpoints').select('id,lead_id,touchpoint_type,channel,subject,template_id,status,scheduled_at,approved_at,sent_at,failure_reason,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200),
    ctx.db.from('growth_whatsapp_templates').select('id,template_name,language,body_text,variables,approval_status').eq('organization_id', organizationId).eq('approval_status', 'approved').order('template_name', { ascending: true }).limit(100)
  ]);
  if (leadResult.error || activityResult.error || touchpointResult.error || templateResult.error) return apiJson({ error: 'Retention data is unavailable. Confirm the Module 13 migration is applied.' }, 503);

  const lastActivity = new Map<string, string>();
  for (const row of activityResult.data || []) if (row.lead_id && !lastActivity.has(row.lead_id)) lastActivity.set(row.lead_id, row.created_at);
  const now = Date.now();
  const customers = (leadResult.data || []).map((lead: any) => {
    const activityAt = lastActivity.get(lead.id) || lead.created_at;
    const daysSinceActivity = Math.max(0, Math.floor((now - Date.parse(activityAt)) / 86400000));
    const segment = daysSinceActivity >= 61 ? 'dormant' : daysSinceActivity >= 31 ? 'at_risk' : 'engaged';
    const email = channelEligibility(lead, 'email'), whatsapp = channelEligibility(lead, 'whatsapp'), sms = channelEligibility(lead, 'sms');
    return { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, leadTemperature: lead.lead_temperature, leadScore: lead.lead_score, lastActivityAt: activityAt, daysSinceActivity, segment, emailEligible: email.allowed, emailBlockReason: email.reason, whatsappEligible: whatsapp.allowed, whatsappBlockReason: whatsapp.reason, smsEligible: sms.allowed, smsBlockReason: sms.reason }; 
  });
  const counts = { engaged: customers.filter((x: any) => x.segment === 'engaged').length, atRisk: customers.filter((x: any) => x.segment === 'at_risk').length, dormant: customers.filter((x: any) => x.segment === 'dormant').length, emailEligible: customers.filter((x: any) => x.emailEligible).length, whatsappEligible: customers.filter((x: any) => x.whatsappEligible).length, smsEligible: customers.filter((x: any) => x.smsEligible).length };
  return apiJson({ customers, touchpoints: touchpointResult.data || [], approvedWhatsAppTemplates: templateResult.data || [], counts, limits: { customers: 500, activities: 5000, touchpoints: 200 }, segmentation: { method: 'days since last recorded CRM activity; falls back to customer created_at when no activity exists', engaged: '0–30 days', atRisk: '31–60 days', dormant: '61+ days', predictiveModel: false } });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId, 80), leadId = clean(body.leadId, 80);
    const type = clean(body.touchpointType, 40), channel = clean(body.channel || 'email', 20), subject = clean(body.subject || (body.channel === 'sms' ? 'Retention SMS' : body.channel === 'whatsapp' ? 'Retention WhatsApp' : ''), 180), messageBody = clean(body.messageBody, channel === 'sms' ? 1600 : channel === 'whatsapp' ? 3500 : 10000), templateId = clean(body.templateId, 80);
    const scheduledAt = typeof body.scheduledAt === 'string' && !Number.isNaN(Date.parse(body.scheduledAt)) ? new Date(body.scheduledAt).toISOString() : null;
    if (!organizationId || !leadId || !TYPES.includes(type as any) || !['email', 'whatsapp', 'sms'].includes(channel) || !subject || (channel !== 'whatsapp' && !messageBody) || !scheduledAt || (channel === 'whatsapp' && !templateId)) return apiJson({ error: 'Workspace, customer, touchpoint type, channel, message, and valid schedule are required. WhatsApp requires an approved template.' }, 400);
    if (!await access(ctx.db, ctx.userId, organizationId, true)) return apiJson({ error: 'CRM editor permission is required.' }, 403);
    if (channel === 'whatsapp' && !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'whatsapp')) return apiJson({ error: 'WhatsApp is not included in this workspace plan.' }, 402);
    if (channel === 'sms' && !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'sms')) return apiJson({ error: 'SMS is not included in this workspace plan.' }, 402);
    if (Date.parse(scheduledAt) < Date.now() - 60000) return apiJson({ error: 'Schedule must be in the future.' }, 400);
    const { data: lead } = await ctx.db.from('growth_leads').select(LEAD_FIELDS).eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (!lead || lead.status !== 'won') return apiJson({ error: 'A Won customer in this workspace is required.' }, 409);
    const eligibility = channelEligibility(lead, channel as any);
    if (!eligibility.allowed) return apiJson({ error: `Draft blocked: ${eligibility.reason}` }, 409);
    let template: any = null, previewBody = messageBody;
    if (channel === 'whatsapp') {
      const { data } = await ctx.db.from('growth_whatsapp_templates').select('id,template_name,language,body_text,variables,approval_status').eq('id', templateId).eq('organization_id', organizationId).maybeSingle();
      if (!data || data.approval_status !== 'approved') return apiJson({ error: 'Select a WhatsApp template confirmed as approved in WhatsApp Manager.' }, 409);
      template = data;
      const values = (Array.isArray(template.variables) ? template.variables : []).map((value: string) => renderTemplate(value, lead));
      previewBody = String(template.body_text || '').replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => values[Number(n) - 1] || '').slice(0, 3500);
    }
    const { data: row, error } = await ctx.db.from('growth_retention_touchpoints').insert({ organization_id: organizationId, lead_id: leadId, touchpoint_type: type, channel, subject, message_body: previewBody, template_id: template?.id || null, scheduled_at: scheduledAt, status: 'draft', created_by: ctx.userId }).select('id,lead_id,touchpoint_type,channel,subject,template_id,status,scheduled_at,created_at').single();
    if (error || !row) return apiJson({ error: 'Retention message draft could not be saved.' }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: leadId, activity_type: 'note', body: `Retention ${channel} draft created (${type}). It requires human approval and a fresh consent check before dispatch.`, created_by: ctx.userId, metadata: { retention_touchpoint_id: row.id, channel, template_id: template?.id || null, status: 'draft' } });
    return apiJson({ touchpoint: row, eligibility, message: 'Draft saved. A manager/editor must approve it before sending.' }, 201);
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
        if (cancelJobError) return apiJson({ error: 'Queued retention message could not be cancelled safely.' }, 500);
        if (!cancelledJob) return apiJson({ error: 'The retention message is already processing or completed and cannot be cancelled safely.' }, 409);
        if (item.channel === 'sms') await ctx.db.from('growth_sms_messages').update({ status: 'canceled', error_message: 'Retention touchpoint cancelled by workspace user.', updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('client_request_id', `retention-touchpoint:${item.id}`).in('status', ['queued', 'scheduled']);
      }
      const { data: cancelledTouchpoint, error } = await ctx.db.from('growth_retention_touchpoints').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', touchpointId).eq('organization_id', organizationId).eq('status', item.status).select('id').maybeSingle();
      if (error || !cancelledTouchpoint) return apiJson({ error: 'Touchpoint changed concurrently and could not be cancelled.' }, 409);
      return apiJson({ success: true, status: 'cancelled' });
    }
    if (!['draft', 'failed'].includes(item.status)) return apiJson({ error: 'Only a draft or failed touchpoint can be approved.' }, 409);
    if (Date.parse(item.scheduled_at) < Date.now() - 60000) return apiJson({ error: 'Scheduled time has passed. Create a new draft with a future schedule.' }, 409);
    const { data: lead } = await ctx.db.from('growth_leads').select(LEAD_FIELDS).eq('id', item.lead_id).eq('organization_id', organizationId).maybeSingle();
    if (!lead || lead.status !== 'won') return apiJson({ error: 'Customer is no longer an eligible Won customer.' }, 409);
    const channel = String(item.channel || 'email');
    if (channel === 'whatsapp' && !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'whatsapp')) return apiJson({ error: 'WhatsApp is not included in this workspace plan.' }, 402);
    if (channel === 'sms' && !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'sms')) return apiJson({ error: 'SMS is not included in this workspace plan.' }, 402);
    const eligibility = channelEligibility(lead, channel as any);
    if (!eligibility.allowed) return apiJson({ error: `Approval blocked: ${eligibility.reason}` }, 409);
    const idempotencyKey = `retention-touchpoint:${item.id}`;
    let jobType = 'send_email', payload: any = { lead_id: lead.id, subject: item.subject, text: item.message_body, retention_touchpoint_id: item.id };
    let smsMessageId: string | null = null, smsCurrentStatus: string | null = null;
    if (channel === 'whatsapp') {
      const templateId = String(item.template_id || '');
      const { data: approvedTemplate } = templateId ? await ctx.db.from('growth_whatsapp_templates').select('id,variables,approval_status').eq('id', templateId).eq('organization_id', organizationId).maybeSingle() : { data: null };
      if (!approvedTemplate || approvedTemplate.approval_status !== 'approved') return apiJson({ error: 'The WhatsApp template is no longer approved. Create a new draft with an approved template.' }, 409);
      const values = (Array.isArray(approvedTemplate.variables) ? approvedTemplate.variables : []).map((value: string) => renderTemplate(value, lead));
      jobType = 'send_whatsapp_template'; payload = { lead_id: lead.id, template_id: approvedTemplate.id, values, retention_touchpoint_id: item.id };
    } else if (channel === 'sms') {
      const { data: orgRow, error: policyError } = await ctx.db.from('growth_organizations').select('communication_policy').eq('id', organizationId).maybeSingle();
      if (policyError || !orgRow) return apiJson({ error: 'Workspace communication policy is unavailable.' }, 503);
      const { evaluateGrowthSendPolicy } = await import('@/lib/growth-send-policy');
      const policy = evaluateGrowthSendPolicy(orgRow.communication_policy, 'sms');
      if (!policy.allowed) return apiJson({ error: `Approval blocked: ${policy.reason}` }, 409);
      const clientRequestId = idempotencyKey;
      const { data: existingSms } = await ctx.db.from('growth_sms_messages').select('id,status').eq('organization_id', organizationId).eq('client_request_id', clientRequestId).maybeSingle();
      let sms = existingSms;
      if (!sms) {
        const { data: createdSms, error: smsError } = await ctx.db.from('growth_sms_messages').insert({ organization_id: organizationId, lead_id: lead.id, initiated_by: ctx.userId, to_phone: lead.phone, body: item.message_body, status: 'queued', provider_status: 'queued', consent_verified_at: new Date().toISOString(), client_request_id: clientRequestId, direction: 'outbound', status_updated_at: new Date().toISOString() }).select('id,status').single();
        if (smsError?.code === '23505') {
          const { data: racedSms } = await ctx.db.from('growth_sms_messages').select('id,status').eq('organization_id', organizationId).eq('client_request_id', clientRequestId).maybeSingle();
          sms = racedSms;
        } else if (smsError || !createdSms) return apiJson({ error: 'Approved SMS dispatch record could not be created.' }, 500);
        else sms = createdSms;
        if (!sms) return apiJson({ error: 'Approved SMS dispatch record could not be recovered after an idempotency conflict.' }, 500);
      }
      smsMessageId = String(sms.id);
      smsCurrentStatus = String((sms as any).status || 'queued');
      jobType = 'send_sms'; payload = { lead_id: lead.id, sms_message_id: sms.id, retention_touchpoint_id: item.id };
    }
    const { data: existingJob, error: existingJobError } = await ctx.db.from('growth_jobs').select('id,status,external_effect_started_at').eq('organization_id', organizationId).eq('job_type', jobType).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existingJobError) return apiJson({ error: 'Unable to verify the existing dispatch job safely.' }, 503);
    if (existingJob && ['queued', 'processing'].includes(String(existingJob.status))) {
      const { error: reconcileError } = await ctx.db.from('growth_retention_touchpoints').update({ status: 'queued', approved_by: ctx.userId, approved_at: item.approved_at || new Date().toISOString(), job_id: existingJob.id, failure_reason: null, updated_at: new Date().toISOString() }).eq('id', item.id).eq('organization_id', organizationId);
      if (reconcileError) return apiJson({ error: 'Existing dispatch is already active, but the touchpoint status needs reconciliation.' }, 500);
      return apiJson({ success: true, status: 'queued', duplicate: true, jobId: existingJob.id, message: 'This retention message already has an active provider job; no duplicate message was queued.' });
    }
    if (existingJob?.status === 'succeeded') {
      const sentAt = item.sent_at || new Date().toISOString();
      const { error: reconcileError } = await ctx.db.from('growth_retention_touchpoints').update({ status: 'sent', sent_at: sentAt, approved_by: ctx.userId, approved_at: item.approved_at || sentAt, job_id: existingJob.id, failure_reason: null, updated_at: sentAt }).eq('id', item.id).eq('organization_id', organizationId);
      if (reconcileError) return apiJson({ error: 'The provider job already succeeded; retention history reconciliation is still required.' }, 500);
      return apiJson({ success: true, status: 'sent', duplicate: true, jobId: existingJob.id, message: 'The provider job had already succeeded. Retention history was reconciled without sending again.' });
    }
    if (existingJob?.status === 'failed' && existingJob.external_effect_started_at) return apiJson({ error: 'The previous provider outcome is uncertain. Automatic retry is blocked to prevent duplicate customer messages; reconcile the provider result first.' }, 409);
    if (channel === 'sms' && ['accepted', 'sending', 'sent', 'delivered', 'read', 'outcome_unknown'].includes(String(smsCurrentStatus))) return apiJson({ error: 'The SMS record already shows a provider-accepted or uncertain outcome. Reconcile its delivery status before attempting another send.' }, 409);
    if (channel === 'sms' && smsMessageId) {
      const { error: smsResetError } = await ctx.db.from('growth_sms_messages').update({ status: 'queued', provider_status: 'queued', error_code: null, error_message: null, status_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', smsMessageId).eq('organization_id', organizationId).in('status', ['queued', 'scheduled', 'failed', 'canceled']);
      if (smsResetError) return apiJson({ error: 'SMS dispatch state could not be safely prepared for the approved job.' }, 500);
    }
    const { data: job, error: jobError } = await ctx.db.from('growth_jobs').upsert({ organization_id: organizationId, job_type: jobType, idempotency_key: idempotencyKey, payload, status: 'queued', run_at: item.scheduled_at, attempts: 0, max_attempts: 5, completed_at: null, locked_at: null, external_effect_started_at: null, last_error: null }, { onConflict: 'organization_id,job_type,idempotency_key' }).select('id').single();
    if (jobError || !job) {
      if (channel === 'sms') await ctx.db.from('growth_sms_messages').update({ status: 'failed', error_message: 'Retention SMS job could not be queued.', updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('client_request_id', idempotencyKey);
      return apiJson({ error: `Approved ${channel} message could not be queued.` }, 500);
    }
    const { error: updateError } = await ctx.db.from('growth_retention_touchpoints').update({ status: 'queued', approved_by: ctx.userId, approved_at: new Date().toISOString(), job_id: job.id, failure_reason: null, updated_at: new Date().toISOString() }).eq('id', item.id).eq('organization_id', organizationId);
    if (updateError) return apiJson({ error: `${channel} was queued but the retention record needs reconciliation.` }, 500);
    await ctx.db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: lead.id, activity_type: 'note', body: `Retention ${channel} message approved and queued for ${item.scheduled_at}. Provider dispatch will re-check consent, suppression and workspace send policy.`, created_by: ctx.userId, metadata: { retention_touchpoint_id: item.id, job_id: job.id, channel, status: 'queued' } });
    return apiJson({ success: true, status: 'queued', jobId: job.id, message: `Approved and queued. ${channel} consent, suppression and workspace send policy are checked again by the worker before provider dispatch.` });
  } catch { return apiJson({ error: 'Retention approval request failed.' }, 400); }
}
