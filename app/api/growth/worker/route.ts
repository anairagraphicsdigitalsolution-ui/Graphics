import { createUnsubscribeToken } from '@/lib/growth-email-unsubscribe';
import { getWhatsAppCredentials } from '@/lib/growth-whatsapp';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';
import {NextRequest,NextResponse} from 'next/server';import {createClient} from '@supabase/supabase-js';import {decryptSecret,encryptSecret} from '@/lib/growth-crypto';
export const runtime='nodejs',maxDuration=60;
const json=(x:any,s=200)=>NextResponse.json(x,{status:s,headers:{'Cache-Control':'no-store'}});
async function assertQuota(db:any,orgId:string,metric:any,key:string){const q=await consumeGrowthQuota(db,orgId,metric,1,key,{source:'growth_worker'});if(!q.allowed)throw new Error(`QUOTA_BLOCKED:${quotaErrorMessage(q)}`);}
async function publish(db:any,job:any){const contentId=job.payload?.content_id;if(!contentId)throw new Error('Missing content_id.');const {data:item}=await db.from('growth_content').select('*').eq('id',contentId).eq('organization_id',job.organization_id).maybeSingle();if(!item||item.status!=='scheduled')throw new Error('Scheduled content is missing or no longer scheduled.');await assertQuota(db,job.organization_id,'social_posts',`social-post:${job.id}`);const platform=String(item.platform||'').toLowerCase();const {data:accounts}=await db.from('growth_social_accounts').select('*').eq('organization_id',job.organization_id).eq('platform',platform).eq('connection_status','connected').limit(10);const account=(accounts||[]).find((a:any)=>a.encrypted_credentials);if(!account)throw new Error(`No connected ${platform} account. Connect the required provider first.`);const creds=decryptSecret(account.encrypted_credentials);const version=process.env.META_GRAPH_API_VERSION;const media=Array.isArray(item.media_urls)?item.media_urls:[];let result:any;if(platform==='facebook'){if(!version)throw new Error('META_GRAPH_API_VERSION is missing.');const endpoint=media[0]?`${creds.page_id}/photos`:`${creds.page_id}/feed`;const body=media[0]?{url:media[0],caption:item.body,access_token:creds.access_token}:{message:item.body,access_token:creds.access_token};const r=await fetch(`https://graph.facebook.com/${version}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});result=await r.json();if(!r.ok)throw new Error(result.error?.message||'Facebook publish failed.');}else if(platform==='instagram'){if(!version)throw new Error('META_GRAPH_API_VERSION is missing.');if(!creds.instagram_user_id)throw new Error('Instagram Business account is not linked.');const url=media[0];if(!url)throw new Error('Instagram publishing requires a publicly accessible media URL.');const isVideo=item.content_type==='reel';const createBody:any={access_token:creds.access_token,caption:item.body};if(isVideo){createBody.media_type='REELS';createBody.video_url=url;}else createBody.image_url=url;const c=await fetch(`https://graph.facebook.com/${version}/${creds.instagram_user_id}/media`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(createBody)});const container=await c.json();if(!c.ok||!container.id)throw new Error(container.error?.message||'Instagram media container creation failed.');const p=await fetch(`https://graph.facebook.com/${version}/${creds.instagram_user_id}/media_publish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({creation_id:container.id,access_token:creds.access_token})});result=await p.json();if(!p.ok)throw new Error(result.error?.message||'Instagram publish failed.');}else if(platform==='linkedin'){
 if(!creds.external_id)throw new Error('LinkedIn member identity is missing. Reconnect LinkedIn.');
 const apiVersion=process.env.LINKEDIN_API_VERSION||'202501';
 const author=`urn:li:person:${creds.external_id}`;
 const linkedinHeaders={Authorization:`Bearer ${creds.access_token}`,'LinkedIn-Version':apiVersion,'X-Restli-Protocol-Version':'2.0.0'};
 let mediaContent:any=undefined;
 if(item.content_type==='carousel'&&(media.length<2||media.length>20))throw new Error('LinkedIn carousel requires 2 to 20 images.');
 if(media.length){
  if(media.length>20)throw new Error('LinkedIn multi-image posts support at most 20 images.');
  if(item.content_type==='carousel'&&(media.length<2||media.length>20))throw new Error('LinkedIn carousel requires 2 to 20 images.');
  const uploadedImages:any[]=[];
  for(let index=0;index<media.length;index++){
   const imageUrl=String(media[index]);
   if(!/^https:\/\//i.test(imageUrl))throw new Error(`LinkedIn image ${index+1} requires a public HTTPS URL.`);
   const imageResponse=await fetch(imageUrl,{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!imageResponse.ok)throw new Error(`LinkedIn image ${index+1} download failed (${imageResponse.status}).`);
   const mime=(imageResponse.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
   if(!['image/jpeg','image/png','image/gif'].includes(mime))throw new Error(`LinkedIn image ${index+1} must be JPG, PNG or GIF.`);
   const imageBytes=await imageResponse.arrayBuffer();
   if(!imageBytes.byteLength||imageBytes.byteLength>10*1024*1024)throw new Error(`LinkedIn image ${index+1} must be between 1 byte and 10 MB.`);
   const init=await fetch('https://api.linkedin.com/rest/images?action=initializeUpload',{method:'POST',headers:{...linkedinHeaders,'Content-Type':'application/json'},body:JSON.stringify({initializeUploadRequest:{owner:author}})});
   const initBody=await init.json().catch(()=>({}));
   const uploadUrl=initBody?.value?.uploadUrl,imageUrn=initBody?.value?.image;
   if(!init.ok||!uploadUrl||!imageUrn)throw new Error(initBody?.message||`LinkedIn image ${index+1} upload initialization failed.`);
   const upload=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':mime},body:imageBytes,signal:AbortSignal.timeout(30000)});
   if(!upload.ok)throw new Error(`LinkedIn image ${index+1} transfer failed (${upload.status}).`);
   uploadedImages.push({id:imageUrn,altText:`${String(item.title||'Post image').slice(0,90)} — image ${index+1}`});
  }
  mediaContent=uploadedImages.length===1?{media:uploadedImages[0]}:{multiImage:{images:uploadedImages}};
 }
 const postBody:any={author,commentary:String(item.body||'').slice(0,3000),visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false};
 if(mediaContent)postBody.content=mediaContent;
 const r=await fetch('https://api.linkedin.com/rest/posts',{method:'POST',headers:{...linkedinHeaders,'Content-Type':'application/json'},body:JSON.stringify(postBody)});
 const text=await r.text();if(!r.ok)throw new Error(text.slice(0,800)||`LinkedIn publishing failed (${r.status}).`);result={id:r.headers.get('x-restli-id')||null,status:'published',media:mediaContent?.multiImage?'multiImage':mediaContent?'image':'text'};
 }else if(platform==='youtube'){
 const videoUrl=media.find((u:string)=>/^https:\/\//i.test(u));if(!videoUrl)throw new Error('YouTube publishing requires a public HTTPS video URL.');
 if(!creds.refresh_token)throw new Error('YouTube refresh token is missing. Reconnect YouTube and approve offline access.');
 let accessToken=creds.access_token;
 if(creds.expires_at&&Date.parse(creds.expires_at)<Date.now()+60000){
  const refresh=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:creds.refresh_token,grant_type:'refresh_token'})});
  const refreshed=await refresh.json();if(!refresh.ok||!refreshed.access_token)throw new Error(refreshed.error_description||'YouTube access token refresh failed.');
  accessToken=refreshed.access_token;const updated={...creds,access_token:accessToken,expires_at:new Date(Date.now()+Number(refreshed.expires_in||3600)*1000).toISOString()};
  await db.from('growth_social_accounts').update({encrypted_credentials:encryptSecret(updated),token_expires_at:updated.expires_at}).eq('id',account.id);
 }
 const mediaResponse=await fetch(videoUrl,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!mediaResponse.ok)throw new Error('Could not download the uploaded video for YouTube.');
 const mime=(mediaResponse.headers.get('content-type')||'video/mp4').split(';')[0].trim();
 if(!mime.startsWith('video/'))throw new Error('YouTube media URL must point to a video file.');
 const bytes=await mediaResponse.arrayBuffer();const total=bytes.byteLength;
 if(!total||total>80*1024*1024)throw new Error('YouTube upload is limited to 80 MB per video in this worker.');
 const {data:existing,error:sessionReadError}=await db.from('growth_youtube_upload_sessions').select('*').eq('organization_id',job.organization_id).eq('content_id',item.id).maybeSingle();
 if(sessionReadError)throw new Error('YouTube upload recovery storage is unavailable. Apply migration v6.73.');
 let session=existing;let uploadUrl='';let shouldProbe=!!existing;
 if(session?.status==='uploaded'&&session.provider_video_id){result={id:session.provider_video_id,privacyStatus:process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS==='public'?'public':'private',recovered:true};}
 else{
  if(session&&(session.status==='expired'||session.total_bytes!==total||session.mime_type!==mime||session.social_account_id!==account.id||Date.parse(session.expires_at)<Date.now())){await db.from('growth_youtube_upload_sessions').update({status:'expired',last_error:'Upload source/account changed or resumable session expired.'}).eq('id',session.id);session=null;shouldProbe=false;}
  if(session?.encrypted_session_url)uploadUrl=decryptSecret(session.encrypted_session_url)?.url||'';
  if(!uploadUrl){
   const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(total)},body:JSON.stringify({snippet:{title:String(item.title||item.body||'Anaira Update').slice(0,100),description:String(item.body||'').slice(0,5000)},status:{privacyStatus:process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS==='public'?'public':'private',selfDeclaredMadeForKids:false}})});
   uploadUrl=init.headers.get('location')||'';if(!init.ok||!uploadUrl){const error=await init.text();throw new Error(error.slice(0,800)||'YouTube resumable upload session could not be created.');}
   const record={organization_id:job.organization_id,content_id:item.id,social_account_id:account.id,encrypted_session_url:encryptSecret({url:uploadUrl}),mime_type:mime,total_bytes:total,uploaded_bytes:0,status:'initiated',provider_video_id:null,last_error:null,expires_at:new Date(Date.now()+6*86400000).toISOString(),updated_at:new Date().toISOString()};
   const saved=await db.from('growth_youtube_upload_sessions').upsert(record,{onConflict:'organization_id,content_id'}).select('*').single();if(saved.error)throw new Error('YouTube upload session could not be saved for recovery.');session=saved.data;shouldProbe=false;
  }
  let offset=Number(session?.uploaded_bytes||0);
  if(shouldProbe){
   const probe=await fetch(uploadUrl,{method:'PUT',headers:{Authorization:`Bearer ${accessToken}`,'Content-Length':'0','Content-Range':`bytes */${total}`}});
   if(probe.status===200||probe.status===201){const done=await probe.json().catch(()=>({}));if(!done.id)throw new Error('YouTube reported completed upload without a video ID.');result={id:done.id,privacyStatus:done.status?.privacyStatus||'private',recovered:true};await db.from('growth_youtube_upload_sessions').update({status:'uploaded',provider_video_id:done.id,uploaded_bytes:total,last_error:null,updated_at:new Date().toISOString()}).eq('id',session.id);}
   else if(probe.status===308){const range=probe.headers.get('range');offset=range?Number(range.match(/(\d+)-(\d+)$/)?.[2]||-1)+1:0;if(!Number.isFinite(offset)||offset<0||offset>total)throw new Error('YouTube returned an invalid resumable upload range.');}
   else if(probe.status===404||probe.status===410){await db.from('growth_youtube_upload_sessions').update({status:'expired',last_error:'YouTube upload session expired; a fresh session will be created.',updated_at:new Date().toISOString()}).eq('id',session.id);throw new Error('YouTube upload session expired. Retry the scheduled job to create a fresh session.');}
   else {const detail=await probe.text();throw new Error(`YouTube upload recovery probe failed (${probe.status}): ${detail.slice(0,400)}`);}
  }
  if(!result){
   const deadline=Date.now()+25000;const chunkSize=8*1024*1024;
   while(offset<total&&Date.now()<deadline){
    const endByte=Math.min(total,offset+chunkSize)-1;const chunk=bytes.slice(offset,endByte+1);
    const response=await fetch(uploadUrl,{method:'PUT',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':mime,'Content-Length':String(chunk.byteLength),'Content-Range':`bytes ${offset}-${endByte}/${total}`},body:chunk,signal:AbortSignal.timeout(20000)});
    if(response.status===308){
     const range=response.headers.get('range');const next=range?Number(range.match(/(\d+)-(\d+)$/)?.[2]||-1)+1:0;
     if(!Number.isFinite(next)||next<=offset||next>endByte+1)throw new Error('YouTube returned an invalid upload acknowledgement range.');
     offset=next;await db.from('growth_youtube_upload_sessions').update({uploaded_bytes:offset,status:'uploading',last_error:null,updated_at:new Date().toISOString()}).eq('id',session.id);
    }else if(response.status===200||response.status===201){
     const uploaded=await response.json().catch(()=>({}));if(!uploaded.id)throw new Error('YouTube upload completed without returning a video ID.');
     result={id:uploaded.id,privacyStatus:uploaded.status?.privacyStatus||'private'};offset=total;
     await db.from('growth_youtube_upload_sessions').update({uploaded_bytes:total,status:'uploaded',provider_video_id:uploaded.id,last_error:null,updated_at:new Date().toISOString()}).eq('id',session.id);
    }else{
     const detail=await response.text();throw new Error(`YouTube resumable chunk failed (${response.status}): ${detail.slice(0,500)}`);
    }
   }
   if(!result){await db.from('growth_youtube_upload_sessions').update({uploaded_bytes:offset,status:'uploading',last_error:null,updated_at:new Date().toISOString()}).eq('id',session.id);return {pending:true,uploadedBytes:offset,totalBytes:total,provider:'youtube'};}
  }
 }
 }else throw new Error(`Publishing to ${platform} is not supported by this worker.`);await db.from('growth_content').update({status:'published',published_at:new Date().toISOString()}).eq('id',item.id);return result;}
