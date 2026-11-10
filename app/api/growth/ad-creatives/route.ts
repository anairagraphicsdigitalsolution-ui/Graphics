import { NextRequest } from 'next/server';
import {apiJson, growthContext, requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
export const runtime = 'nodejs';
const FORMATS = new Set(['IMAGE','VIDEO','CAROUSEL']);
const CTAS = new Set(['LEARN_MORE','SHOP_NOW','SIGN_UP','CONTACT_US','BOOK_NOW','GET_QUOTE','APPLY_NOW','SUBSCRIBE','DOWNLOAD','WATCH_MORE']);
function safePublicUrl(value: unknown): string | null { if(typeof value!=='string'||value.length>2048)return null; try { const u=new URL(value); if(u.protocol!=='https:'||u.username||u.password)return null; const h=u.hostname.toLowerCase(); if(h==='localhost'||h.endsWith('.localhost')||h==='127.0.0.1'||h==='::1'||h.startsWith('10.')||h.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(h))return null; return u.toString(); } catch{return null;} }
export async function GET(req:NextRequest){const ctx=await growthContext(req);if('response'in ctx)return ctx.response;const organizationId=req.nextUrl.searchParams.get('organizationId')||'';if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);const {data,error}=await ctx.db.from('growth_ad_creative_drafts').select('id,adset_draft_id,name,format,primary_text,headline,description,destination_url,call_to_action,media_urls,status,provider_creative_id,last_error,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);if(error)return apiJson({error:'Creative drafts unavailable. Apply the v6.58 migration.'},500);return apiJson({creatives:data||[]});}
export async function POST(req:NextRequest){const ctx=await growthContext(req);if('response'in ctx)return ctx.response;try{const b=await req.json();const organizationId=String(b.organizationId||'');if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','editor']))return apiJson({error:'Creative editor permission required.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);const name=String(b.name||'').trim(),format=String(b.format||'IMAGE'),primaryText=String(b.primaryText||'').trim(),headline=String(b.headline||'').trim()||null,description=String(b.description||'').trim()||null,destinationUrl=safePublicUrl(b.destinationUrl),cta=String(b.callToAction||'LEARN_MORE'),urls=Array.isArray(b.mediaUrls)?b.mediaUrls.map(safePublicUrl):[];if(name.length<3||name.length>180)return apiJson({error:'Creative name must contain 3–180 characters.'},400);if(!FORMATS.has(format)||!CTAS.has(cta))return apiJson({error:'Unsupported creative format or call to action.'},400);if(!primaryText||primaryText.length>5000||(headline&&headline.length>255)||(description&&description.length>1000))return apiJson({error:'Check primary text, headline and description lengths.'},400);if(!destinationUrl)return apiJson({error:'Destination must be a valid public HTTPS URL.'},400);const min=format==='CAROUSEL'?2:1,max=format==='CAROUSEL'?10:1;if(urls.length<min||urls.length>max||urls.some((u:string|null)=>!u))return apiJson({error:`This format requires ${min===max?min:`${min}–${max}`} valid public HTTPS media URL(s).`},400);const adsetDraftId=String(b.adsetDraftId||'').trim()||null;if(adsetDraftId){const {data:adset}=await ctx.db.from('growth_adset_drafts').select('id').eq('id',adsetDraftId).eq('organization_id',organizationId).maybeSingle();if(!adset)return apiJson({error:'Selected ad set does not belong to this workspace.'},404);}const {data,error}=await ctx.db.from('growth_ad_creative_drafts').insert({organization_id:organizationId,adset_draft_id:adsetDraftId,name,format,primary_text:primaryText,headline,description,destination_url:destinationUrl,call_to_action:cta,media_urls:urls}).select('id,name,format,status,adset_draft_id,created_at').single();if(error)return apiJson({error:'Could not save creative draft.'},500);return apiJson({success:true,creative:data,note:'Saved as draft only. No Meta creative, ad, or spend has been created.'},201);}catch{return apiJson({error:'Invalid creative draft.'},400);}}


// Owner/manager-only Meta creative submission. Currently supports single-image link ads;
// video and carousel remain draft-only until their media upload/child-attachment pipeline exists.
export async function PATCH(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json();const organizationId=String(b.organizationId||''),id=String(b.id||''),socialAccountId=String(b.socialAccountId||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager']))return apiJson({error:'Only workspace owner or manager can submit a creative.'},403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  const {data:creative,error}=await ctx.db.from('growth_ad_creative_drafts').select('*').eq('id',id).eq('organization_id',organizationId).eq('status','draft').maybeSingle();
  if(error||!creative)return apiJson({error:'Creative draft not found or already submitted.'},404);
  if(!['IMAGE','VIDEO','CAROUSEL'].includes(creative.format))return apiJson({error:'Unsupported creative format.'},400);
  if(!creative.adset_draft_id)return apiJson({error:'Attach this creative to an Ad Set draft before submission.'},409);
  const {data:adset}=await ctx.db.from('growth_adset_drafts').select('id,status,provider_adset_id,campaign_draft_id').eq('id',creative.adset_draft_id).eq('organization_id',organizationId).maybeSingle();
  if(!adset?.provider_adset_id||adset.status!=='submitted')return apiJson({error:'Submit the parent Ad Set first. It must exist in Meta in PAUSED state.'},409);
  const {data:campaign}=await ctx.db.from('growth_ad_campaign_drafts').select('ad_account_id').eq('id',adset.campaign_draft_id).eq('organization_id',organizationId).maybeSingle();
  if(!campaign?.ad_account_id)return apiJson({error:'Parent campaign/ad account could not be resolved.'},409);
  const {data:account}=await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id',socialAccountId).eq('organization_id',organizationId).maybeSingle();
  if(!account||account.platform!=='facebook'||account.connection_status!=='connected')return apiJson({error:'Select a connected Facebook Page.'},409);
  if(!Array.isArray(account.scopes)||!account.scopes.includes('ads_management'))return apiJson({error:'Facebook connection does not have ads_management permission. Reconnect and grant it.'},403);
  const {decryptSecret}=await import('@/lib/growth-crypto');const credentials=decryptSecret(account.encrypted_credentials);
  const version=process.env.META_GRAPH_API_VERSION;if(!credentials?.access_token||!credentials?.page_id||!version)return apiJson({error:'Meta Page credentials or Graph API version are unavailable.'},503);
  const media=Array.isArray(creative.media_urls)?creative.media_urls:[];const urls=media.map((x:unknown)=>safePublicUrl(x));
  const link=safePublicUrl(creative.destination_url);
  if(!link||urls.some((x:string|null)=>!x))return apiJson({error:'Creative media and destination must be public HTTPS URLs.'},400);
  let linkData:any;
  if(creative.format==='IMAGE'){
    if(urls.length!==1)return apiJson({error:'Image creative requires exactly one media URL.'},400);
    linkData={link,picture:urls[0],message:creative.primary_text,name:creative.headline||creative.name,description:creative.description||undefined,call_to_action:{type:creative.call_to_action,value:{link}}};
  } else if(creative.format==='CAROUSEL'){
    if(urls.length<2||urls.length>10)return apiJson({error:'Carousel requires 2–10 image URLs.'},400);
    linkData={link,message:creative.primary_text,child_attachments:urls.map((picture:string|null,index:number)=>({link,picture,name:index===0?(creative.headline||creative.name):undefined,description:creative.description||undefined,call_to_action:{type:creative.call_to_action,value:{link}}}))};
  } else {
    if(urls.length!==1)return apiJson({error:'Video creative requires exactly one public video URL.'},400);
    const uploadParams=new URLSearchParams({file_url:String(urls[0]),title:creative.headline||creative.name,description:creative.primary_text,access_token:credentials.access_token});
    const uploadResponse=await fetch(`https://graph.facebook.com/${version}/${campaign.ad_account_id}/advideos`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:uploadParams,cache:'no-store'});
    const uploadResult=await uploadResponse.json().catch(()=>({}));
    if(!uploadResponse.ok||!uploadResult.id){const message=String(uploadResult?.error?.message||'Meta video upload failed.').slice(0,1000);return apiJson({error:message},502);}
    linkData={video_id:String(uploadResult.id),message:creative.primary_text,title:creative.headline||creative.name,link_description:creative.description||undefined,call_to_action:{type:creative.call_to_action,value:{link}}};
  }
  const story={page_id:String(credentials.page_id),...(creative.format==='VIDEO'?{video_data:linkData}:{link_data:linkData})};
  const params=new URLSearchParams({name:creative.name,object_story_spec:JSON.stringify(story),access_token:credentials.access_token});
  const response=await fetch(`https://graph.facebook.com/${version}/${campaign.ad_account_id}/adcreatives`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.id){const message=String(result?.error?.message||'Meta creative creation failed.').slice(0,1000);await ctx.db.from('growth_ad_creative_drafts').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',creative.id);return apiJson({error:message},502);}
  const now=new Date().toISOString();const {error:updateError}=await ctx.db.from('growth_ad_creative_drafts').update({status:'submitted',provider_creative_id:String(result.id),approved_by:ctx.userId,approved_at:now,last_error:null,updated_at:now}).eq('id',creative.id).eq('status','draft');
  if(updateError)return apiJson({success:true,creativeId:String(result.id),warning:'Meta created the creative, but local status update failed. Reconcile before retrying.'},202);
  return apiJson({success:true,creativeId:String(result.id),status:'CREATED',message:'Meta creative created. No ad is active and no spend has been triggered.'});
 }catch{return apiJson({error:'Creative submission failed.'},502);}
}
