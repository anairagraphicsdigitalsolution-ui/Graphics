import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 const organizationId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const {data,error}=await ctx.db.from('growth_ad_activation_audit').select('id,campaign_draft_id,action,requested_daily_budget_minor,calculated_daily_budget_minor,status,provider_response,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(50);
 if(error)return apiJson({error:'Activation audit unavailable. Apply v6.62 migration.'},500);
 return apiJson({audit:data||[]});
}
async function setMetaStatus(version:string,id:string,status:'ACTIVE'|'PAUSED',token:string){
 const params=new URLSearchParams({status,access_token:token});
 const response=await fetch(`https://graph.facebook.com/${version}/${id}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body.success===false)throw new Error(String(body?.error?.message||`Meta status update failed for ${id}.`).slice(0,800));
 return body;
}
export async function POST(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 let auditId:string|undefined;
 try{
  const b=await req.json(),organizationId=String(b.organizationId||''),campaignDraftId=String(b.campaignDraftId||''),socialAccountId=String(b.socialAccountId||''),cap=Number(b.maxDailyBudgetMinor);
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner']))return apiJson({error:'Campaign activation requires the workspace OWNER role.'},403);
  if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'Ads activation is not included in this workspace plan.'},402);
  if(b.confirmation!=='ACTIVATE')return apiJson({error:'Type ACTIVATE to confirm the explicit campaign activation.'},400);
  if(!Number.isSafeInteger(cap)||cap<1)return apiJson({error:'Enter a positive maximum daily budget in currency minor units.'},400);
  const {data:campaign}=await ctx.db.from('growth_ad_campaign_drafts').select('id,name,ad_account_id,provider_campaign_id,status,activation_status,currency').eq('id',campaignDraftId).eq('organization_id',organizationId).maybeSingle();
  if(!campaign||campaign.status!=='submitted'||!campaign.provider_campaign_id)return apiJson({error:'Campaign must already exist in Meta in PAUSED state.'},409);
  if(campaign.activation_status==='active')return apiJson({error:'Campaign is already marked active. Use the pause control first.'},409);
  const {data:adsets,error:adsetError}=await ctx.db.from('growth_adset_drafts').select('id,name,provider_adset_id,status,daily_budget_minor,activation_status').eq('organization_id',organizationId).eq('campaign_draft_id',campaignDraftId);
  if(adsetError||!adsets?.length)return apiJson({error:'No submitted Ad Sets found for this campaign.'},409);
  if(adsets.some((x:any)=>x.status!=='submitted'||!x.provider_adset_id))return apiJson({error:'Every Ad Set must be submitted to Meta before activation.'},409);
  const adsetIds=adsets.map((x:any)=>x.id);
  const {data:ads,error:adError}=await ctx.db.from('growth_ad_drafts').select('id,name,adset_draft_id,provider_ad_id,status,activation_status').eq('organization_id',organizationId).in('adset_draft_id',adsetIds);
  if(adError||!ads?.length)return apiJson({error:'At least one submitted Ad is required before activation.'},409);
  if(ads.some((x:any)=>x.status!=='submitted'||!x.provider_ad_id))return apiJson({error:'Every Ad must be submitted to Meta before campaign activation.'},409);
  const total=adsets.reduce((sum:number,x:any)=>sum+Number(x.daily_budget_minor||0),0);
  if(!Number.isSafeInteger(total)||total<1||total>cap)return apiJson({error:`Combined Ad Set daily budget (${total}) exceeds the approved cap (${cap}) or is invalid.`},400);
  const {data:account}=await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id',socialAccountId).eq('organization_id',organizationId).maybeSingle();
  if(!account||account.platform!=='facebook'||account.connection_status!=='connected')return apiJson({error:'Choose a connected Facebook Page.'},409);
  if(!Array.isArray(account.scopes)||!account.scopes.includes('ads_management'))return apiJson({error:'Connected Facebook account does not have ads_management permission.'},403);
  const credentials=decryptSecret(account.encrypted_credentials),version=process.env.META_GRAPH_API_VERSION;
  if(!credentials?.access_token||!version)return apiJson({error:'Meta credentials or Graph API version are unavailable.'},503);
  const {data:audit,error:auditError}=await ctx.db.from('growth_ad_activation_audit').insert({organization_id:organizationId,campaign_draft_id:campaignDraftId,action:'activate',requested_daily_budget_minor:cap,calculated_daily_budget_minor:total,status:'pending',requested_by:ctx.userId}).select('id').single();
  if(auditError||!audit)return apiJson({error:'Could not write activation audit record; activation blocked.'},500);
  auditId=audit.id;
  const changed:string[]=[];
  try{
   for(const ad of ads){await setMetaStatus(version,String(ad.provider_ad_id),'ACTIVE',credentials.access_token);changed.push(String(ad.provider_ad_id));}
   for(const adset of adsets){await setMetaStatus(version,String(adset.provider_adset_id),'ACTIVE',credentials.access_token);changed.push(String(adset.provider_adset_id));}
   await setMetaStatus(version,String(campaign.provider_campaign_id),'ACTIVE',credentials.access_token);changed.push(String(campaign.provider_campaign_id));
  }catch(e){
   const rollbackErrors:string[]=[];
   for(const id of [...changed].reverse()){try{await setMetaStatus(version,id,'PAUSED',credentials.access_token);}catch(err){rollbackErrors.push(err instanceof Error?err.message:'Rollback failed.');}}
   await ctx.db.from('growth_ad_campaign_drafts').update({activation_status:rollbackErrors.length?'activation_failed':'paused',updated_at:new Date().toISOString()}).eq('id',campaignDraftId);
   await ctx.db.from('growth_adset_drafts').update({activation_status:rollbackErrors.length?'activation_failed':'paused',updated_at:new Date().toISOString()}).eq('organization_id',organizationId).in('id',adsetIds);
   await ctx.db.from('growth_ad_drafts').update({activation_status:rollbackErrors.length?'activation_failed':'paused',updated_at:new Date().toISOString()}).eq('organization_id',organizationId).in('id',ads.map((x:any)=>x.id));
   await ctx.db.from('growth_ad_activation_audit').update({status:rollbackErrors.length?'failed':'rolled_back',provider_response:{error:e instanceof Error?e.message:'Activation failed.',rollback_errors:rollbackErrors}}).eq('id',auditId);
   return apiJson({error:e instanceof Error?e.message:'Meta activation failed.',rolledBack:rollbackErrors.length===0,rollbackErrors},502);
  }
  const now=new Date().toISOString();
  await Promise.all([
   ctx.db.from('growth_ad_campaign_drafts').update({activation_status:'active',updated_at:now}).eq('id',campaignDraftId),
   ctx.db.from('growth_adset_drafts').update({activation_status:'active',updated_at:now}).eq('organization_id',organizationId).in('id',adsetIds),
   ctx.db.from('growth_ad_drafts').update({activation_status:'active',updated_at:now}).eq('organization_id',organizationId).in('id',ads.map((x:any)=>x.id)),
   ctx.db.from('growth_ad_activation_audit').update({status:'succeeded',provider_response:{activated_ads:ads.length,activated_adsets:adsets.length,campaign_id:campaign.provider_campaign_id}}).eq('id',auditId)
  ]);
  return apiJson({success:true,status:'ACTIVE',campaign:campaign.name,activatedAds:ads.length,activatedAdsets:adsets.length,dailyBudgetMinor:total,approvedCapMinor:cap,auditId});
 }catch(e){
  if(auditId)await ctx.db.from('growth_ad_activation_audit').update({status:'failed',provider_response:{error:e instanceof Error?e.message:'Activation failed.'}}).eq('id',auditId);
  return apiJson({error:e instanceof Error?e.message:'Campaign activation failed.'},502);
 }
}
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),organizationId=String(b.organizationId||''),campaignDraftId=String(b.campaignDraftId||''),socialAccountId=String(b.socialAccountId||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner']))return apiJson({error:'Emergency pause requires workspace OWNER role.'},403);
  if(b.confirmation!=='PAUSE')return apiJson({error:'Type PAUSE to confirm the emergency pause.'},400);
  const {data:campaign}=await ctx.db.from('growth_ad_campaign_drafts').select('provider_campaign_id').eq('id',campaignDraftId).eq('organization_id',organizationId).maybeSingle();
  if(!campaign?.provider_campaign_id)return apiJson({error:'Campaign provider ID is missing.'},404);
  const {data:adsets}=await ctx.db.from('growth_adset_drafts').select('id,provider_adset_id').eq('organization_id',organizationId).eq('campaign_draft_id',campaignDraftId);
  const ids=(adsets||[]).map((x:any)=>x.id);
  const {data:ads}=await ctx.db.from('growth_ad_drafts').select('id,provider_ad_id').eq('organization_id',organizationId).in('adset_draft_id',ids);
  const {data:account}=await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id',socialAccountId).eq('organization_id',organizationId).maybeSingle();
  if(!account||account.platform!=='facebook'||account.connection_status!=='connected'||!Array.isArray(account.scopes)||!account.scopes.includes('ads_management'))return apiJson({error:'Connected Facebook account with ads_management permission is required.'},403);
  const credentials=decryptSecret(account.encrypted_credentials),version=process.env.META_GRAPH_API_VERSION;if(!credentials?.access_token||!version)return apiJson({error:'Meta credentials unavailable.'},503);
  const errors:string[]=[];
  for(const id of [...(ads||[]).map((x:any)=>x.provider_ad_id),...(adsets||[]).map((x:any)=>x.provider_adset_id),campaign.provider_campaign_id].filter(Boolean)){
   try{await setMetaStatus(version,String(id),'PAUSED',credentials.access_token);}catch(e){errors.push(e instanceof Error?e.message:'Pause failed.');}
  }
  const status=errors.length?'activation_failed':'paused',now=new Date().toISOString();
  await Promise.all([
   ctx.db.from('growth_ad_campaign_drafts').update({activation_status:status,updated_at:now}).eq('id',campaignDraftId),
   ctx.db.from('growth_adset_drafts').update({activation_status:status,updated_at:now}).eq('organization_id',organizationId).in('id',ids),
   ctx.db.from('growth_ad_drafts').update({activation_status:status,updated_at:now}).eq('organization_id',organizationId).in('id',(ads||[]).map((x:any)=>x.id)),
   ctx.db.from('growth_ad_activation_audit').insert({organization_id:organizationId,campaign_draft_id:campaignDraftId,action:'pause',status:errors.length?'failed':'succeeded',requested_by:ctx.userId,provider_response:{errors}})
  ]);
  return apiJson({success:errors.length===0,status,errors},errors.length?502:200);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Pause request failed.'},502);}
}