async function sendWhatsApp(db:any,job:any){const {data:lead}=await db.from('growth_leads').select('phone,consent_to_contact,contact_opted_out_at,conversation_id').eq('id',job.payload?.lead_id).eq('organization_id',job.organization_id).maybeSingle();if(!lead?.phone||!lead.consent_to_contact||lead.contact_opted_out_at)throw new Error('WhatsApp send blocked: active consent and no opt-out are required.');if(!lead.conversation_id)throw new Error('WhatsApp free-form follow-up blocked: no recent customer-initiated conversation is recorded; an approved WhatsApp template is required.');const {data:conversation}=await db.from('growth_conversations').select('messages,channel_phone_number_id').eq('id',lead.conversation_id).eq('organization_id',job.organization_id).maybeSingle();const messages=Array.isArray(conversation?.messages)?conversation.messages:[];const lastInbound=[...messages].reverse().find((m:any)=>m?.role==='user'&&m?.at);const inboundAt=lastInbound?.at?Date.parse(lastInbound.at):NaN;if(!Number.isFinite(inboundAt)||Date.now()-inboundAt>24*60*60*1000)throw new Error('WhatsApp free-form follow-up blocked: the 24-hour customer-service window is closed; an approved WhatsApp template is required.');const wa=await getWhatsAppCredentials(db,job.organization_id,conversation?.channel_phone_number_id||null);if(!wa)throw new Error('This workspace has no verified WhatsApp connection.');await assertQuota(db,job.organization_id,'whatsapp_messages',`whatsapp-job:${job.id}`);const {access_token:token,phone_number_id:phoneId,graph_api_version:version}=wa;const to=lead.phone.replace(/[^0-9]/g,'');const r=await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:String(job.payload?.message||'').slice(0,3500)}})});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||'WhatsApp send failed.');return data;}

