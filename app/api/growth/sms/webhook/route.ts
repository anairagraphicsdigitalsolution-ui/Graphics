import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function validTwilioSignature(url: string, params: URLSearchParams, signature: string, token: string) {
  if (!signature || !token) return false;
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  let payload = url;
  for (const [key, value] of entries) payload += key + value;
  const expected = createHmac('sha1', token).update(payload).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
const digits = (v: string) => v.replace(/\D/g, '');

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return json({ error: 'SMS webhook is not configured.' }, 503);
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const to = String(params.get('To') || ''), sid = String(params.get('MessageSid') || params.get('SmsSid') || '');
  if (!to || !sid) return json({ error: 'Twilio message reference is missing.' }, 400);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let organizationId = '';
  const statusCallback = Boolean(params.get('MessageStatus') || params.get('SmsStatus'));
  if (statusCallback) {
    const { data: message } = await db.from('growth_sms_messages').select('organization_id').eq('provider_message_sid', sid).maybeSingle();
    organizationId = String(message?.organization_id || '');
  }
  if (!organizationId) {
    const mappedNumber = statusCallback ? String(params.get('From') || '') : to;
    const { data: rows } = await db.from('growth_integrations').select('organization_id').eq('provider', 'twilio').eq('settings->>from_number', mappedNumber).limit(10);
    organizationId = String(rows?.[0]?.organization_id || '');
  }
  if (!organizationId) return json({ received: true, ignored: true, reason: 'unmapped_twilio_number' });
  const integration = await getWorkspaceIntegration(db, organizationId, 'twilio');
  const authToken = String(integration.credentials.auth_token || '');
  if (!validTwilioSignature(req.url, params, req.headers.get('x-twilio-signature') || '', authToken)) return json({ error: 'Invalid Twilio webhook signature.' }, 401);
  const eventType = params.get('MessageStatus') || params.get('SmsStatus') || 'inbound';
  const eventKey = `${sid}:${eventType}:${params.get('ErrorCode') || ''}`;
  const { data: newEvent, error: eventError } = await db.from('growth_sms_provider_events').insert({ organization_id: organizationId, event_key: eventKey, provider_message_sid: sid, event_type: eventType, provider_status: eventType, payload: Object.fromEntries(params.entries()) }).select('id').maybeSingle();
  if (eventError?.code === '23505') {
    const { data: priorEvent } = await db.from('growth_sms_provider_events').select('id,processed_at').eq('organization_id', organizationId).eq('event_key', eventKey).maybeSingle();
    if (priorEvent?.processed_at) return json({ received: true, duplicate: true });
  } else if (eventError || !newEvent) return json({ error: 'Unable to record SMS provider event.' }, 500);
  const now = new Date().toISOString();
  if (['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'canceled'].includes(eventType)) {
    const patch: any = { provider_status: eventType, status: eventType, status_updated_at: now, updated_at: now };
    if (params.get('ErrorCode')) patch.error_code = params.get('ErrorCode');
    if (params.get('ErrorMessage')) patch.error_message = String(params.get('ErrorMessage')).slice(0, 500);
    const { data: updated, error } = await db.from('growth_sms_messages').update(patch).eq('provider_message_sid', sid).eq('organization_id', organizationId).select('id').maybeSingle();
    if (error) return json({ error: 'Unable to update SMS delivery status.' }, 500);
    if (!updated) return json({ received: true, queuedForReconciliation: true }, 202);
    await db.from('growth_sms_provider_events').update({ processed_at: now }).eq('organization_id', organizationId).eq('event_key', eventKey);
    return json({ received: true, processed: true });
  }
  const from = String(params.get('From') || ''), text = String(params.get('Body') || '').slice(0, 1600);
  if (!from || !text) return json({ received: true, ignored: true, reason: 'empty_inbound_message' });
  const { data: existing } = await db.from('growth_conversations').select('id,messages').eq('organization_id', organizationId).eq('channel', 'sms').eq('visitor_id', from).maybeSingle();
  const message = { role: 'user', content: text, at: now, provider_message_id: sid, from, to };
  if (existing) {
    const messages = Array.isArray(existing.messages) ? existing.messages : [];
    const { error } = await db.from('growth_conversations').update({ messages: [...messages.slice(-99), message], status: 'open', needs_human: true, last_message_at: now, updated_at: now }).eq('id', existing.id).eq('organization_id', organizationId);
    if (error) return json({ error: 'Unable to append inbound SMS to inbox.' }, 500);
  } else {
    const { error } = await db.from('growth_conversations').insert({ organization_id: organizationId, channel: 'sms', visitor_id: from, messages: [message], status: 'open', needs_human: true, last_message_at: now });
    if (error) return json({ error: 'Unable to create inbound SMS conversation.' }, 500);
  }
  const { data: lead } = await db.from('growth_leads').select('id').eq('organization_id', organizationId).eq('phone', from).maybeSingle();
  const normalized = text.trim().toUpperCase();
  if (lead && ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(normalized)) {
    await db.rpc('growth_set_lead_channel_consent', { p_organization_id: organizationId, p_lead_id: lead.id, p_actor_user_id: null, p_channel: 'sms', p_granted: false, p_source: 'twilio_sms_keyword_optout', p_method: 'sms_keyword' });
    await db.from('growth_lead_activities').insert({ organization_id: organizationId, lead_id: lead.id, activity_type: 'sms', body: 'Contact opted out of SMS using an inbound STOP keyword.', metadata: { provider: 'twilio', message_sid: sid } });
  }
  await db.from('growth_sms_provider_events').update({ processed_at: now }).eq('organization_id', organizationId).eq('event_key', eventKey);
  return json({ received: true, processed: true, channel: 'sms' });
}
