import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enforceGrowthRateLimit } from '@/lib/growth-rate-limit';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';

export async function GET(req: NextRequest) {
  if (!supabaseUrl || !serviceKey) return json({ error: 'Chat service is not configured.' }, 503);
  const slug = String(req.nextUrl.searchParams.get('slug') || '').trim().toLowerCase();
  const conversationId = String(req.nextUrl.searchParams.get('conversationId') || '');
  const visitorId = String(req.nextUrl.searchParams.get('visitorId') || '');
  if (!slug || !conversationId || !visitorId) return json({ error: 'Workspace, conversation and visitor session are required.' }, 400);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: org } = await db.from('growth_organizations').select('id').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (!org) return json({ error: 'This AI assistant is not available.' }, 404);
  const { data: conversation, error } = await db.from('growth_conversations').select('id,messages,status,needs_human,last_message_at').eq('id', conversationId).eq('organization_id', org.id).eq('visitor_id', visitorId).maybeSingle();
  if (error || !conversation) return json({ error: 'Conversation not found for this visitor session.' }, 404);
  return json({ messages: Array.isArray(conversation.messages) ? conversation.messages : [], status: conversation.status, needsHuman: !!conversation.needs_human, lastMessageAt: conversation.last_message_at || null });
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceKey) return json({ error: 'Chat service is not configured.' }, 503);
  try {
    const body = await req.json();
    const slug = String(body.slug || '').trim().toLowerCase().slice(0, 100);
    const message = String(body.message || '').trim().slice(0, 3000);
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
    const visitorId = String(body.visitorId || '').slice(0, 100);
    if (!/^[a-z0-9-]{2,100}$/.test(slug) || !message || !visitorId) return json({ error: 'Valid workspace, visitor session and message are required.' }, 400);
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const rate = await enforceGrowthRateLimit(db, req, 'website-chat', 20, 60);
    if (!rate.allowed) return json({ error: 'Too many messages. Please wait before trying again.', retryAfter: rate.retryAfter }, 429);
    const { data: org, error: orgError } = await db.from('growth_organizations').select('id,name,brand_profile,knowledge_base,status').eq('slug', slug).eq('status', 'active').maybeSingle();
    if (orgError || !org) return json({ error: 'This AI assistant is not available.' }, 404);
    let conversation: any = null;
    if (conversationId) {
      const { data, error } = await db.from('growth_conversations').select('id,messages,needs_human,status').eq('id', conversationId).eq('organization_id', org.id).eq('visitor_id', visitorId).maybeSingle();
      if (error || !data) return json({ error: 'Conversation not found for this visitor session.' }, 404);
      conversation = data;
    }
    const history = Array.isArray(conversation?.messages) ? conversation.messages.slice(-12) : [];
    const now = new Date().toISOString();
    if (conversation?.needs_human || conversation?.status === 'handed_off') {
      const messages = [...history, { role: 'user', content: message, at: now }, { role: 'assistant', content: 'Your message has been shared with our team. A team member will reply here shortly.', at: now, source: 'human_handoff_ack' }].slice(-30);
      const { error } = await db.from('growth_conversations').update({ messages, last_message_at: now, updated_at: now }).eq('id', conversation.id).eq('organization_id', org.id).eq('visitor_id', visitorId);
      if (error) return json({ error: 'Could not update the conversation.' }, 500);
      return json({ answer: 'Your message has been shared with our team. A team member will reply here shortly.', conversationId: conversation.id, humanHandoff: true });
    }
    if (!openaiKey) return json({ error: 'AI response service is not configured. Please contact the business team.' }, 503);
    const quota = await consumeGrowthQuota(db, org.id, 'ai_messages', 1, undefined, { channel: 'website' });
    if (!quota.allowed) return json({ error: quotaErrorMessage(quota), quota }, quota.reason === 'quota_exceeded' ? 402 : 503);
    const system = `You are the website sales assistant for ${org.name}. Use only this business knowledge and do not invent prices, guarantees, delivery dates or capabilities. If information is missing, say the business team will confirm it. Be helpful, concise, professional and respond in the visitor's language. Collect requirements naturally. Never claim an enquiry is submitted unless the lead form is completed. Business knowledge: ${JSON.stringify(org.knowledge_base || {})}. Brand: ${JSON.stringify(org.brand_profile || {})}.`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, temperature: 0.4, max_tokens: 500, messages: [{ role: 'system', content: system }, ...history.filter((m: any) => ['user','assistant'].includes(m.role)).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 3000) })), { role: 'user', content: message }] }) });
    if (!response.ok) {
      const providerError = await response.json().catch(() => ({}));
      const providerMessage = String(providerError?.error?.message || 'OpenAI request failed.').slice(0, 500);
      const providerCode = String(providerError?.error?.code || providerError?.error?.type || 'openai_error').slice(0, 100);
      console.error('[growth-chat] OpenAI request failed', { status: response.status, code: providerCode, message: providerMessage, model });
      return json({ error: `OpenAI error (${response.status}): ${providerMessage}`, providerCode, model }, 502);
    }
    const result = await response.json();
    const answer = String(result.choices?.[0]?.message?.content || 'Please share your requirement and our team will help.').slice(0, 4000);
    const messages = [...history, { role: 'user', content: message, at: now }, { role: 'assistant', content: answer, at: now }].slice(-30);
    let id = conversation?.id;
    if (id) {
      const { error } = await db.from('growth_conversations').update({ messages, last_message_at: now, updated_at: now }).eq('id', id).eq('organization_id', org.id).eq('visitor_id', visitorId);
      if (error) return json({ error: 'Could not update this conversation.' }, 500);
    } else {
      const { data: created, error } = await db.from('growth_conversations').insert({ organization_id: org.id, visitor_id: visitorId, channel: 'website', messages, last_message_at: now }).select('id').single();
      if (error) return json({ error: 'Could not save this conversation.' }, 500);
      id = created.id;
    }
    const usage = result.usage || {};
    const { estimateOpenAICost } = await import('@/lib/growth-cost');
    await db.from('growth_usage_logs').insert({ organization_id: org.id, provider: 'openai', model, operation: 'website_chat', input_units: usage.prompt_tokens || 0, output_units: usage.completion_tokens || 0, estimated_cost: estimateOpenAICost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0) });
    return json({ answer, conversationId: id, humanHandoff: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    console.error('[growth-chat] Request failed', message);
    return json({ error: `Unable to process the request: ${message.slice(0, 300)}` }, 500);
  }
}
