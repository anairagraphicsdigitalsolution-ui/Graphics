import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { apiJson } from '@/lib/growth-server';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
export const runtime = 'nodejs';

function validTwilioSignature(req: NextRequest, fields: Record<string, string>, token: string) {
  const signature = req.headers.get('x-twilio-signature') || '';
  if (!token || !signature) return false;
  const url = req.url;
  const data = Object.keys(fields).sort().reduce((out, key) => out + key + fields[key], url);
  const expected = createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fields: Record<string, string> = {};
  form.forEach((value, key) => { fields[key] = String(value); });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return apiJson({ error: 'Database worker is not configured.' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const callSid = String(fields.CallSid || '');
  const attemptId=req.nextUrl.searchParams.get('attemptId')||'';
  const {data:matchedAttempt}=attemptId?await db.from('growth_voice_call_attempts').select('organization_id').eq('id',attemptId).maybeSingle():await db.from('growth_voice_call_attempts').select('organization_id').eq('provider_call_id',callSid).maybeSingle();
  const twilio=matchedAttempt?await getWorkspaceIntegration(db,matchedAttempt.organization_id,'twilio'):null;
  const signingToken=twilio?.credentials.auth_token||process.env.TWILIO_AUTH_TOKEN||'';
  if(!validTwilioSignature(req,fields,signingToken))return apiJson({error:'Invalid Twilio webhook signature.'},403);
  const statusRaw = String(fields.CallStatus || '').toLowerCase().replace(/-/g, '_');
  const allowed = new Set(['queued','initiated','ringing','in_progress','completed','busy','failed','no_answer','canceled']);
  if (!callSid || !allowed.has(statusRaw)) return apiJson({ error: 'Missing call SID or unsupported call status.' }, 400);
  const update: Record<string, unknown> = { call_status: statusRaw, updated_at: new Date().toISOString(), provider_payload: { callback: fields } };
  if (fields.CallDuration && /^\d+$/.test(fields.CallDuration)) update.call_duration_seconds = Number(fields.CallDuration);
  if (fields.RecordingUrl) update.recording_url = fields.RecordingUrl.slice(0, 1000);
  if (fields.RecordingSid) update.recording_sid = fields.RecordingSid.slice(0, 100);
  const { data, error } = await db.from('growth_voice_call_attempts').update(update).eq('provider_call_id', callSid).select('id,organization_id,lead_id,call_status').maybeSingle();
  if (error) return apiJson({ error: 'Call status could not be persisted.' }, 500);
  if (!data) return apiJson({ received: true, matched: false });
  await db.from('growth_platform_audit_events').insert({ organization_id: data.organization_id, event_type: 'growth.voice_call.status_updated', metadata: { attempt_id: data.id, lead_id: data.lead_id, call_sid: callSid, status: statusRaw } });
  return apiJson({ received: true, matched: true, status: data.call_status });
}
