import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
export const runtime = 'nodejs';
const xml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c));
export async function POST(req:NextRequest){
 const form=await req.formData();const fields:Record<string,string>={};form.forEach((v,k)=>fields[k]=String(v));
 const attemptId=new URL(req.url).searchParams.get('attemptId')||'',url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!attemptId||!url||!key)return new NextResponse('Configuration error',{status:503});
 const db=createClient(url,key,{auth:{persistSession:false}});const {data:attempt}=await db.from('growth_voice_call_attempts').select('id,organization_id,lead_id,script_text,provider_call_id').eq('id',attemptId).maybeSingle();
 if(!attempt)return new NextResponse('Call attempt not found',{status:404});
 const twilio=await getWorkspaceIntegration(db,attempt.organization_id,'twilio');const token=twilio.credentials.auth_token||process.env.TWILIO_AUTH_TOKEN||'',sig=req.headers.get('x-twilio-signature')||'';
 const expected=createHmac('sha1',token).update(Object.keys(fields).sort().reduce((out,k)=>out+k+fields[k],req.url)).digest('base64');
 const a=Buffer.from(expected),b=Buffer.from(sig);if(!token||!sig||a.length!==b.length||!timingSafeEqual(a,b))return new NextResponse('Forbidden',{status:403});
 const ws=(twilio.settings.voice_agent_ws_url||process.env.VOICE_AGENT_WS_URL||'').trim();let body='';
 if(ws&&/^wss:\/\//i.test(ws)){
  await db.from('growth_voice_call_attempts').update({conversation_mode:'conversation_relay'}).eq('id',attempt.id);
  body=`<Response><Connect><ConversationRelay url="${xml(ws)}" language="en-US"><Parameter name="attemptId" value="${xml(attempt.id)}"/><Parameter name="organizationId" value="${xml(attempt.organization_id)}"/><Parameter name="leadId" value="${xml(attempt.lead_id)}"/><Parameter name="systemPrompt" value="${xml(attempt.script_text.slice(0,900))}"/></ConversationRelay></Connect></Response>`;
 }else{
  body=`<Response><Say voice="alice">${xml(attempt.script_text)}</Say><Pause length="1"/><Say voice="alice">Thank you. Goodbye.</Say></Response>`;
 }
 return new NextResponse(body,{headers:{'Content-Type':'text/xml; charset=utf-8','Cache-Control':'no-store'}});
}
