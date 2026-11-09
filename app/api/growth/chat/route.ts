import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enforceGrowthRateLimit } from '@/lib/growth-rate-limit';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceKey || !openaiKey) return json({ error: 'AI service is not configured. Please contact Anaira.' }, 503);
  try {
    const body = await req.json();
    const slug = String(body.slug || 'anaira-graphics-digital-solution').slice(0, 100);
    const message = String(body.message || '').trim().slice(0, 3000);
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
    const visitorId = String(body.visitorId || '').slice(0, 100);
    if (!message) return json({ error: 'Message is required.' }, 400);
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const rate = await enforceGrowthRateLimit(db, req, 'website-chat', 20, 60);
    if (!rate.allowed) return json({ error: 'Too many messages. Please wait before trying again.', retryAfter: rate.retryAfter }, 429);
    const { data: org, error: orgError } = await db.from('growth_organizations').select('id,name,brand_profile,knowledge_base,status').eq('slug', slug).eq('status', 'active').maybeSingle();
    if (orgError || !org) return json({ error: 'This AI assistant is not available.' }, 404);
    let conversation: any = null;
    if (conversationId) {
      const { data } = await db.from('growth_conversations').select('id,messages').eq('id', conversationId).eq('organization_id', org.id).maybeSingle();
      conversation = data;
    }
    const history = Array.isArray(conversation?.messages) ? conversation.messages.slice(-12) : [];
    const system = `You are the website sales assistant for ${org.name}. Use only this business knowledge and do not invent prices, guarantees, delivery dates or capabilities. If information is missing, say the Anaira team will confirm it. Be helpful, concise, professional and respond in the visitor's language. Collect requirements naturally. Never claim an enquiry is submitted unless the lead form is completed. Business knowledge: ${JSON.stringify(org.knowledge_base || {})}. Brand: ${JSON.stringify(org.brand_profile || {})}.`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, temperature: 0.4, max_tokens: 500, messages: [{ role: 'system', content: system }, ...history.filter((m: any) => ['user','assistant'].includes(m.role)).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 3000) })), { role: 'user', content: message }] }) });
    if (!response.ok) return json({ error: 'AI response is temporarily unavailable. Please try again.' }, 502);
    const result = await response.json();
    const answer = String(result.choices?.[0]?.message?.content || 'Please share your requirement and our team will help.').slice(0, 4000);
    const messages = [...history, { role: 'user', content: message, at: new Date().toISOString() }, { role: 'assistant', content: answer, at: new Date().toISOString() }].slice(-30);
    let id = conversation?.id;
    if (id) await db.from('growth_conversations').update({ messages, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', org.id);
    else {
      const { data: created, error } = await db.from('growth_conversations').insert({ organization_id: org.id, visitor_id: visitorId || null, channel: 'website', messages }).select('id').single();
      if (error) return json({ error: 'Could not save this conversation.' }, 500);
      id = created.id;
    }
    const usage = result.usage || {};
    const { estimateOpenAICost } = await import('@/lib/growth-cost');
    await db.from('growth_usage_logs').insert({ organization_id: org.id, provider: 'openai', model, operation: 'website_chat', input_units: usage.prompt_tokens || 0, output_units: usage.completion_tokens || 0, estimated_cost: estimateOpenAICost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0) });
    return json({ answer, conversationId: id });
  } catch { return json({ error: 'Unable to process the request.' }, 500); }
}
