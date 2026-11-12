import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';
export const runtime = 'nodejs';
const asInt=(v:unknown)=>{const n=Number(v);return Number.isSafeInteger(n)?n:null;};
async function getProvider(ctx:any, orgId:string, socialAccountId:string){
 const {data:account}=await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id',socialAccountId).eq('organization_id',orgId).maybeSingle();
 if(!account||account.platform!=='facebook'||account.connection_status!=='connected')throw new Error('Connect a Facebook account before applying optimization.');
 if(!Array.isArray(account.scopes)||!account.scopes.includes('ads_management'))throw new Error('Reconnect Meta and grant ads_management permission.');
 const credentials=decryptSecret(account.encrypted_credentials),version=process.env.META_GRAPH_API_VERSION;
 if(!credentials?.access_token||!version)throw new Error('Meta credentials or META_GRAPH_API_VERSION are unavailable.');
 return {token:credentials.access_token,version};
}
async function graph(token:string,version:string,campaignId:string,params?:Record<string,string>){
 const url=`https://graph.facebook.com/${version}/${encodeURIComponent(campaignId)}`;
 if(!params){const r=await fetch(`${url}?fields=id,name,status,effective_status,daily_budget,lifetime_budget&access_token=${encodeURIComponent(token)}`,{cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||'Could not read campaign state.');return d;}
 const body=new URLSearchParams({...params,access_token:token});const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d?.error?.message||'Meta rejected the optimization action.');return d;
}
export async function GET(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(ctx.db,ctx.userId,orgId,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const {data,error}=await ctx.db.from('growth_campaign_optimization_actions').select('*').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(100);
 if(error)return apiJson({error:'Optimization action history unavailable. Apply the Phase 31 migration.'},500);return apiJson({actions:data||[]});
}
export async function POST(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),socialAccountId=String(b.socialAccountId||''),campaignId=String(b.campaignId||''),actionType=String(b.actionType||''),reason=String(b.reason||'AI optimization recommendation').slice(0,700);
  if(!await requireGrowthRole(ctx.db,ctx.userId,orgId,['owner','manager']))return apiJson({error:'Owner or manager permission required.'},403);
  if(!await requireGrowthFeature(ctx.db,ctx.userId,orgId,'ads'))return apiJson({error:'Ads module is not included in this workspace plan.'},402);
  if(!socialAccountId||!/^\d{5,40}$/.test(campaignId)||!['set_daily_budget','pause_campaign','resume_campaign'].includes(actionType))return apiJson({error:'A valid connected account, campaign ID and supported action are required.'},400);
  const {token,version}=await getProvider(ctx,orgId,socialAccountId);const current=await graph(token,version,campaignId);
  let before:any={},proposed:any={};
  if(actionType==='set_daily_budget'){
   const next=asInt(b.dailyBudgetMinor),prior=asInt(current.daily_budget);const cap=Number(process.env.MAX_META_DAILY_BUDGET_MINOR||100000000);const maxPct=Number(process.env.MAX_AUTOMATED_BUDGET_CHANGE_PERCENT||20);
   if(next===null||next<100||next>cap||prior===null||prior<=0)return apiJson({error:'Campaign must have an existing daily budget; proposed budget must be within the configured cap.'},400);
   if(Math.abs(next-prior)/prior*100>maxPct)return apiJson({error:`Budget change exceeds the ${maxPct}% approval safety limit. Adjust the limit only through server configuration.`},400);
   before={daily_budget:prior};proposed={daily_budget:next};
  }else{before={status:String(current.status||current.effective_status||'PAUSED')};proposed={status:actionType==='pause_campaign'?'PAUSED':'ACTIVE'};}
  const {data,error}=await ctx.db.from('growth_campaign_optimization_actions').insert({organization_id:orgId,campaign_id:campaignId,campaign_name:String(current.name||'Meta campaign').slice(0,180),ad_account_id:String(b.adAccountId||''),social_account_id:socialAccountId,action_type:actionType,before_value:before,proposed_value:proposed,reason,status:'pending_approval',created_by:ctx.userId}).select('*').single();
  if(error)return apiJson({error:'Could not save optimization proposal.'},500);
  return apiJson({success:true,action:data,notice:'Proposal recorded. No Meta campaign setting has changed. An owner or manager must explicitly approve it.'},201);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Could not create optimization proposal.'},400);}
}
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.id||''),operation=String(b.operation||'approve'),socialAccountId=String(b.socialAccountId||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,orgId,['owner','manager']))return apiJson({error:'Only workspace owner or manager can approve or roll back changes.'},403);
  if(!await requireGrowthFeature(ctx.db,ctx.userId,orgId,'ads'))return apiJson({error:'Ads module is not included in this workspace plan.'},402);
  const {data:action}=await ctx.db.from('growth_campaign_optimization_actions').select('*').eq('id',id).eq('organization_id',orgId).maybeSingle();if(!action)return apiJson({error:'Optimization proposal not found.'},404);
  if(operation==='reject'){
   if(action.status!=='pending_approval')return apiJson({error:'Only pending proposals can be rejected.'},409);
   const {data}=await ctx.db.from('growth_campaign_optimization_actions').update({status:'rejected',approved_by:ctx.userId,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).select('*').single();return apiJson({success:true,action:data});
  }
  if(operation!=='approve'&&operation!=='rollback')return apiJson({error:'Unsupported operation.'},400);
  if(operation==='approve'&&action.status!=='pending_approval')return apiJson({error:'Only pending proposals can be approved.'},409);
  if(operation==='rollback'&&action.status!=='applied')return apiJson({error:'Only applied actions can be rolled back.'},409);
  const provider=await getProvider(ctx,orgId,socialAccountId||String(action.social_account_id||''));
  const expected=operation==='approve'?action.before_value:action.proposed_value;
  const target=operation==='approve'?action.proposed_value:action.before_value;
  const current=await graph(provider.token,provider.version,action.campaign_id);
  if(action.action_type==='set_daily_budget'){
   const currentBudget=asInt(current.daily_budget);if(currentBudget===null||currentBudget!==asInt(expected.daily_budget))return apiJson({error:'Campaign budget changed since this proposal was created. Refresh insights and create a new proposal.'},409);
  }else{
   const live=String(current.status||current.effective_status||'').toUpperCase();const expectedStatus=String(expected.status||'').toUpperCase();if(live!==expectedStatus)return apiJson({error:'Campaign status changed since this proposal was created. Refresh before applying.'},409);
  }
  const providerParams: Record<string, string> = action.action_type === 'set_daily_budget'
   ? { daily_budget: String(target.daily_budget) }
   : { status: String(target.status) };
  const providerResult=await graph(provider.token,provider.version,action.campaign_id,providerParams);
  const now=new Date().toISOString();const patch=operation==='approve'?{status:'applied',approved_by:ctx.userId,approved_at:now,applied_at:now,provider_response:providerResult,error_message:null,updated_at:now}:{status:'rolled_back',rolled_back_at:now,provider_response:providerResult,error_message:null,updated_at:now};
  const {data,error}=await ctx.db.from('growth_campaign_optimization_actions').update(patch).eq('id',id).eq('organization_id',orgId).select('*').single();if(error)return apiJson({error:'Meta action applied but audit update failed. Reconcile provider state before retrying.'},500);
  await ctx.db.from('growth_platform_audit_events').insert({organization_id:orgId,actor_user_id:ctx.userId,event_type:operation==='approve'?'growth.campaign_optimization.applied':'growth.campaign_optimization.rolled_back',metadata:{action_id:id,campaign_id:action.campaign_id,action_type:action.action_type}});
  return apiJson({success:true,action:data,providerResult});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Optimization action failed.'},502);}
}
