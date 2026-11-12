import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime='nodejs';
const allowed=(type:string,config:any)=>{
 if(type==='prospect_discovery')return typeof config.industry==='string'&&config.industry.trim().length>1&&typeof config.location==='string'&&config.location.trim().length>1&&(!config.keywords||typeof config.keywords==='string');
 if(type==='campaign_analysis')return typeof config.socialAccountId==='string'&&config.socialAccountId.length>10&&(!config.targetCPA||Number.isFinite(Number(config.targetCPA))&&Number(config.targetCPA)>=0);
 return false;
};
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
 const [{data:schedules,error},{data:runs,error:runsError}]=await Promise.all([
  c.db.from('growth_autonomous_schedules').select('*').eq('organization_id',orgId).order('created_at',{ascending:false}),
  c.db.from('growth_autonomous_schedule_runs').select('*').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(50)
 ]);
 if(error||runsError)return apiJson({error:'Schedule storage is unavailable. Apply the Phase 31.1 migration.'},503);
 return apiJson({schedules:schedules||[],runs:runs||[]});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),orgId=String(b.organizationId||''),type=String(b.scheduleType||''),name=String(b.name||'').trim().slice(0,120),config=b.config&&typeof b.config==='object'?b.config:{},hours=Number(b.intervalHours||24),maxAttempts=Number(b.maxAttempts||4);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  if(!name||!Number.isInteger(hours)||hours<24||hours>720||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>8||!allowed(type,config))return apiJson({error:'Invalid schedule. Prospect discovery needs industry/location; campaign analysis needs a socialAccountId. Interval must be 24–720 hours.'},400);
  if(type==='campaign_analysis'){
   const {data:account}=await c.db.from('growth_social_accounts').select('id,platform,connection_status,scopes').eq('id',config.socialAccountId).eq('organization_id',orgId).maybeSingle();
   if(!account||account.platform!=='facebook'||account.connection_status!=='connected'||!Array.isArray(account.scopes)||!account.scopes.includes('ads_read'))return apiJson({error:'A connected Meta account with ads_read permission is required.'},409);
  }
  const {data,error}=await c.db.from('growth_autonomous_schedules').insert({organization_id:orgId,schedule_type:type,name,config,interval_hours:hours,max_attempts:maxAttempts,enabled:b.enabled!==false,next_run_at:b.nextRunAt||new Date().toISOString(),created_by:c.userId}).select('*').single();
  if(error)return apiJson({error:'Could not create schedule.'},500);return apiJson({success:true,schedule:data},201);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Could not create schedule.'},400);}
}
export async function PATCH(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.id||'');if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const patch:any={updated_at:new Date().toISOString()};if(typeof b.enabled==='boolean')patch.enabled=b.enabled;if(b.name!==undefined){const name=String(b.name).trim().slice(0,120);if(name.length<2)return apiJson({error:'Schedule name is too short.'},400);patch.name=name;}if(b.intervalHours!==undefined){const n=Number(b.intervalHours);if(!Number.isInteger(n)||n<24||n>720)return apiJson({error:'Interval must be 24–720 hours.'},400);patch.interval_hours=n;}if(b.config!==undefined){if(!b.config||typeof b.config!=='object')return apiJson({error:'Schedule config must be an object.'},400);const {data:current}=await c.db.from('growth_autonomous_schedules').select('schedule_type').eq('id',id).eq('organization_id',orgId).maybeSingle();if(!current||!allowed(current.schedule_type,b.config))return apiJson({error:'Invalid schedule configuration.'},400);patch.config=b.config;}if(b.runNow===true)patch.next_run_at=new Date().toISOString();
  const {data,error}=await c.db.from('growth_autonomous_schedules').update(patch).eq('id',id).eq('organization_id',orgId).select('*').maybeSingle();if(error||!data)return apiJson({error:'Schedule not found or update failed.'},404);return apiJson({success:true,schedule:data});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Could not update schedule.'},400);}
}
export async function DELETE(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;const orgId=req.nextUrl.searchParams.get('organizationId')||'',id=req.nextUrl.searchParams.get('id')||'';if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
 const {error}=await c.db.from('growth_autonomous_schedules').delete().eq('id',id).eq('organization_id',orgId);if(error)return apiJson({error:'Could not delete schedule.'},500);return apiJson({success:true});
}
