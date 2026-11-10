import { NextRequest } from 'next/server';
import {apiJson, growthContext, requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';
export const runtime='nodejs';

export async function GET(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 const organizationId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
 const {data,error}=await ctx.db.from('growth_ad_drafts').select('id,adset_draft_id,creative_draft_id,name,status,provider_ad_id,last_error,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);
 if(error)return apiJson({error:'Ad drafts unavailable. Apply the v6.60 migration.'},500);
 return apiJson({ads:data||[]});
}
export async function POST(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),organizationId=String(b.organizationId||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','editor']))return apiJson({error:'Ad editor permission required.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  const adsetDraftId=String(b.adsetDraftId||''),creativeDraftId=String(b.creativeDraftId||''),name=String(b.name||'').trim();
  if(name.length<3||name.length>180)return apiJson({error:'Ad name must contain 3–180 characters.'},400);
  const [{data:adset},{data:creative}]=await Promise.all([
   ctx.db.from('growth_adset_drafts').select('id').eq('id',adsetDraftId).eq('organization_id',organizationId).maybeSingle(),
   ctx.db.from('growth_ad_creative_drafts').select('id,adset_draft_id').eq('id',creativeDraftId).eq('organization_id',organizationId).maybeSingle()
  ]);
  if(!adset||!creative)return apiJson({error:'Select an Ad Set and Creative from this workspace.'},404);
  if(creative.adset_draft_id&&creative.adset_draft_id!==adsetDraftId)return apiJson({error:'Creative is attached to a different Ad Set.'},409);
  const {data,error}=await ctx.db.from('growth_ad_drafts').insert({organization_id:organizationId,adset_draft_id:adsetDraftId,creative_draft_id:creativeDraftId,name}).select('id,name,status,adset_draft_id,creative_draft_id').single();
  if(error)return apiJson({error:'Could not save Ad draft. A creative can only be linked to one Ad draft.'},500);
  return apiJson({success:true,ad:data,note:'Ad draft saved. Meta ad is not created until owner/manager submission.'},201);
 }catch{return apiJson({error:'Invalid Ad draft.'},400);}
}
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),organizationId=String(b.organizationId||''),id=String(b.id||''),socialAccountId=String(b.socialAccountId||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager']))return apiJson({error:'Only workspace owner or manager can submit an Ad.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  const {data:draft,error}=await ctx.db.from('growth_ad_drafts').select('*').eq('id',id).eq('organization_id',organizationId).eq('status','draft').maybeSingle();
  if(error||!draft)return apiJson({error:'Ad draft not found or already submitted.'},404);
  const [{data:adset},{data:creative}]=await Promise.all([
   ctx.db.from('growth_adset_drafts').select('provider_adset_id,status').eq('id',draft.adset_draft_id).eq('organization_id',organizationId).maybeSingle(),
   ctx.db.from('growth_ad_creative_drafts').select('provider_creative_id,status').eq('id',draft.creative_draft_id).eq('organization_id',organizationId).maybeSingle()
  ]);
  if(!adset?.provider_adset_id||adset.status!=='submitted')return apiJson({error:'Parent Ad Set must be submitted to Meta first.'},409);
  if(!creative?.provider_creative_id||creative.status!=='submitted')return apiJson({error:'Creative must be submitted to Meta first.'},409);
  const {data:account}=await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id',socialAccountId).eq('organization_id',organizationId).maybeSingle();
  if(!account||account.platform!=='facebook'||account.connection_status!=='connected')return apiJson({error:'Select a connected Facebook Page.'},409);
  if(!Array.isArray(account.scopes)||!account.scopes.includes('ads_management'))return apiJson({error:'Facebook connection does not have ads_management permission.'},403);
  const credentials=decryptSecret(account.encrypted_credentials),version=process.env.META_GRAPH_API_VERSION;
  if(!credentials?.access_token||!version)return apiJson({error:'Meta credentials or Graph API version are unavailable.'},503);
  const params=new URLSearchParams({name:draft.name,adset_id:String(adset.provider_adset_id),creative:JSON.stringify({creative_id:String(creative.provider_creative_id)}),status:'PAUSED',access_token:credentials.access_token});
  // Resolve the ad account from the parent campaign before calling Meta.
  const {data:adsetRow}=await ctx.db.from('growth_adset_drafts').select('campaign_draft_id').eq('id',draft.adset_draft_id).eq('organization_id',organizationId).maybeSingle();
  const {data:campaign}=adsetRow?await ctx.db.from('growth_ad_campaign_drafts').select('ad_account_id').eq('id',adsetRow.campaign_draft_id).eq('organization_id',organizationId).maybeSingle():{data:null};
  if(!campaign?.ad_account_id)return apiJson({error:'Parent ad account could not be resolved.'},409);
  const metaResponse=await fetch(`https://graph.facebook.com/${version}/${campaign.ad_account_id}/ads`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,cache:'no-store'});
  const result=await metaResponse.json().catch(()=>({}));
  if(!metaResponse.ok||!result.id){const message=String(result?.error?.message||'Meta Ad creation failed.').slice(0,1000);await ctx.db.from('growth_ad_drafts').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',draft.id);return apiJson({error:message},502);}
  const now=new Date().toISOString(),{error:updateError}=await ctx.db.from('growth_ad_drafts').update({status:'submitted',provider_ad_id:String(result.id),approved_by:ctx.userId,approved_at:now,last_error:null,updated_at:now}).eq('id',draft.id).eq('status','draft');
  if(updateError)return apiJson({success:true,adId:String(result.id),status:'PAUSED',warning:'Meta created the paused Ad but local status update failed. Reconcile before retrying.'},202);
  return apiJson({success:true,adId:String(result.id),status:'PAUSED',message:'Meta Ad created PAUSED. No delivery or spend is activated.'});
 }catch{return apiJson({error:'Ad submission failed.'},502);}
}
