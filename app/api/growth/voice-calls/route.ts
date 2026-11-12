import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
import {getWorkspaceIntegration} from '@/lib/growth-integrations';
export const runtime='nodejs';
const enc=(v:string)=>Buffer.from(v).toString('base64');
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),leadId=String(b.leadId||''),script=String(b.script||'').trim().slice(0,3500);
  if(!orgId||!leadId||!script)return apiJson({error:'Workspace, lead and approved call script are required.'},400);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const {data:lead,error}=await c.db.from('growth_leads').select('id,name,phone,consent_to_contact,contact_opted_out_at').eq('id',leadId).eq('organization_id',orgId).maybeSingle();
  if(error||!lead?.phone)return apiJson({error:'Lead not found or phone missing.'},404);
  if(!lead.consent_to_contact||lead.contact_opted_out_at)return apiJson({error:'Explicit contact consent is required. Opted-out leads cannot be called.'},403);
  const to=String(lead.phone).trim();if(!/^\+[1-9]\d{7,14}$/.test(to))return apiJson({error:'Phone must be E.164 format, including country code.'},400);
  const twilio=await getWorkspaceIntegration(c.db,orgId,'twilio');
  const sid=(twilio.credentials.account_sid||process.env.TWILIO_ACCOUNT_SID||'').trim(),token=(twilio.credentials.auth_token||process.env.TWILIO_AUTH_TOKEN||'').trim(),from=(twilio.settings.from_number||process.env.TWILIO_VOICE_FROM||'').trim(),base=(twilio.settings.app_base_url||process.env.APP_BASE_URL||'').trim();
  if(!sid||!token||!from||!base)return apiJson({error:'Outbound voice provider is not configured. Save Twilio Account SID, Auth Token, From Number and Public App URL under Integrations, or configure the server environment variables.'},503);
  const {data:attempt,error:attemptError}=await c.db.from('growth_voice_call_attempts').insert({organization_id:orgId,lead_id:leadId,provider:'twilio',destination_phone:to,script_text:script,consent_verified_at:new Date().toISOString(),initiated_by:c.userId,call_status:'initiated'}).select('id').single();
  if(attemptError||!attempt)return apiJson({error:'Could not create voice call audit record. Apply the v6.84.9 migration.'},503);
  const callbackBase=`${base.replace(/\/$/,'')}/api/growth/voice-calls`;
  const form=new URLSearchParams({To:to,From:from,Url:`${callbackBase}/twiml?attemptId=${encodeURIComponent(attempt.id)}`,Method:'POST',StatusCallback:`${callbackBase}/status?attemptId=${encodeURIComponent(attempt.id)}`,StatusCallbackEvent:'initiated ringing answered completed',StatusCallbackMethod:'POST'});
  const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,{method:'POST',headers:{Authorization:`Basic ${enc(`${sid}:${token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:form,cache:'no-store'});const data=await r.json().catch(()=>({}));
  if(!r.ok){await c.db.from('growth_voice_call_attempts').update({call_status:'failed',provider_payload:{error:data.message||'Provider rejected call'},updated_at:new Date().toISOString()}).eq('id',attempt.id).eq('organization_id',orgId);return apiJson({error:data.message||'Voice provider rejected the call.'},502);}
  await c.db.from('growth_voice_call_attempts').update({provider_call_id:String(data.sid),call_status:String(data.status||'queued').replace('-','_'),provider_payload:{provider_status:data.status},updated_at:new Date().toISOString()}).eq('id',attempt.id).eq('organization_id',orgId);
  await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'growth.voice_call.started',metadata:{lead_id:leadId,provider:'twilio',call_sid:data.sid,status:data.status}});
  return apiJson({success:true,provider:'twilio',callSid:data.sid,status:data.status,leadId,notice:process.env.VOICE_AGENT_WS_URL?'Outbound call initiated with the configured two-way ConversationRelay agent.':'Outbound call initiated in scripted text-to-speech fallback mode; configure VOICE_AGENT_WS_URL for two-way AI conversation.'},201);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Voice call failed.'},500);}
}
