import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole,requireGrowthFeature} from '@/lib/growth-server';
export const runtime='nodejs';

function ageMinutes(value:any,now:number):number|null{const at=Date.parse(String(value||''));return Number.isFinite(at)?Math.max(0,Math.floor((now-at)/60000)):null;}
function isStaleLease(value:any,now:number,threshold:number):boolean{const age=ageMinutes(value,now);return age!==null&&age>=threshold;}
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const organizationId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,organizationId,['owner','manager','editor','viewer','client']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(c.db,c.userId,organizationId,'automation'))return apiJson({error:'Workflow Automation is not included in this workspace plan.'},402);
 const [runsResult,deadResult,deadCountResult,schedulesResult,jobsResult]=await Promise.all([
  c.db.from('growth_workflow_runs').select('id,rule_id,status,attempts,max_attempts,locked_at,next_run_at,last_error,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(500),
  c.db.from('growth_workflow_dead_letters').select('id,run_id,rule_id,lead_id,error_message,attempts,failed_at,status,resolved_at,resolution').eq('organization_id',organizationId).order('failed_at',{ascending:false}).limit(50),
  c.db.from('growth_workflow_dead_letters').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('status','open'),
  c.db.from('growth_autonomous_schedules').select('id,name,schedule_type,enabled,next_run_at,last_run_at,locked_at,attempts,max_attempts,last_error').eq('organization_id',organizationId).order('next_run_at',{ascending:true}).limit(100),
  c.db.from('growth_jobs').select('id,job_type,status,run_at,locked_at,last_error,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(500)
 ]);
 const errors=[runsResult.error,deadResult.error,deadCountResult.error,schedulesResult.error,jobsResult.error].filter(Boolean).map((e:any)=>String(e.message||'A reliability data source could not be loaded.'));
 const now=Date.now(),runs=runsResult.data||[],deadLetters=deadResult.data||[],schedules=schedulesResult.data||[],jobs=jobsResult.data||[];
 const count=(items:any[],status:string)=>items.filter(x=>x.status===status).length;
 const staleRuns=runs.filter((x:any)=>x.status==='running'&&isStaleLease(x.locked_at,now,10));
 const staleSchedules=schedules.filter((x:any)=>x.enabled&&isStaleLease(x.locked_at,now,20));
 const staleJobs=jobs.filter((x:any)=>x.status==='processing'&&isStaleLease(x.locked_at,now,10));
 const dueRuns=runs.filter((x:any)=>['queued','running'].includes(x.status)&&Date.parse(x.next_run_at||'')<=now);
 return apiJson({sampledAt:new Date(now).toISOString(),sampleCaps:{workflowRuns:500,jobs:500,schedules:100,deadLetters:50},warnings:errors,metrics:{workflowRunsSampled:runs.length,workflowQueued:count(runs,'queued'),workflowRunning:count(runs,'running'),workflowFailed:count(runs,'failed'),workflowSucceeded:count(runs,'succeeded'),workflowDue:dueRuns.length,workflowStaleLeases:staleRuns.length,openDeadLetters:Number(deadCountResult.count??count(deadLetters,'open')),autonomousSchedules:schedules.length,enabledSchedules:schedules.filter((x:any)=>x.enabled).length,staleScheduleLeases:staleSchedules.length,processingJobs:count(jobs,'processing'),failedJobs:count(jobs,'failed'),staleJobLeases:staleJobs.length},deadLetters,schedules,runs:runs.slice(0,30),stale:{workflowRuns:staleRuns.map((x:any)=>({id:x.id,lockedAt:x.locked_at,attempts:x.attempts,maxAttempts:x.max_attempts})),schedules:staleSchedules.map((x:any)=>({id:x.id,name:x.name,lockedAt:x.locked_at,attempts:x.attempts,maxAttempts:x.max_attempts})),jobs:staleJobs.map((x:any)=>({id:x.id,jobType:x.job_type,lockedAt:x.locked_at}))}});
}
