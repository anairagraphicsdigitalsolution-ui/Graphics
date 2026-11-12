import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 8080);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !supabaseUrl || !serviceKey) throw new Error('OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const publicWsUrl = process.env.VOICE_AGENT_WS_URL?.trim();
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN?.trim();
if (!publicWsUrl || !/^wss:\/\//i.test(publicWsUrl) || !twilioAuthToken) throw new Error('VOICE_AGENT_WS_URL (exact public wss URL) and TWILIO_AUTH_TOKEN are required for secure ConversationRelay.');
const expectedWsPath = new URL(publicWsUrl).pathname || '/';
function validTwilioHandshake(info) {
  const signature = String(info.req.headers['x-twilio-signature'] || '');
  const requestPath = String(info.req.url || '/').split('?')[0];
  if (!signature || requestPath !== expectedWsPath) return false;
  const expected = createHmac('sha1', twilioAuthToken).update(publicWsUrl).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
const server = new WebSocketServer({ port, path: expectedWsPath, verifyClient: (info, done) => done(validTwilioHandshake(info), validTwilioHandshake(info) ? 200 : 403, 'Invalid Twilio signature') });

async function complete(messages, systemPrompt, maxTokens = 220) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.35, max_tokens: maxTokens, messages: [{ role: 'system', content: systemPrompt }, ...messages] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI returned ${response.status}`);
  return String(data.choices?.[0]?.message?.content || '').slice(0, 1600);
}

const OPT_OUT = /\b(do not call|don't call|stop calling|remove me|unsubscribe|opt ?out|no more calls|never call)\b/i;
const END_CALL = /\b(goodbye|bye|end the call|hang up)\b/i;
async function finalizeCall({ attemptId, organizationId, leadId, messages, optedOut }) {
  if (!attemptId || !organizationId) return;
  const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 16000);
  let summary = 'Call ended; summary unavailable.';
  try {
    const raw = await complete([{ role: 'user', content: `Summarize this business call in JSON with keys summary, outcome, intent, objections, next_step. Keep summary under 500 characters and next_step under 240 characters. Transcript:\n${transcript}` }], 'You create factual CRM call summaries. Return valid JSON only. Do not infer facts not stated.', 260);
    const parsed = JSON.parse(raw);
    summary = [parsed.summary, `Outcome: ${parsed.outcome || 'unknown'}`, `Intent: ${parsed.intent || 'unknown'}`, `Objections: ${parsed.objections || 'none stated'}`, `Next step: ${parsed.next_step || 'human review'}`].join('\n').slice(0, 1400);
  } catch { /* retain a truthful fallback rather than failing call finalization */ }
  await db.from('growth_voice_call_attempts').update({ transcript, call_summary: summary, updated_at: new Date().toISOString() }).eq('id', attemptId).eq('organization_id', organizationId);
  if (optedOut && leadId) {
    const now = new Date().toISOString();
    await db.from('growth_leads').update({ consent_to_contact: false, contact_opted_out_at: now, contact_opt_out_source: 'voice_call_verbal_request', updated_at: now }).eq('id', leadId).eq('organization_id', organizationId);
    await db.from('growth_platform_audit_events').insert({ organization_id: organizationId, event_type: 'growth.voice_call.opt_out', metadata: { attempt_id: attemptId, lead_id: leadId, source: 'voice_call_verbal_request' } });
  }
}

server.on('connection', (socket) => {
  let attemptId = '', organizationId = '', leadId = '', systemPrompt = 'Introduce the business purpose and ask whether the person is available to talk.';
  const messages = []; let stopped = false, optedOut = false, processing = Promise.resolve();
  const send = (token, lang) => { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'text', token, last: true, ...(typeof lang === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(lang) ? { lang } : {}) })); };
  const endSession = () => { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'end' })); };
  const finalize = async () => { if (stopped) return; stopped = true; await finalizeCall({ attemptId, organizationId, leadId, messages, optedOut }); };
  socket.on('message', (raw) => {
    processing = processing.then(async () => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'setup') {
        const params = msg.customParameters || {};
        attemptId = String(params.attemptId || ''); organizationId = String(params.organizationId || ''); leadId = String(params.leadId || '');
        systemPrompt = String(params.systemPrompt || systemPrompt).slice(0, 1000);
        if (attemptId) {
          const { data: attempt } = await db.from('growth_voice_call_attempts').select('id,organization_id,lead_id,provider_call_id').eq('id', attemptId).eq('organization_id', organizationId).maybeSingle();
          if (!attempt || attempt.lead_id !== leadId || (attempt.provider_call_id && attempt.provider_call_id !== String(msg.callSid || ''))) { socket.close(1008, 'Call identity mismatch'); return; }
          await db.from('growth_voice_call_attempts').update({ conversation_mode: 'conversation_relay', call_status: 'in_progress', provider_call_id: String(msg.callSid || '') }).eq('id', attemptId).eq('organization_id', organizationId);
        } else { socket.close(1008, 'Missing call identity'); return; }
        const greeting = 'Hello, this is an AI assistant calling on behalf of the business. This call uses an AI assistant. Is this a convenient time for a brief conversation?';
        messages.push({ role: 'assistant', content: greeting }); send(greeting);
      } else if (msg.type === 'prompt' && !stopped) {
        const spoken = String(msg.voicePrompt || msg.text || '').trim().slice(0, 1800);
        if (!spoken) return;
        messages.push({ role: 'user', content: spoken });
        if (OPT_OUT.test(spoken)) {
          optedOut = true;
          const reply = 'I understand. I will mark that you do not want further calls from this business. Goodbye.';
          messages.push({ role: 'assistant', content: reply }); send(reply, msg.lang); await finalize(); endSession(); return;
        }
        if (/\b(speak to (a person|someone|human)|real person|human agent)\b/i.test(spoken)) {
          const reply = 'Of course. I will ask a team member to follow up with you. Thank you.';
          messages.push({ role: 'assistant', content: reply }); send(reply, msg.lang);
          await db.from('growth_tasks').insert({ organization_id: organizationId, lead_id: leadId, title: 'Human follow-up requested during AI voice call', description: `Lead requested a human representative. Voice call attempt: ${attemptId}`, task_type: 'follow_up' }); return;
        }
        try {
          const reply = await complete(messages.slice(-14), `${systemPrompt}\nRespond in the caller's language. Keep each response concise and conversational. Ask one question at a time. Do not claim facts not provided. Respect refusal immediately. If asked not to call again, acknowledge and end politely. Never request passwords, OTPs, payment card details or sensitive personal data.`, 220);
          const safeReply = reply || 'I am sorry, could you please repeat that?';
          messages.push({ role: 'assistant', content: safeReply }); send(safeReply, msg.lang);
          if (END_CALL.test(spoken)) { await finalize(); endSession(); }
        } catch {
          const fallback = 'I am having a technical issue. I will arrange for a team member to follow up. Thank you.';
          messages.push({ role: 'assistant', content: fallback }); send(fallback, msg.lang);
        }
      } else if (msg.type === 'interrupt') {
        // ConversationRelay sends interrupt events when the caller speaks over the agent.
        // The next response is generated from the caller's latest prompt, not stale assistant text.
        messages.push({ role: 'system', content: 'Caller interrupted. Stop the previous response and address the latest caller input.' });
      } else if (msg.type === 'stop') await finalize();
    }).catch(() => {});
  });
  socket.on('close', () => { processing = processing.then(finalize).catch(() => {}); });
});
console.log(`Anaira ConversationRelay listening on :${port}/twilio/voice`);
