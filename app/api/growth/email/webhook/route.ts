import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function verifySvix(raw: string, req: NextRequest, secret: string) {
  const id = req.headers.get('svix-id') || '';
  const timestamp = req.headers.get('svix-timestamp') || '';
  const signatures = req.headers.get('svix-signature') || '';
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64');
    return signatures.split(' ').some((part) => {
      const [version, value] = part.split(',');
      if (version !== 'v1' || !value) return false;
      const a = Buffer.from(expected), b = Buffer.from(value);
      return a.length === b.length && timingSafeEqual(a, b);
    });
  } catch { return false; }
}
const email = (value: unknown) => String(value || '').trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, '$1').slice(0, 320);

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !service) return json({ error: 'Inbound email webhook is not configured.' }, 503);
  const raw = await req.text();
  if (!verifySvix(raw, req, secret)) return json({ error: 'Invalid or expired webhook signature.' }, 401);
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const eventType = String(body.type || '');
  const data = body.data || {};
  const eventId = req.headers.get('svix-id') || '';
  const recipients = (Array.isArray(data.to) ? data.to : [data.to]).map(email).filter(Boolean);
  const sender = email(data.from);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  if (eventType === 'email.received') {
    const recipient = recipients[0];
    if (!recipient || !sender) return json({ received: true, ignored: true });
    const { data: inbox } = await db.from('growth_inbound_email_addresses')
      .select('organization_id,email_address').eq('email_address', recipient).eq('is_active', true).maybeSingle();
    if (!inbox) return json({ received: true, ignored: true, reason: 'unmapped_recipient' });
    const { data: inserted, error: eventError } = await db.from('growth_email_provider_events').insert({
      organization_id: inbox.organization_id, provider_event_id: eventId, event_type: eventType,
      recipient_email: recipient, sender_email: sender, provider_email_id: String(data.email_id || ''),
      payload: { subject: String(data.subject || '').slice(0, 300), email_id: String(data.email_id || '') }
    }).select('id').maybeSingle();
    if (eventError?.code === '23505') return json({ received: true, duplicate: true });
    if (eventError || !inserted) return json({ error: 'Unable to record inbound email event.' }, 500);
    const content = String(data.text || data.html || '').replace(/<[^>]*>/g, ' ').slice(0, 12000);
    const message = { role: 'user', content, at: new Date().toISOString(), email_id: String(data.email_id || ''), from: sender, to: recipient, subject: String(data.subject || '').slice(0, 300) };
    const visitorId = `email:${sender}`;
    const { data: existing } = await db.from('growth_conversations').select('id,messages')
      .eq('organization_id', inbox.organization_id).eq('channel', 'email').eq('visitor_id', visitorId).maybeSingle();
    if (existing) {
      const messages = Array.isArray(existing.messages) ? existing.messages : [];
      const { error } = await db.from('growth_conversations').update({
        messages: [...messages.slice(-99), message], status: 'open', needs_human: true,
        last_message_at: message.at, updated_at: message.at
      }).eq('id', existing.id).eq('organization_id', inbox.organization_id);
      if (error) return json({ error: 'Unable to append inbox message.' }, 500);
    } else {
      const { error } = await db.from('growth_conversations').insert({
        organization_id: inbox.organization_id, channel: 'email', visitor_id: visitorId,
        messages: [message], status: 'open', needs_human: true, last_message_at: message.at
      });
      if (error) return json({ error: 'Unable to create email conversation.' }, 500);
    }
    await db.from('growth_email_provider_events').update({ processed_at: new Date().toISOString() }).eq('id', inserted.id);
    return json({ received: true, processed: true });
  }

  if (['email.bounced', 'email.complained', 'email.delivery_delayed', 'email.delivered'].includes(eventType)) {
    const recipient = email(data.to || data.email || data.recipient);
    const { data: inserted, error } = await db.from('growth_email_provider_events').insert({
      provider_event_id: eventId, event_type: eventType, recipient_email: recipient || null,
      provider_email_id: String(data.email_id || ''), payload: data
    }).select('id').maybeSingle();
    if (error?.code === '23505') return json({ received: true, duplicate: true });
    if (error || !inserted) return json({ error: 'Unable to record email delivery event.' }, 500);
    if (recipient && ['email.bounced', 'email.complained'].includes(eventType)) {
      const field = eventType === 'email.bounced' ? 'email_bounced_at' : 'email_complained_at';
      const { data: leads } = await db.from('growth_leads').select('id,organization_id').eq('email', recipient);
      for (const lead of leads || []) {
        await db.from('growth_leads').update({ [field]: new Date().toISOString() }).eq('id', lead.id).eq('organization_id', lead.organization_id);
        await db.from('growth_email_provider_events').update({ organization_id: lead.organization_id }).eq('id', inserted.id);
      }
    }
    await db.from('growth_email_provider_events').update({ processed_at: new Date().toISOString() }).eq('id', inserted.id);
    return json({ received: true, processed: true });
  }
  return json({ received: true, ignored: true });
}
