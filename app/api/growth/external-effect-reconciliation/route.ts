import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';

export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Manager permission required.'},403);
 const {data,error}=await c.db.from('growth_jobs').select('id,job_type,status,attempts,max_attempts,last_error,external_effect_started_at,created_at,run_at').eq('organization_id',orgId).eq('status','failed').not('external_effect_started_at','is',null).like('last_error','OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED:%').order('created_at',{ascending:false}).limit(100);
 if(error)return apiJson({error:'External-effect reconciliation queue is unavailable. Apply the reconciliation migration.'},503);
 return apiJson({items:data||[]});
}

export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const body=await req.json();
  const organizationId=String(body.organizationId||'');
  const jobId=String(body.jobId||'');
  const action=String(body.action||'');
  const evidence=String(body.evidence||'').trim();
  if(!jobId||!['confirm_delivered','retry_after_provider_check','discard'].includes(action))return apiJson({error:'A valid jobId and reconciliation action are required.'},400);
  if(evidence.length<12||evidence.length>2000)return apiJson({error:'Add at least 12 characters of provider-check evidence (maximum 2,000).'},400);
  if(!await requireGrowthRole(c.db,c.userId,organizationId,['owner','manager']))return apiJson({error:'Manager permission required.'},403);
  const {data,error}=await c.db.rpc('resolve_growth_external_effect_job',{p_organization_id:organizationId,p_job_id:jobId,p_action:action,p_evidence:evidence});
  if(error){
   const message=error.message||'';
   if(message.includes('JOB_NOT_FOUND'))return apiJson({error:'Job not found in this workspace.'},404);
   if(message.includes('JOB_NOT_PENDING_RECONCILIATION'))return apiJson({error:'Job is no longer awaiting reconciliation.'},409);
   if(message.includes('MANAGER_PERMISSION_REQUIRED'))return apiJson({error:'Manager permission required.'},403);
   return apiJson({error:'Unable to reconcile external job.'},500);
  }
  return apiJson(data||{ok:true});
 }catch{return apiJson({error:'Invalid reconciliation request.'},400);}
}
