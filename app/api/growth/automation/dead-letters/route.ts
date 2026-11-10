import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';

export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const status=req.nextUrl.searchParams.get('status')||'open';
 if(!['open','retried','discarded','all'].includes(status))return apiJson({error:'Invalid dead-letter status.'},400);
 let query=c.db.from('growth_workflow_dead_letters').select('id,run_id,rule_id,lead_id,error_message,attempts,failed_at,status,resolved_at,resolution,created_at').eq('organization_id',orgId).order('failed_at',{ascending:false}).limit(100);
 if(status!=='all')query=query.eq('status',status);
 const {data,error}=await query;
 if(error)return apiJson({error:'Dead-letter queue is unavailable. Apply the workflow DLQ migration.'},503);
 return apiJson({items:data||[]});
}
export async function PATCH(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.id||''),action=String(b.action||'');
  if(!id||!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Manager permission required.'},403);
  const {data:item,error:readError}=await c.db.from('growth_workflow_dead_letters').select('*').eq('id',id).eq('organization_id',orgId).maybeSingle();
  if(readError)return apiJson({error:'Dead-letter queue is unavailable.'},503);
  if(!item)return apiJson({error:'Dead-letter item not found.'},404);
  if(item.status!=='open')return apiJson({error:'Only open dead-letter items can be resolved.'},409);
  if(action==='retry'){
   const {data:run,error}=await c.db.from('growth_workflow_runs').select('id,status').eq('id',item.run_id).eq('rule_id',item.rule_id).eq('organization_id',orgId).maybeSingle();
   if(error||!run)return apiJson({error:'Original workflow run could not be found.'},404);
   if(!['failed','queued'].includes(run.status))return apiJson({error:'Workflow run is not eligible for retry.'},409);
   const now=new Date().toISOString();
   const {error:updateError}=await c.db.from('growth_workflow_runs').update({status:'queued',attempts:0,locked_at:null,next_run_at:now,last_error:null,completed_at:null,updated_at:now}).eq('id',run.id).eq('organization_id',orgId);
   if(updateError)return apiJson({error:'Unable to queue workflow retry.'},500);
   const {error:dlqError}=await c.db.from('growth_workflow_dead_letters').update({status:'retried',resolved_at:now,resolution:'manual_retry',updated_at:now}).eq('id',id).eq('organization_id',orgId).eq('status','open');
   if(dlqError)return apiJson({error:'Run was queued but DLQ status update failed. Refresh before retrying.'},500);
   await c.db.from('growth_workflow_run_events').insert({organization_id:orgId,run_id:run.id,rule_id:item.rule_id,event_type:'dlq_retried',details:{dead_letter_id:id,actor:c.userId}});
   return apiJson({ok:true,status:'queued'});
  }
  if(action==='discard'){
   const now=new Date().toISOString();
   const {error}=await c.db.from('growth_workflow_dead_letters').update({status:'discarded',resolved_at:now,resolution:'manually_discarded',updated_at:now}).eq('id',id).eq('organization_id',orgId).eq('status','open');
   if(error)return apiJson({error:'Unable to discard dead-letter item.'},500);
   await c.db.from('growth_workflow_run_events').insert({organization_id:orgId,run_id:item.run_id,rule_id:item.rule_id,event_type:'dlq_discarded',details:{dead_letter_id:id,actor:c.userId}});
   return apiJson({ok:true,status:'discarded'});
  }
  return apiJson({error:'Unsupported dead-letter action.'},400);
 }catch{return apiJson({error:'Invalid dead-letter request.'},400);}
}
