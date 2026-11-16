import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime='nodejs';
const SOCIAL_FORMATS:Record<string,string[]>={facebook:['post'],instagram:['post','reel'],linkedin:['post','carousel'],youtube:['reel']};
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.contentId||''),action=String(b.action||'');
  if(!id||!await requireGrowthRole(ctx.db,ctx.userId,orgId,['owner','manager']))return apiJson({error:'Workspace manager permission required.'},403);
  if(!await requireGrowthFeature(ctx.db,ctx.userId,orgId,'social_channels'))return apiJson({error:'Content Studio is not included in this workspace plan.'},402);
  const {data:current,error:currentError}=await ctx.db.from('growth_content').select('id,status,platform,content_type,social_account_id').eq('id',id).eq('organization_id',orgId).maybeSingle();
  if(currentError||!current)return apiJson({error:'Content not found.'},404);
  const transitions:Record<string,string>={submit:'draft',approve:'pending_approval',reject:'pending_approval',schedule:'approved',cancel_schedule:'scheduled'};
  if(transitions[action]!==current.status)return apiJson({error:`Cannot ${action} content while it is ${current.status}.`},409);
  if(action==='schedule'){
   const at=typeof b.scheduled_at==='string'&&!Number.isNaN(Date.parse(b.scheduled_at))?new Date(b.scheduled_at).toISOString():null;
   if(!at||Date.parse(at)<=Date.now())return apiJson({error:'A valid future schedule date is required.'},400);
   const platform=String(current.platform||'').toLowerCase(),formats=SOCIAL_FORMATS[platform];if(!formats||!formats.includes(current.content_type))return apiJson({error:`${current.content_type} is not yet supported for scheduled publishing on ${platform}. Save it as a content draft instead.`},400);
   let accountId=String(b.socialAccountId||current.social_account_id||'');
   if(!accountId){const {data:accounts}=await ctx.db.from('growth_social_accounts').select('id').eq('organization_id',orgId).eq('platform',platform).eq('connection_status','connected').limit(2);if((accounts||[]).length!==1)return apiJson({error:(accounts||[]).length?'Choose the exact connected social account for this post.':`Connect a ${platform} account before scheduling.`},409);accountId=accounts![0].id;}
   const {data:account}=await ctx.db.from('growth_social_accounts').select('id').eq('id',accountId).eq('organization_id',orgId).eq('platform',platform).eq('connection_status','connected').maybeSingle();if(!account)return apiJson({error:'Selected social account is not connected to this workspace or does not match the platform.'},409);
   const {data:updated,error}=await ctx.db.from('growth_content').update({status:'scheduled',scheduled_at:at,social_account_id:accountId,last_publish_error:null,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).eq('status','approved').select('id,title,status,scheduled_at,platform,social_account_id').maybeSingle();
   if(error||!updated)return apiJson({error:'Content could not be scheduled.'},400);
   const {data:job,error:jobError}=await ctx.db.from('growth_jobs').insert({organization_id:orgId,job_type:'publish_content',payload:{content_id:id,social_account_id:accountId,platform},run_at:at}).select('id').single();
   if(jobError){await ctx.db.from('growth_content').update({status:'approved',scheduled_at:null,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId);return apiJson({error:'Publishing job could not be queued. Content returned to Approved.'},500);}
   await ctx.db.from('growth_content_publication_events').insert({organization_id:orgId,content_id:id,social_account_id:accountId,job_id:job.id,platform,event_type:'queued',message:'Approved content queued for scheduled publishing.',metadata:{scheduled_at:at}});
   return apiJson({content:updated,note:'Scheduled. The cron worker will publish at the selected time using the connected account.'});
  }
  if(action==='cancel_schedule'){
   const {data:activeJob,error:jobLookupError}=await ctx.db.from('growth_jobs').select('id,status').eq('organization_id',orgId).eq('job_type','publish_content').contains('payload',{content_id:id}).in('status',['queued','processing']).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(jobLookupError)return apiJson({error:'Could not verify the publishing job state.'},500);
   if(activeJob?.status==='processing')return apiJson({error:'The publishing worker has already claimed this post. Wait for its provider result before changing its schedule.'},409);
   if(activeJob?.status==='queued'){const {data:cancelled,error:cancelError}=await ctx.db.from('growth_jobs').update({status:'cancelled',last_error:'Cancelled from the content calendar.'}).eq('id',activeJob.id).eq('status','queued').select('id').maybeSingle();if(cancelError||!cancelled)return apiJson({error:'The publishing job was claimed before cancellation. Refresh and check its status.'},409);}
  }
  const patch:any=action==='submit'?{status:'pending_approval',approved_by:null,approved_at:null}:action==='approve'?{status:'approved',approved_by:ctx.userId,approved_at:new Date().toISOString()}:action==='reject'?{status:'draft',approved_by:null,approved_at:null}:action==='cancel_schedule'?{status:'approved',scheduled_at:null}:null;
  if(!patch)return apiJson({error:'Unsupported content action.'},400);
  const {data,error}=await ctx.db.from('growth_content').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).eq('status',current.status).select('id,title,status,scheduled_at,platform').maybeSingle();
  if(error||!data)return apiJson({error:'Content status could not be updated.'},400);
  return apiJson({content:data,note:'Content status updated.'});
 }catch{return apiJson({error:'Invalid content action.'},400);}
}
