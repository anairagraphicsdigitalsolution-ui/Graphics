import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
import { decryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
const OBJECTIVES = new Set(['OUTCOME_AWARENESS','OUTCOME_TRAFFIC','OUTCOME_ENGAGEMENT','OUTCOME_LEADS','OUTCOME_SALES','OUTCOME_APP_PROMOTION']);
const GOALS = new Set(['LINK_CLICKS','IMPRESSIONS','REACH','LANDING_PAGE_VIEWS','LEAD_GENERATION','CONVERSIONS','POST_ENGAGEMENT','VIDEO_VIEWS']);
const CTAS = new Set(['LEARN_MORE','SHOP_NOW','SIGN_UP','CONTACT_US','BOOK_NOW','GET_QUOTE','APPLY_NOW','SUBSCRIBE','DOWNLOAD','WATCH_MORE']);
function httpsUrl(value: unknown): string | null { if(typeof value!=='string'||value.length>2048)return null; try { const u=new URL(value); if(u.protocol!=='https:'||u.username||u.password)return null; const h=u.hostname.toLowerCase(); if(h==='localhost'||h.endsWith('.localhost')||h==='127.0.0.1'||h==='::1'||h.startsWith('10.')||h.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(h))return null; return u.toString(); } catch{return null;} }
async function metaPost(version:string,path:string,token:string,values:Record<string,string>){ const p=new URLSearchParams({...values,access_token:token}); const r=await fetch(`https://graph.facebook.com/${version}/${path}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p,cache:'no-store',signal:AbortSignal.timeout(30000)}); const d=await r.json().catch(()=>({})); if(!r.ok||!d.id)throw new Error(String(d?.error?.message||`Meta rejected ${path}.`).slice(0,900)); return String(d.id); }
async function metaPause(version:string,id:string,token:string){const p=new URLSearchParams({status:'PAUSED',access_token:token});const r=await fetch(`https://graph.facebook.com/${version}/${id}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(String(d?.error?.message||'Could not pause Meta object.').slice(0,500));}
export async function POST(req:NextRequest){
 const ctx=await growthContext(req); if('response'in ctx)return ctx.response;
 const created:string[]=[]; let campaignRow:any=null,adsetRow:any=null,creativeRow:any=null,adRow:any=null; let token=''; const version=process.env.META_GRAPH_API_VERSION;
 try{
  const b=await req.json(),org=String(b.organizationId||''),socialAccountId=String(b.socialAccountId||''),adAccountId=String(b.adAccountId||'').trim();
  if(!await requireGrowthRole(ctx.db,ctx.userId,org,['owner','manager']))return apiJson({error:'Only workspace owner or manager can build an Ads Autopilot campaign.'},403);
  if(!await requireGrowthFeature(ctx.db,ctx.userId,org,'ads'))return apiJson({error:'Ads module is not included in this workspace plan.'},402);
  if(!/^act_?\d{5,30}$/.test(adAccountId))return apiJson({error:'A valid Meta Ad Account ID is required.'},400);
  const objective=String(b.objective||'OUTCOME_LEADS'),goal=String(b.optimizationGoal||'LINK_CLICKS'),cta=String(b.callToAction||'LEARN_MORE');
  if(!OBJECTIVES.has(objective)||!GOALS.has(goal)||!CTAS.has(cta))return apiJson({error:'Unsupported campaign objective, optimization goal or CTA.'},400);
  const name=String(b.campaignName||'').trim().slice(0,180),industry=String(b.businessDescription||'').trim().slice(0,1800),audience=String(b.audience||'').trim().slice(0,1200),url=httpsUrl(b.destinationUrl),image=httpsUrl(b.imageUrl);
  const budget=Number(b.dailyBudgetMinor),currency=String(b.currency||'INR').toUpperCase().slice(0,3);
  const targeting=b.targeting&&typeof b.targeting==='object'&&!Array.isArray(b.targeting)?b.targeting:{};
  if(name.length<3||!industry||!audience||!url||!image)return apiJson({error:'Campaign name, business description, audience, public HTTPS landing page and public HTTPS image URL are required.'},400);
  if(!Number.isSafeInteger(budget)||budget<1000||budget>100000000)return apiJson({error:'Daily budget must be at least 1000 minor currency units and within the supported limit.'},400);
  if(!targeting.geo_locations||typeof targeting.geo_locations!=='object'||!Array.isArray(targeting.geo_locations.countries)&&!Array.isArray(targeting.geo_locations.cities)&&!Array.isArray(targeting.geo_locations.regions))return apiJson({error:'Targeting must include geo_locations (countries, cities or regions).'},400);
  if(!version)return apiJson({error:'META_GRAPH_API_VERSION is not configured.'},503);
  const {data:account}=await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id',socialAccountId).eq('organization_id',org).maybeSingle();
  if(!account||account.platform!=='facebook'||account.connection_status!=='connected')return apiJson({error:'Connect a Facebook Page account first.'},409);
  if(!Array.isArray(account.scopes)||!account.scopes.includes('ads_management'))return apiJson({error:'Reconnect Meta and grant ads_management permission.'},403);
  const creds=decryptSecret(account.encrypted_credentials);token=String(creds?.access_token||'');const pageId=String(creds?.page_id||'');
  if(!token||!pageId)return apiJson({error:'Connected Meta account must contain an access token and Page ID.'},409);
  const ai=await getWorkspaceIntegration(ctx.db,org,'openai'),key=String(ai.credentials.api_key||process.env.OPENAI_API_KEY||'').trim(),model=String(ai.settings.model||process.env.OPENAI_MODEL||'gpt-4.1-mini').trim();
  if(!key)return apiJson({error:'Configure OpenAI in this workspace before generating ad copy.'},503);
  const {data:workspace}=await ctx.db.from('growth_organizations').select('name,brand_profile,knowledge_base').eq('id',org).maybeSingle();
  const prompt=`Create Meta ad copy for a real business. Business: ${workspace?.name||'Business'}. Business description: ${industry}. Audience: ${audience}. Objective: ${objective}. Brand profile: ${JSON.stringify(workspace?.brand_profile||{})}. Verified knowledge: ${JSON.stringify(workspace?.knowledge_base||{})}. Return JSON {primary_text,headline,description}. No invented offers, prices, testimonials, guarantees, certifications, urgency, unsupported product claims or fabricated facts. Keep headline <= 255 chars, description <= 1000 chars, primary_text <= 1800 chars. Use a clear non-deceptive CTA.`;
  const aiRes=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0.45,response_format:{type:'json_object'},messages:[{role:'system',content:'You are a careful performance advertising copywriter. Return valid JSON only. Do not fabricate business facts.'},{role:'user',content:prompt}] }),cache:'no-store',signal:AbortSignal.timeout(30000)});
  const aiData=await aiRes.json().catch(()=>({}));if(!aiRes.ok)throw new Error(aiData.error?.message||'AI ad copy generation failed.');
  const copy=JSON.parse(aiData.choices?.[0]?.message?.content||'{}');const primaryText=String(copy.primary_text||'').slice(0,1800),headline=String(copy.headline||name).slice(0,255),description=String(copy.description||'').slice(0,1000);if(!primaryText||!headline)throw new Error('AI returned incomplete ad copy.');
  const accountId=adAccountId.startsWith('act_')?adAccountId:`act_${adAccountId}`;
  const cIns=await ctx.db.from('growth_ad_campaign_drafts').insert({organization_id:org,ad_account_id:accountId,name,objective,daily_budget_minor:budget,currency,special_ad_categories:Array.isArray(b.specialAdCategories)?b.specialAdCategories:[],created_by:ctx.userId}).select('*').single();if(cIns.error)throw new Error('Could not save campaign draft. Apply the Meta Ads campaign migrations.');campaignRow=cIns.data;
  const campaignId=await metaPost(version,`${accountId}/campaigns`,token,{name,objective,status:'PAUSED',buying_type:'AUCTION',special_ad_categories:JSON.stringify(campaignRow.special_ad_categories||[])});created.push(campaignId);
  const cUpd=await ctx.db.from('growth_ad_campaign_drafts').update({status:'submitted',provider_campaign_id:campaignId,submitted_at:new Date().toISOString(),approved_by:ctx.userId,approved_at:new Date().toISOString()}).eq('id',campaignRow.id).eq('organization_id',org);if(cUpd.error)throw new Error('Meta campaign was created PAUSED, but local campaign status could not be saved.');
  const aIns=await ctx.db.from('growth_adset_drafts').insert({organization_id:org,campaign_draft_id:campaignRow.id,name:`${name} - Ad Set`,optimization_goal:goal,billing_event:'IMPRESSIONS',daily_budget_minor:budget,targeting}).select('*').single();if(aIns.error)throw new Error('Campaign exists PAUSED, but Ad Set draft could not be saved.');adsetRow=aIns.data;
  const adsetId=await metaPost(version,`${accountId}/adsets`,token,{name:adsetRow.name,campaign_id:campaignId,daily_budget:String(budget),billing_event:'IMPRESSIONS',optimization_goal:goal,targeting:JSON.stringify(targeting),status:'PAUSED',...(b.promotedObject&&typeof b.promotedObject==='object'?{promoted_object:JSON.stringify(b.promotedObject)}:{})});created.push(adsetId);
  const aUpd=await ctx.db.from('growth_adset_drafts').update({status:'submitted',provider_adset_id:adsetId,approved_by:ctx.userId,approved_at:new Date().toISOString()}).eq('id',adsetRow.id).eq('organization_id',org);if(aUpd.error)throw new Error('Meta Ad Set was created PAUSED, but local status could not be saved.');
  const crIns=await ctx.db.from('growth_ad_creative_drafts').insert({organization_id:org,adset_draft_id:adsetRow.id,name:`${name} - Creative`,format:'IMAGE',primary_text:primaryText,headline,description,destination_url:url,call_to_action:cta,media_urls:[image]}).select('*').single();if(crIns.error)throw new Error('Ad Set exists PAUSED, but creative draft could not be saved.');creativeRow=crIns.data;
  const story={page_id:pageId,link_data:{link:url,picture:image,message:primaryText,name:headline,description,call_to_action:{type:cta,value:{link:url}}}};
  const creativeId=await metaPost(version,`${accountId}/adcreatives`,token,{name:creativeRow.name,object_story_spec:JSON.stringify(story)});created.push(creativeId);
  const crUpd=await ctx.db.from('growth_ad_creative_drafts').update({status:'submitted',provider_creative_id:creativeId,approved_by:ctx.userId,approved_at:new Date().toISOString()}).eq('id',creativeRow.id).eq('organization_id',org);if(crUpd.error)throw new Error('Meta creative was created, but local status could not be saved.');
  const adIns=await ctx.db.from('growth_ad_drafts').insert({organization_id:org,adset_draft_id:adsetRow.id,creative_draft_id:creativeRow.id,name:`${name} - Ad`}).select('*').single();if(adIns.error)throw new Error('Creative exists, but Ad draft could not be saved.');adRow=adIns.data;
  const adId=await metaPost(version,`${accountId}/ads`,token,{name:adRow.name,adset_id:adsetId,creative:JSON.stringify({creative_id:creativeId}),status:'PAUSED'});created.push(adId);
  const adUpd=await ctx.db.from('growth_ad_drafts').update({status:'submitted',provider_ad_id:adId,approved_by:ctx.userId,approved_at:new Date().toISOString()}).eq('id',adRow.id).eq('organization_id',org);if(adUpd.error)throw new Error('Meta Ad was created PAUSED, but local status could not be saved.');
  return apiJson({success:true,campaign:{id:campaignRow.id,providerId:campaignId},adset:{id:adsetRow.id,providerId:adsetId},creative:{id:creativeRow.id,providerId:creativeId},ad:{id:adRow.id,providerId:adId},generatedCopy:{primaryText,headline,description},status:'PAUSED',activationRequired:true,dailyBudgetMinor:budget,message:'Complete campaign, Ad Set, creative and Ad created in Meta in PAUSED state. No spend can start until the workspace owner explicitly activates it with an approved budget cap.'},201);
 }catch(e){
  const rollbackErrors:string[]=[];for(const id of [...created].reverse()){try{await metaPause(String(version),id,token);}catch(err){rollbackErrors.push(err instanceof Error?err.message:'Pause rollback failed.');}}
  const message=e instanceof Error?e.message:'Ads Autopilot failed.';
  if(campaignRow?.id)await ctx.db.from('growth_ad_campaign_drafts').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',campaignRow.id);
  if(adsetRow?.id)await ctx.db.from('growth_adset_drafts').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',adsetRow.id);
  if(creativeRow?.id)await ctx.db.from('growth_ad_creative_drafts').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',creativeRow.id);
  if(adRow?.id)await ctx.db.from('growth_ad_drafts').update({status:'failed',last_error:message,updated_at:new Date().toISOString()}).eq('id',adRow.id);
  return apiJson({error:message,providerObjectsCreated:created.length,rollbackErrors,manualReconciliationRequired:created.length>0},502);
 }
}
