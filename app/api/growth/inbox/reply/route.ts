import { getWhatsAppCredentials } from '@/lib/growth-whatsapp';
import {NextRequest,NextResponse} from 'next/server';
import {growthContext,requireGrowthRole} from '@/lib/growth-server';
import {getWorkspaceIntegration,getWorkspaceAccessToken} from '@/lib/growth-integrations';
import { evaluateGrowthSendPolicy, evaluateLeadChannelSuppression } from '@/lib/growth-send-policy';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';
export const runtime='nodejs';
const json=(b:unknown,s=200)=>NextResponse.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),id=String(b.conversationId||''),message=String(b.message||'').trim(),key=String(b.clientMessageId||'');
  if(!org||!id||message.length<1||message.length>3000||!key||key.length>120)return json({error:'Organization, conversation, message (1–3000 chars), and clientMessageId are required.'},400);
  if(!await requireGrowthRole(ctx.db,ctx.userId,org,['owner','manager','agent']))return json({error:'Inbox permission denied.'},403);
  const {data:conv,error}=await ctx.db.from('growth_conversations').select('id,channel,visitor_id,messages,assigned_to,needs_human,status,channel_phone_number_id').eq('id',id).eq('organization_id',org).maybeSingle();
  if(error||!conv)return json({error:'Conversation not found.'},404);
  const {data:member}=await ctx.db.from('growth_members').select('role').eq('organization_id',org).eq('user_id',ctx.userId).maybeSingle();
  if(member?.role==='agent'&&conv.assigned_to!==ctx.userId)return json({error:'Agents can reply only to conversations assigned to them.'},403);
  const {data:claim,error:claimError}=await ctx.db.from('growth_webhook_events').upsert({organization_id:org,provider:'human_inbox',event_type:'human_reply',event_key:`${org}:${key}`,payload:{conversation_id:id,actor_id:ctx.userId},processing_status:'processing'},{onConflict:'provider,event_key',ignoreDuplicates:true}).select('id').maybeSingle();
  if(claimError)return json({error:'Could not reserve reply idempotency key.'},500);
  if(!claim)return json({error:'This reply request was already submitted. Refresh the conversation before retrying.'},409);
  const channel=String(conv.channel),version=process.env.META_GRAPH_API_VERSION;
  if(channel==='website'){const now=new Date().toISOString(),messages=Array.isArray(conv.messages)?conv.messages:[];const {error:updateError}=await ctx.db.from('growth_conversations').update({messages:[...messages,{role:'human',content:message,at:now,client_message_id:key}],needs_human:true,status:'handed_off',last_message_at:now,updated_at:now}).eq('id',id).eq('organization_id',org);if(updateError){await ctx.db.from('growth_webhook_events').update({processing_status:'failed',error_message:'Website conversation history update failed.'}).eq('id',claim.id);return json({error:'Unable to save website reply.'},500);}await ctx.db.from('growth_webhook_events').update({processing_status:'processed',processed_at:now}).eq('id',claim.id);return json({success:true,channel:'website',deliveredToWidget:true});}
  let response:Response,body:any;
  if(channel==='instagram'||channel==='facebook_messenger'){
   const platform=channel==='instagram'?'instagram':'facebook';
   const lastInbound=[...(Array.isArray(conv.messages)?conv.messages:[])].reverse().find((m:any)=>m.role==='user'&&m.recipient_account_id);
   const {data:target}=await ctx.db.from('growth_social_accounts').select('external_account_id,encrypted_credentials,connection_status').eq('organization_id',org).eq('platform',platform).eq('connection_status','connected').eq('external_account_id',lastInbound?.recipient_account_id||'').maybeSingle();
   if(!target||!version)return json({error:'Connected Meta Page/account or META_GRAPH_API_VERSION is missing.'},503);
   const accessToken=await getWorkspaceAccessToken(ctx.db,org,platform==='instagram'?'instagram':'meta',target.external_account_id);
   response=await fetch(`https://graph.facebook.com/${version}/${target.external_account_id}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({recipient:{id:conv.visitor_id},message:{text:message},messaging_type:'RESPONSE'}),cache:'no-store'});
  }else if(channel==='email'){
   const recipient=String(conv.visitor_id||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))return json({error:'This email conversation has no valid customer email address.'},400);
   const {data:consentedLead}=await ctx.db.from('growth_leads').select('id,email,consent_to_contact,contact_opted_out_at,channel_consents,email_bounced_at,email_complained_at').eq('organization_id',org).ilike('email',recipient).eq('consent_to_contact',true).limit(1).maybeSingle();
   if(!consentedLead||consentedLead.contact_opted_out_at||consentedLead.channel_consents?.email?.granted!==true||consentedLead.email_bounced_at||consentedLead.email_complained_at)return json({error:'Email reply blocked: matching CRM lead must have explicit email channel consent and no opt-out, bounce or complaint.'},403);
   const resend=await getWorkspaceIntegration(ctx.db,org,'resend');
   const resendKey=String(resend.credentials.api_key||process.env.RESEND_API_KEY||'').trim();
   const from=String(resend.settings.from_email||process.env.RESEND_FROM_EMAIL||'').trim();
   if(!resendKey||!from)return json({error:'Resend email credentials (RESEND_API_KEY and RESEND_FROM_EMAIL) are not configured.'},503);
   response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[recipient],subject:'Re: Your enquiry',text:message,tags:[{name:'anaira_org',value:org.slice(0,256)},{name:'anaira_conversation',value:id.slice(0,256)}]}),cache:'no-store'});
  }else if(channel==='sms'){
   const recipient=String(conv.visitor_id||'').trim();
   if(!/^\+[1-9]\d{7,14}$/.test(recipient))return json({error:'SMS conversation has no valid E.164 phone number.'},400);
   const {data:lead}=await ctx.db.from('growth_leads').select('id,phone,consent_to_contact,contact_opted_out_at,channel_consents,channel_suppressions').eq('organization_id',org).eq('phone',recipient).maybeSingle();
   if(!lead)return json({error:'SMS reply blocked: create or match a CRM lead and record explicit SMS consent first.'},403);
   const suppression=evaluateLeadChannelSuppression(lead,'sms');if(!suppression.allowed)return json({error:suppression.reason},403);
   const {data:policyOrg,error:policyError}=await ctx.db.from('growth_organizations').select('communication_policy').eq('id',org).maybeSingle();if(policyError)return json({error:'Workspace communication policy unavailable.'},503);
   const policy=evaluateGrowthSendPolicy(policyOrg?.communication_policy,'sms');if(!policy.allowed)return json({error:policy.reason},409);
   const integration=await getWorkspaceIntegration(ctx.db,org,'twilio');const accountSid=String(integration.credentials.account_sid||''),authToken=String(integration.credentials.auth_token||''),from=String(integration.settings.from_number||'');
   if(!accountSid||!authToken||!/^\+[1-9]\d{7,14}$/.test(from))return json({error:'Twilio Account SID, Auth Token and E.164 sender number are required.'},503);
   const quota=await consumeGrowthQuota(ctx.db,org,'sms_messages',1,undefined,{channel:'human_inbox'});if(!quota.allowed)return json({error:quotaErrorMessage(quota),quota},quota.reason==='quota_exceeded'?402:503);
   const base=(process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'').replace(/\/$/,'');if(!base)return json({error:'NEXT_PUBLIC_APP_URL is required for SMS delivery callbacks.'},503);
   const form=new URLSearchParams({To:recipient,From:from,Body:message,StatusCallback:`${base}/api/growth/sms/webhook`});
   const auth=Buffer.from(`${accountSid}:${authToken}`).toString('base64');
   response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),cache:'no-store'});
  }else if(channel==='whatsapp'){
   const whatsappPhone=String(conv.visitor_id||'').replace(/[^0-9]/g,'');
   const {data:consentedLead}=await ctx.db.from('growth_leads').select('id,phone,consent_to_contact,contact_opted_out_at,channel_consents').eq('organization_id',org).eq('consent_to_contact',true).limit(100);
   const leadHasConsent=Boolean((consentedLead||[]).some((lead:any)=>String(lead.phone||'').replace(/[^0-9]/g,'')===whatsappPhone&&!lead.contact_opted_out_at&&lead.channel_consents?.whatsapp?.granted===true));
   if(!leadHasConsent)return json({error:'WhatsApp reply blocked: a matching CRM lead with explicit WhatsApp channel consent is required.'},403);
   const lastInbound=[...(Array.isArray(conv.messages)?conv.messages:[])].reverse().find((m:any)=>m.role==='user'&&m.at);
   const inboundAt=lastInbound?.at?new Date(lastInbound.at).getTime():0;
   if(!inboundAt||!Number.isFinite(inboundAt)||Date.now()-inboundAt>24*60*60*1000)return json({error:'WhatsApp free-form replies are allowed only within 24 hours of the customer message. Use an approved WhatsApp template for later follow-up.'},409);
   const wa=await getWhatsAppCredentials(ctx.db,org,conv.channel_phone_number_id||null);if(!wa)return json({error:'This workspace has no verified WhatsApp connection.'},503);
   response=await fetch(`https://graph.facebook.com/${wa.graph_api_version}/${wa.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${wa.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:conv.visitor_id,type:'text',text:{body:message}}),cache:'no-store'});
  }else return json({error:`Manual replies are not enabled for channel ${channel}.`},400);
  body=await response.json().catch(()=>({}));
  if(!response.ok){const message=String(body?.error?.message||body?.message||'Provider rejected the reply.').slice(0,500);await ctx.db.from('growth_webhook_events').update({processing_status:'failed',error_message:message}).eq('id',claim.id);return json({error:message},502);}
  const now=new Date().toISOString(),messages=Array.isArray(conv.messages)?conv.messages:[];
  if(channel==='sms'){
   const recipient=String(conv.visitor_id||'');
   const {data:lead}=await ctx.db.from('growth_leads').select('id').eq('organization_id',org).eq('phone',recipient).maybeSingle();
   const integration=await getWorkspaceIntegration(ctx.db,org,'twilio');
   const {error:smsError}=await ctx.db.from('growth_sms_messages').insert({organization_id:org,lead_id:lead?.id,initiated_by:ctx.userId,to_phone:recipient,from_sender:String(integration.settings.from_number||''),body:message,status:'accepted',provider_status:String(body?.status||'accepted'),provider_message_sid:String(body?.sid||''),consent_verified_at:now,client_request_id:key,direction:'outbound',conversation_id:id,status_updated_at:now});
   if(smsError){await ctx.db.from('growth_webhook_events').update({processing_status:'processed',processed_at:now,payload:{conversation_id:id,provider_accepted:true,sms_history_write_failed:true}}).eq('id',claim.id);return json({success:true,providerAccepted:true,warning:'Twilio accepted the SMS but the local delivery record needs reconciliation.',providerMessageId:body?.sid||null},202);}
  }
  const {error:updateError}=await ctx.db.from('growth_conversations').update({messages:[...messages,{role:'human',content:message,at:now,provider_message_id:String(body?.sid||body?.message_id||body?.messages?.[0]?.id||body?.id||''),client_message_id:key}],needs_human:true,status:'handed_off',last_message_at:now,updated_at:now}).eq('id',id).eq('organization_id',org);
  if(updateError){await ctx.db.from('growth_webhook_events').update({processing_status:'processed',processed_at:now,payload:{conversation_id:id,provider_accepted:true,history_update_failed:true}}).eq('id',claim.id);return json({success:true,providerAccepted:true,warning:'Provider accepted the reply but conversation history could not be updated. Reconcile before retrying.',providerMessageId:body?.sid||body?.message_id||body?.messages?.[0]?.id||body?.id||null},202);}
  await ctx.db.from('growth_webhook_events').update({processing_status:'processed',processed_at:now}).eq('id',claim.id);
  return json({success:true,providerMessageId:body?.sid||body?.message_id||body?.messages?.[0]?.id||body?.id||null});
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to send inbox reply.'},500);}
}
