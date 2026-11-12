import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole,requireGrowthFeature} from '@/lib/growth-server';
import {getWhatsAppCredentials} from '@/lib/growth-whatsapp';

export const runtime='nodejs';

/** Requests explicit WhatsApp Business Calling permission. This does not place a call. */
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),leadId=String(b.leadId||''),body=String(b.body||'Our team would like to call you on WhatsApp about your enquiry. Do you allow us to call you?').trim().slice(0,1024);
  if(!orgId||!leadId||!body)return apiJson({error:'Workspace, lead and permission message are required.'},400);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Only workspace owners and managers can request call permission.'},403);
  if(!await requireGrowthFeature(c.db,c.userId,orgId,'whatsapp'))return apiJson({error:'WhatsApp is not included in this workspace plan.'},402);
  const {data:lead,error:leadError}=await c.db.from('growth_leads').select('id,phone,conversation_id,contact_opted_out_at').eq('id',leadId).eq('organization_id',orgId).maybeSingle();
  if(leadError||!lead?.phone)return apiJson({error:'Lead not found or phone number missing.'},404);
  if(lead.contact_opted_out_at)return apiJson({error:'This lead has opted out. Do not contact them.'},403);
  const digits=String(lead.phone).replace(/\D/g,'');if(digits.length<8||digits.length>15)return apiJson({error:'Lead phone must be stored in international format.'},400);
  if(!lead.conversation_id)return apiJson({error:'A recent WhatsApp conversation is required for an interactive permission request. A pre-approved call-permission template is needed outside the 24-hour window.'},409);
  const {data:conv}=await c.db.from('growth_conversations').select('messages,channel_phone_number_id,channel').eq('id',lead.conversation_id).eq('organization_id',orgId).maybeSingle();
  if(!conv||conv.channel!=='whatsapp')return apiJson({error:'No WhatsApp conversation is associated with this lead.'},409);
  const lastInbound=[...(Array.isArray(conv.messages)?conv.messages:[])].reverse().find((m:any)=>m?.role==='user'&&m?.at);
  const inboundAt=lastInbound?.at?Date.parse(lastInbound.at):NaN;
  if(!Number.isFinite(inboundAt)||Date.now()-inboundAt>24*60*60*1000)return apiJson({error:'The customer service window is closed. Use an approved call-permission template integration.'},409);
  const now=Date.now();
  const {data:recent,error:recentError}=await c.db.from('growth_whatsapp_call_permissions').select('requested_at,permission_status').eq('organization_id',orgId).eq('lead_id',leadId).gte('requested_at',new Date(now-7*24*60*60*1000).toISOString()).order('requested_at',{ascending:false}).limit(3);
  if(recentError)return apiJson({error:'Call permission migration is not applied.'},503);
  const recentRows=recent||[];if(recentRows.some((x:any)=>now-Date.parse(x.requested_at)<24*60*60*1000))return apiJson({error:'A call permission request was already sent in the last 24 hours.'},429);
  if(recentRows.length>=2)return apiJson({error:'WhatsApp allows at most two call permission requests in a rolling seven-day period.'},429);
  const wa=await getWhatsAppCredentials(c.db,conv.channel_phone_number_id||null);if(!wa)return apiJson({error:'This workspace has no verified WhatsApp connection.'},503);
  const {data:pending,error:insertError}=await c.db.from('growth_whatsapp_call_permissions').insert({organization_id:orgId,lead_id:leadId,phone_number_id:wa.phone_number_id,recipient_phone:digits,permission_status:'pending'}).select('id').single();
  if(insertError||!pending)return apiJson({error:'Could not create call permission audit record.'},500);
  const response=await fetch(`https://graph.facebook.com/${wa.graph_api_version}/${wa.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${wa.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:digits,type:'interactive',interactive:{type:'call_permission_request',body:{text:body},action:{name:'call_permission_request'}}})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){await c.db.from('growth_whatsapp_call_permissions').update({permission_status:'failed',provider_payload:{error:result.error?.message||'Meta rejected the request'},updated_at:new Date().toISOString()}).eq('id',pending.id).eq('organization_id',orgId);return apiJson({error:'Meta rejected the call permission request.',details:result.error?.message||'Provider error'},502);}
  const messageId=String(result.messages?.[0]?.id||'');
  const {error:updateError}=await c.db.from('growth_whatsapp_call_permissions').update({request_message_id:messageId||null,provider_payload:{accepted:true},updated_at:new Date().toISOString()}).eq('id',pending.id).eq('organization_id',orgId);
  if(updateError)return apiJson({sent:true,permissionRequestId:pending.id,warning:'Provider accepted the request but local message ID persistence failed. Reconcile the webhook before retrying.'},202);
  await c.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:c.userId,event_type:'whatsapp.call_permission_requested',metadata:{lead_id:leadId,permission_request_id:pending.id,phone_number_id:wa.phone_number_id}});
  return apiJson({sent:true,permissionRequestId:pending.id,messageId,permissionStatus:'pending',callPlaced:false},201);
 }catch{return apiJson({error:'Unable to request WhatsApp calling permission.'},500);}
}
