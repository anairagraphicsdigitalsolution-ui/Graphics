import { NextRequest, NextResponse } from 'next/server';
import { growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
import { evaluateGrowthSendPolicy, evaluateLeadChannelSuppression } from '@/lib/growth-send-policy';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const org = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, org, ['owner', 'manager', 'agent'])) return json({ error: 'Workspace permission denied.' }, 403);
  const { data, error } = await ctx.db.from('growth_sms_messages').select('id,lead_id,to_phone,from_sender,body,status,provider_status,provider_message_sid,error_code,error_message,created_at,updated_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(100);
  if (error) return json({ error: 'Unable to load SMS history.' }, 500);
  return json({ messages: data || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json();
    const org = String(b.organizationId || ''), leadId = String(b.leadId || ''), body = String(b.message || '').trim();
    const requestId = String(b.clientRequestId || '');
    if (!org || !leadId || !/^[-a-zA-Z0-9_:]{8,120}$/.test(requestId) || !body || body.length > 1600) return json({ error: 'Workspace, lead, unique request ID and a message (1–1600 characters) are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, org, ['owner', 'manager'])) return json({ error: 'Only workspace owners and managers can initiate SMS.' }, 403);
    if (!await requireGrowthFeature(ctx.db, ctx.userId, org, 'sms')) return json({ error: 'SMS is not included in this workspace plan.' }, 402);
    const { data: lead } = await ctx.db.from('growth_leads').select('id,phone,consent_to_contact,contact_opted_out_at,channel_consents,channel_suppressions').eq('id', leadId).eq('organization_id', org).maybeSingle();
    if (!lead?.phone) return json({ error: 'Lead phone number was not found in this workspace.' }, 404);
    const suppression = evaluateLeadChannelSuppression(lead, 'sms');
    if (!suppression.allowed) return json({ error: suppression.reason }, 403);
    if (!/^\+[1-9]\d{7,14}$/.test(String(lead.phone))) return json({ error: 'Lead phone number must be in E.164 format, for example +919876543210.' }, 400);
    const { data: orgRow, error: policyError } = await ctx.db.from('growth_organizations').select('communication_policy').eq('id', org).maybeSingle();
    if (policyError || !orgRow) return json({ error: 'Workspace communication policy is unavailable.' }, 503);
    const policy = evaluateGrowthSendPolicy(orgRow.communication_policy, 'sms');
    if (!policy.allowed) return json({ error: policy.reason }, 409);
    const twilio = await getWorkspaceIntegration(ctx.db, org, 'twilio');
    const accountSid = String(twilio.credentials.account_sid || '').trim(), authToken = String(twilio.credentials.auth_token || '').trim();
    const from = String(twilio.settings.from_number || '').trim();
    const publicBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    if (!publicBase) return json({ error: 'NEXT_PUBLIC_APP_URL is required before enabling SMS delivery callbacks.' }, 503);
    if (!accountSid || !authToken || !from || twilio.status === 'disconnected') return json({ error: 'Connect Twilio in Integrations and configure Account SID, Auth Token and E.164 sender number.' }, 503);
    if (!/^\+[1-9]\d{7,14}$/.test(from)) return json({ error: 'Twilio sender number must be in E.164 format.' }, 503);
    const { data: existing } = await ctx.db.from('growth_sms_messages').select('id,status').eq('organization_id', org).eq('client_request_id', requestId).maybeSingle();
    if (existing) return json({ queued: true, duplicate: true, messageId: existing.id, status: existing.status }, 200);
    const now = new Date().toISOString();
    const { data: sms, error: smsError } = await ctx.db.from('growth_sms_messages').insert({
      organization_id: org, lead_id: leadId, initiated_by: ctx.userId, to_phone: lead.phone, from_sender: from,
      body, status: 'queued', provider_status: 'queued', consent_verified_at: now, client_request_id: requestId,
      direction: 'outbound', status_updated_at: now,
    }).select('id').single();
    if (smsError || !sms) {
      if (smsError?.code === '23505') {
        const { data: duplicate } = await ctx.db.from('growth_sms_messages').select('id,status').eq('organization_id', org).eq('client_request_id', requestId).maybeSingle();
        if (duplicate) return json({ queued: true, duplicate: true, messageId: duplicate.id, status: duplicate.status });
      }
      return json({ error: 'Unable to create SMS dispatch record.' }, 500);
    }
    const { data: job, error: jobError } = await ctx.db.from('growth_jobs').insert({ organization_id: org, job_type: 'send_sms', payload: { lead_id: leadId, sms_message_id: sms.id }, status: 'queued', run_at: now, max_attempts: 3 }).select('id').single();
    if (jobError || !job) {
      await ctx.db.from('growth_sms_messages').update({ status: 'failed', error_message: 'SMS job could not be queued.', updated_at: new Date().toISOString() }).eq('id', sms.id).eq('organization_id', org);
      return json({ error: 'SMS could not be queued. No provider request was made.' }, 500);
    }
    await ctx.db.from('growth_platform_audit_events').insert({ organization_id: org, actor_user_id: ctx.userId, event_type: 'growth.sms.queued', metadata: { sms_message_id: sms.id, job_id: job.id, lead_id: leadId } });
    return json({ queued: true, messageId: sms.id, jobId: job.id }, 202);
  } catch { return json({ error: 'Unable to queue SMS.' }, 500); }
}