async function sendWhatsAppTemplate(db:any,job:any){
 const p=job.payload||{};
 const {data:lead}=await db.from('growth_leads').select('phone,consent_to_contact,contact_opted_out_at,conversation_id').eq('id',p.lead_id).eq('organization_id',job.organization_id).maybeSingle();
 if(!lead?.phone||!lead.consent_to_contact||lead.contact_opted_out_at)throw new Error('WhatsApp template blocked: active consent and no opt-out are required.');
 const {data:template}=await db.from('growth_whatsapp_templates').select('template_name,language,approval_status,variables').eq('id',p.template_id).eq('organization_id',job.organization_id).maybeSingle();
 if(!template||template.approval_status!=='approved')throw new Error('WhatsApp template is not approved in the Anaira template registry.');
 const values=Array.isArray(p.values)?p.values:[];if(values.length!==(template.variables||[]).length||values.some((v:any)=>typeof v!=='string'||v.length>1024))throw new Error('WhatsApp template variables do not match the approved template.');
 const {data:originConversation}=lead.conversation_id?await db.from('growth_conversations').select('channel_phone_number_id').eq('id',lead.conversation_id).eq('organization_id',job.organization_id).maybeSingle():{data:null};const wa=await getWhatsAppCredentials(db,job.organization_id,originConversation?.channel_phone_number_id||null);if(!wa)throw new Error('This workspace has no verified WhatsApp connection for this conversation.');await assertQuota(db,job.organization_id,'whatsapp_messages',`whatsapp-template:${job.id}`);const {access_token:token,phone_number_id:phoneId,graph_api_version:version}=wa;
 const to=lead.phone.replace(/[^0-9]/g,'');if(to.length<8||to.length>15)throw new Error('Lead phone number is invalid.');
 const components=values.length?[{type:'body',parameters:values.map((text:string)=>({type:'text',text}))}]:[];
 const r=await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:template.template_name,language:{code:template.language},...(components.length?{components}:{})}})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error?.message||'WhatsApp template send failed.');return data;
}
async function sendEmail(db:any,job:any){const p=job.payload||{};const {data:lead}=await db.from('growth_leads').select('email,consent_to_contact,contact_opted_out_at,email_bounced_at,email_complained_at').eq('id',p.lead_id).eq('organization_id',job.organization_id).maybeSingle();if(!lead?.email||!lead.consent_to_contact||lead.contact_opted_out_at||lead.email_bounced_at||lead.email_complained_at)throw new Error('Email send blocked: active consent is required and bounced/complained/opted-out addresses cannot be contacted.');await assertQuota(db,job.organization_id,'email_messages',`email-job:${job.id}`);const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;if(!key||!from)throw new Error('Resend email credentials are not configured.');const token=createUnsubscribeToken(job.organization_id,String(p.lead_id));
 const base=(process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'').replace(/\/$/,'');
 if(!base)throw new Error('NEXT_PUBLIC_APP_URL is required to create a secure unsubscribe link.');
 const unsubscribeUrl=`${base}/api/growth/email/unsubscribe?token=${encodeURIComponent(token)}`;
 const subject=String(p.subject||'A follow-up from Anaira').slice(0,180);
 const text=String(p.text||'Thank you for contacting Anaira Graphics & Digital Solution.').slice(0,10000);
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[lead.email],subject,text:`${text}\n\n---\nTo stop receiving these emails, unsubscribe: ${unsubscribeUrl}`,headers:{'List-Unsubscribe':`<${unsubscribeUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})});const data=await r.json();if(!r.ok)throw new Error(data.message||data.error||'Email delivery failed.');return data;}

function renderTemplate(template:string,lead:any){return String(template||'').replaceAll('{{name}}',String(lead?.name||'there')).replaceAll('{{email}}',String(lead?.email||'')).replaceAll('{{phone}}',String(lead?.phone||''));}
async function runWorkflowStep(db:any,run:any){
 const steps=Array.isArray(run.steps)?run.steps:[];const index=Number(run.current_step||0);
 if(index>=steps.length){await db.from('growth_workflow_runs').update({status:'succeeded',completed_at:new Date().toISOString(),locked_at:null,last_error:null,updated_at:new Date().toISOString()}).eq('id',run.id);return {id:run.id,status:'succeeded'};}
 if(index===0)await assertQuota(db,run.organization_id,'workflow_runs',`workflow-run:${run.id}`);
 const step=steps[index],{data:lead}=run.lead_id?await db.from('growth_leads').select('id,name,email,phone,consent_to_contact,contact_opted_out_at,lead_temperature,status,source').eq('id',run.lead_id).eq('organization_id',run.organization_id).maybeSingle():{data:null};
 await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,step_index:index,event_type:index===0?'run_started':'step_started',details:{step_type:String(step.type||'unknown')}});
 if(step.type==='condition'){
  if(!lead)throw new Error('Workflow condition requires an existing lead.');
  const evaluate=(expression:any):boolean=>{
   if(Array.isArray(expression?.conditions)){
    const results=expression.conditions.map((child:any)=>evaluate(child));
    return expression.combinator==='any'?results.some(Boolean):results.every(Boolean);
   }
   const actual=String(lead[expression?.field]??'').toLowerCase(),expected=String(expression?.value??'').toLowerCase();
   return expression?.operator==='equals'?actual===expected:expression?.operator==='not_equals'?actual!==expected:actual.includes(expected);
  };
  const matched=evaluate(step.expression||{field:step.field,operator:step.operator,value:step.value});
  const next=Math.min(steps.length,index+1+(matched?0:Number(step.skip_steps||1))),done=next>=steps.length;
  await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,step_index:index,event_type:matched?'step_succeeded':'step_skipped',details:{condition_field:step.field,matched,next_step:next}});
  await db.from('growth_workflow_runs').update({current_step:next,status:done?'succeeded':'queued',next_run_at:new Date().toISOString(),locked_at:null,attempts:0,completed_at:done?new Date().toISOString():null,last_error:null,updated_at:new Date().toISOString()}).eq('id',run.id);
  if(done)await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,event_type:'run_succeeded',details:{}});
  return {id:run.id,status:done?'succeeded':matched?'condition_matched':'condition_skipped',matched,nextStep:next};
 }
 if(step.type==='wait'){
  const next=index+1,done=next>=steps.length;await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,step_index:index,event_type:'step_waiting',details:{delay_minutes:Number(step.delay_minutes)||1}});await db.from('growth_workflow_runs').update({current_step:next,status:done?'succeeded':'queued',next_run_at:new Date(Date.now()+Math.min(10080,Math.max(1,Number(step.delay_minutes)||1))*60000).toISOString(),locked_at:null,attempts:0,completed_at:done?new Date().toISOString():null,last_error:null,updated_at:new Date().toISOString()}).eq('id',run.id);if(done)await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,event_type:'run_succeeded',details:{}});return {id:run.id,status:done?'succeeded':'waiting'};
 }
 if(step.type==='create_follow_up'){
  if(!lead)throw new Error('Workflow lead no longer exists.');
  const {error}=await db.from('growth_tasks').insert({organization_id:run.organization_id,lead_id:lead.id,title:renderTemplate(step.title||'Follow up with {{name}}',lead).slice(0,160),description:renderTemplate(step.description||'Workflow follow-up',lead).slice(0,1000),task_type:'follow_up',created_by:null});if(error)throw error;
 }else if(step.type==='notify_admin'){
  if(!lead)throw new Error('Workflow lead no longer exists.');
  const {error}=await db.from('growth_tasks').insert({organization_id:run.organization_id,lead_id:lead.id,title:`Review new lead: ${lead.name}`.slice(0,160),description:'A new lead needs review from the workflow engine.',task_type:'review',created_by:null});if(error)throw error;
 }else if(step.type==='queue_whatsapp_template'){
  if(!lead?.consent_to_contact||lead.contact_opted_out_at)throw new Error('WhatsApp template workflow blocked: active consent is missing or contact opted out.');
  const {data:template}=await db.from('growth_whatsapp_templates').select('id,approval_status,variables').eq('id',step.template_id).eq('organization_id',run.organization_id).maybeSingle();
  if(!template||template.approval_status!=='approved')throw new Error('Selected WhatsApp template is not approved.');
  const values=(template.variables||[]).map((v:string)=>renderTemplate(v,lead));
  const {error}=await db.from('growth_jobs').insert({organization_id:run.organization_id,job_type:'send_whatsapp_template',payload:{lead_id:lead.id,template_id:template.id,values},run_at:new Date().toISOString()});if(error)throw error;
 }else if(step.type==='queue_whatsapp'||step.type==='send_email'){
  if(!lead?.consent_to_contact||lead.contact_opted_out_at)throw new Error('Outbound message skipped: active explicit consent is missing or contact opted out.');
  const destination=step.type==='queue_whatsapp'?lead.phone:lead.email;if(!destination)throw new Error(`Lead has no ${step.type==='queue_whatsapp'?'phone number':'email address'}.`);
  const payload=step.type==='queue_whatsapp'?{lead_id:lead.id,message:renderTemplate(step.message_template,lead)}:{lead_id:lead.id,subject:renderTemplate(step.subject,lead),text:renderTemplate(step.text_template,lead)};
  const {error}=await db.from('growth_jobs').insert({organization_id:run.organization_id,job_type:step.type==='queue_whatsapp'?'send_whatsapp':'send_email',payload,run_at:new Date().toISOString()});if(error)throw error;
 }else throw new Error(`Unsupported workflow step: ${String(step.type)}`);
 const next=index+1,done=next>=steps.length;await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,step_index:index,event_type:'step_succeeded',details:{step_type:step.type}});await db.from('growth_workflow_runs').update({current_step:next,status:done?'succeeded':'queued',next_run_at:new Date().toISOString(),locked_at:null,attempts:0,completed_at:done?new Date().toISOString():null,last_error:null,updated_at:new Date().toISOString()}).eq('id',run.id);if(done)await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,event_type:'run_succeeded',details:{}});return {id:run.id,status:done?'succeeded':'continued'};
}
async function processWorkflowRuns(db:any){
 const {data:runs,error}=await db.rpc('claim_due_growth_workflow_runs',{batch_limit:10});if(error)throw error;const results=[];
 for(const run of runs||[]){try{const {data:tenant}=await db.from('growth_organizations').select('status').eq('id',run.organization_id).maybeSingle();if(tenant?.status!=='active'){await db.from('growth_workflow_runs').update({status:'queued',locked_at:null,next_run_at:new Date(Date.now()+30*60*1000).toISOString(),last_error:'Workspace is suspended; execution paused.'}).eq('id',run.id);results.push({id:run.id,status:'paused_tenant'});continue;}results.push(await runWorkflowStep(db,run));}catch(e){const msg=e instanceof Error?e.message:'Workflow step failed';const terminal=Number(run.attempts||0)>=5;await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,step_index:Number(run.current_step||0),event_type:'step_failed',details:{message:msg.slice(0,1000),terminal}});if(terminal)await db.from('growth_workflow_run_events').insert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,event_type:'run_failed',details:{message:msg.slice(0,1000)}});if(terminal)await db.from('growth_workflow_dead_letters').upsert({organization_id:run.organization_id,run_id:run.id,rule_id:run.rule_id,lead_id:run.lead_id||null,error_message:msg.slice(0,2000),attempts:Number(run.attempts||0)+1,failed_at:new Date().toISOString(),status:'open',updated_at:new Date().toISOString()},{onConflict:'run_id'});await db.from('growth_workflow_runs').update({status:terminal?'failed':'queued',last_error:msg,locked_at:null,next_run_at:new Date(Date.now()+Math.min(60,Math.pow(2,Number(run.attempts||1)))*60000).toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id);results.push({id:run.id,status:terminal?'failed':'retry',error:msg});}}
 return results;
}

export async function GET(req:NextRequest){const secret=process.env.CRON_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return json({error:'Unauthorized worker request.'},401);const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return json({error:'Database worker is not configured.'},503);const db=createClient(url,key,{auth:{persistSession:false}});const {data:jobs,error}=await db.rpc('claim_growth_jobs',{batch_limit:10});if(error)return json({error:'Unable to claim jobs.'},500);const results=[];for(const job of jobs||[]){try{const {data:tenant}=await db.from('growth_organizations').select('status').eq('id',job.organization_id).maybeSingle();if(tenant?.status!=='active'){await db.from('growth_jobs').update({status:'queued',run_at:new Date(Date.now()+30*60*1000).toISOString(),locked_at:null,last_error:'Workspace is suspended; job execution paused.'}).eq('id',job.id);results.push({id:job.id,status:'paused_tenant'});continue;}let jobResult:any;if(job.job_type==='publish_content')jobResult=await publish(db,job);else if(job.job_type==='send_whatsapp')await sendWhatsApp(db,job);else if(job.job_type==='send_whatsapp_template')await sendWhatsAppTemplate(db,job);else if(job.job_type==='send_email')await sendEmail(db,job);else throw new Error(`Unsupported job type: ${job.job_type}`);if(jobResult?.pending){await db.from('growth_jobs').update({status:'queued',run_at:new Date(Date.now()+10000).toISOString(),locked_at:null,attempts:0,last_error:null}).eq('id',job.id);results.push({id:job.id,status:'uploading',progress:{uploadedBytes:jobResult.uploadedBytes,totalBytes:jobResult.totalBytes}});continue;}await db.from('growth_jobs').update({status:'succeeded',completed_at:new Date().toISOString(),last_error:null}).eq('id',job.id);results.push({id:job.id,status:'succeeded'});}catch(e){const message=e instanceof Error?e.message:'Job failed';const terminal=job.attempts>=job.max_attempts||message.startsWith('QUOTA_BLOCKED:');await db.from('growth_jobs').update({status:terminal?'failed':'queued',last_error:message,run_at:new Date(Date.now()+Math.min(60,Math.pow(2,job.attempts))*60000).toISOString(),locked_at:null}).eq('id',job.id);if(job.job_type==='publish_content'&&terminal&&job.payload?.content_id)await db.from('growth_content').update({status:'failed'}).eq('id',job.payload.content_id).eq('organization_id',job.organization_id);results.push({id:job.id,status:terminal?'failed':'retry',error:message});}}let workflowResults:any[]=[];try{workflowResults=await processWorkflowRuns(db);}catch(e){workflowResults=[{status:'error',error:e instanceof Error?e.message:'Workflow runner failed'}];}return json({claimed:(jobs||[]).length,results,workflowRuns:workflowResults});}
