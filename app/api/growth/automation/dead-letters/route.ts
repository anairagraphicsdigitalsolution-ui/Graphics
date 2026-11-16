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
  if(!['retry','discard'].includes(action))return apiJson({error:'Unsupported dead-letter action.'},400);
  const {data,error}=await c.db.rpc('resolve_growth_workflow_dead_letter',{p_organization_id:orgId,p_dead_letter_id:id,p_action:action});
  if(error){const message=String(error.message||'');if(message.includes('Manager permission'))return apiJson({error:'Manager permission required.'},403);if(message.includes('not found'))return apiJson({error:'Dead-letter item not found.'},404);if(message.includes('Only open')||message.includes('not eligible'))return apiJson({error:message},409);return apiJson({error:'Unable to resolve dead-letter item atomically.'},500);}
  return apiJson(data||{ok:true,status:action==='retry'?'queued':'discarded'});
 }catch{return apiJson({error:'Invalid dead-letter request.'},400);}
}
