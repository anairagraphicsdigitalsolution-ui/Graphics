import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { runLeadCreatedRules } from '@/lib/growth-automation';
import { estimateOpenAICost } from '@/lib/growth-cost';
import { consumeGrowthQuota } from '@/lib/growth-quota';
import { getWorkspaceIntegration, getWorkspaceAccessToken } from '@/lib/growth-integrations';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function validSignature(raw: string, signature: string, secret: string) {
  try {
    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.META_WEBHOOK_VERIFY_TOKEN && q.get('hub.challenge')) {
    return new Response(q.get('hub.challenge'), { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const version = process.env.META_GRAPH_API_VERSION;
  if (!secret || !url || !serviceKey || !version) return json({ error: 'Meta messaging webhook is not configured.' }, 503);
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256') || '', secret)) return json({ error: 'Invalid webhook signature.' }, 401);
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!['page', 'instagram'].includes(String(payload.object))) return json({ received: true, ignored: true });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  let received = 0, processed = 0, ignored = 0, failed = 0;
  for (const entry of payload.entry || []) {
    const platform = payload.object === 'instagram' ? 'instagram' : 'facebook';
    const externalId = String(entry.id || '');
    if (!externalId) { ignored++; continue; }
    const { data: account } = await db.from('growth_social_accounts')
      .select('id,organization_id,platform,external_account_id,encrypted_credentials,account_name')
      .eq('platform', platform).eq('external_account_id', externalId).eq('connection_status', 'connected').maybeSingle();
    if (!account?.encrypted_credentials) { ignored++; continue; }

    for (const event of entry.messaging || []) {
      const message = event.message;
      const mid = String(message?.mid || '');
      const senderId = String(event.sender?.id || '');
      const text = String(message?.text || '').trim().slice(0, 3000);
      if (!mid || !senderId || !text || event.message?.is_echo || event.read || event.delivery) { ignored++; continue; }
      received++;
      const eventKey = `${platform}_dm:${mid}`;
      const { data: inserted, error: insertError } = await db.from('growth_webhook_events').upsert({
        organization_id: account.organization_id, provider: 'meta', event_type: platform === 'instagram' ? 'instagram_dm' : 'facebook_messenger',
        event_key: eventKey, payload: { sender_id: senderId, recipient_id: externalId, message_id: mid, text }, processing_status: 'received'
      }, { onConflict: 'provider,event_key', ignoreDuplicates: true }).select('id').maybeSingle();
      if (insertError) { failed++; continue; }
      if (!inserted) { ignored++; continue; }
      try {
        const { data: claimed } = await db.from('growth_webhook_events').update({ processing_status: 'processing' }).eq('id', inserted.id).eq('processing_status', 'received').select('id').maybeSingle();
        if (!claimed) { ignored++; continue; }
        const { data: org } = await db.from('growth_organizations').select('id,name,knowledge_base,brand_profile').eq('id', account.organization_id).eq('status', 'active').maybeSingle();
        if (!org) throw new Error('Growth organization is inactive or missing.');
        const aiIntegration = await getWorkspaceIntegration(db, org.id, 'openai');
        const openai = String(aiIntegration.credentials.api_key || process.env.OPENAI_API_KEY || '').trim();
        const aiModel = String(aiIntegration.settings.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini').trim();
        if (!openai) throw new Error('OpenAI is not configured for this workspace.');
        const accessToken = await getWorkspaceAccessToken(db, org.id, platform === 'instagram' ? 'instagram' : 'meta', externalId);
        const channel = platform === 'instagram' ? 'instagram' : 'facebook_messenger';
        const { data: conv } = await db.from('growth_conversations').select('id,messages,status,needs_human').eq('organization_id', org.id).eq('channel', channel).eq('visitor_id', senderId).maybeSingle();
        const history = Array.isArray(conv?.messages) ? conv.messages.slice(-12) : [];
        if (conv?.needs_human || conv?.status === 'handed_off') { const now=new Date().toISOString(); await db.from('growth_conversations').update({messages:[...history,{role:'user',content:text,at:now,recipient_account_id:externalId}],last_message_at:now,updated_at:now}).eq('id',conv.id); await db.from('growth_webhook_events').update({processing_status:'processed',processed_at:now}).eq('id',inserted.id); processed++; continue; }
        const aiQuota=await consumeGrowthQuota(db,org.id,'ai_messages',1,`meta-ai:${eventKey}`,{channel});
        if(!aiQuota.allowed)throw new Error(aiQuota.reason==='quota_exceeded'?'AI message plan quota exceeded.':'Usage metering unavailable.');
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: aiModel, temperature: 0.35, max_tokens: 450, messages: [
            { role: 'system', content: `You are ${String(org.name||'this business')}'s ${platform === 'instagram' ? 'Instagram' : 'Facebook Messenger'} sales assistant. Reply in the customer's language. Follow this brand profile: ${JSON.stringify(org.brand_profile||{})}. Use only this approved knowledge: ${JSON.stringify(org.knowledge_base || {})}. Do not invent prices, guarantees, timelines or services. Ask concise questions to understand service, business type and budget. Do not claim a human has approved a quote or that marketing consent was given. If a human is requested, say the team will take over.` },
            ...history.filter((m: any) => ['user', 'assistant'].includes(m.role)).map((m: any) => ({ role: m.role, content: String(m.content || '').slice(0, 2000) })),
            { role: 'user', content: text }
          ] })
        });
        const ai = await aiRes.json();
        if (!aiRes.ok) throw new Error(ai.error?.message || 'AI response generation failed.');
        const answer = String(ai.choices?.[0]?.message?.content || 'Thank you for contacting Anaira. Our team will assist you.').slice(0, 1800);
        const now = new Date().toISOString();
        const messages = [...history, { role: 'user', content: text, at: now, recipient_account_id: externalId }, { role: 'assistant', content: answer, at: now }].slice(-30);
        let conversationId = conv?.id;
        if (conv) await db.from('growth_conversations').update({ messages, last_message_at: now, updated_at: now }).eq('id', conv.id);
        else {
          const { data: created, error } = await db.from('growth_conversations').insert({ organization_id: org.id, visitor_id: senderId, channel, messages, last_message_at: now }).select('id').single();
          if (error) throw new Error('Could not save messaging conversation.');
          conversationId = created.id;
        }
        const { data: existingLead } = await db.from('growth_leads').select('id').eq('organization_id', org.id).eq('source', platform === 'instagram' ? 'instagram_dm' : 'facebook_messenger').eq('external_contact_id', senderId).maybeSingle();
        if (!existingLead) {
          const { data: lead, error } = await db.from('growth_leads').insert({
            organization_id: org.id, conversation_id: conversationId, name: platform === 'instagram' ? 'Instagram Contact' : 'Facebook Contact',
            requirement: text, source: platform === 'instagram' ? 'instagram_dm' : 'facebook_messenger', external_contact_id: senderId,
            consent_to_contact: false, lead_temperature: 'warm', lead_score: 45
          }).select('id,name,phone,email,consent_to_contact').single();
          if (error) throw new Error('Could not create messaging lead in CRM.');
          await runLeadCreatedRules(db, org.id, lead);
        }
        const senderUrl = `https://graph.facebook.com/${version}/${encodeURIComponent(externalId)}/messages?access_token=${encodeURIComponent(accessToken)}`;
        const sendRes = await fetch(senderUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: { id: senderId }, message: { text: answer } }) });
        const sent = await sendRes.json();
        if (!sendRes.ok) throw new Error(sent.error?.message || 'Meta messaging reply failed. Check messaging permissions and reply window.');
        const input = Number(ai.usage?.prompt_tokens || 0), output = Number(ai.usage?.completion_tokens || 0);
        await db.from('growth_usage_logs').insert({ organization_id: org.id, provider: 'openai', model: aiModel, operation: `${platform}_dm_ai_reply`, input_units: input, output_units: output, estimated_cost: estimateOpenAICost(process.env.OPENAI_MODEL || 'gpt-4.1-mini', input, output) });
        await db.from('growth_webhook_events').update({ processing_status: 'processed', processed_at: now }).eq('id', inserted.id);
        processed++;
      } catch (error) {
        failed++;
        await db.from('growth_webhook_events').update({ processing_status: 'failed', error_message: error instanceof Error ? error.message.slice(0, 500) : 'Messaging event failed.' }).eq('id', inserted.id);
      }
    }
  }
  return json({ received: true, received_messages: received, processed, ignored, failed });
}
