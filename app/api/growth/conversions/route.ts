import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime='nodejs';
const HASH=/^[a-f0-9]{64}$/i;
export async function GET(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 const organizationId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const {data,error}=await ctx.db.from('growth_conversion_events').select('id,event_id,event_name,event_time,status,meta_event_id,last_error,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);
 if(error)return apiJson({error:'Conversion event history unavailable. Apply v6.61 migration.'},500);
 return apiJson({events:data||[]});
}
export async function POST(req:NextRequest){
 const ctx=await growthContext(req);if('response'in ctx)return ctx.response;
 try{
  const b=await req.json(),organizationId=String(b.organizationId||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager']))return apiJson({error:'Only workspace owner/manager can submit conversion events.'},403);
  if(b.consent!==true)return apiJson({error:'Explicit user consent is required before sending conversion data.'},400);
  const eventId=String(b.eventId||'').trim(),eventName=String(b.eventName||'').trim();
  const allowed=new Set(['Lead','CompleteRegistration','Contact','Purchase','SubmitApplication','Schedule']);
  if(!eventId||eventId.length>180||!allowed.has(eventName))return apiJson({error:'Provide a unique eventId and supported eventName.'},400);
  const eventTime=Number(b.eventTime||Math.floor(Date.now()/1000));
  if(!Number.isSafeInteger(eventTime)||eventTime<1||eventTime>Math.floor(Date.now()/1000)+300)return apiJson({error:'Invalid event timestamp.'},400);
  const sourceUrl=String(b.eventSourceUrl||'');
  let parsed:URL;try{parsed=new URL(sourceUrl);}catch{return apiJson({error:'A valid HTTPS event source URL is required.'},400);}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)return apiJson({error:'Event source URL must use HTTPS.'},400);
  const raw=b.userData&&typeof b.userData==='object'?b.userData:{};
  const userData:Record<string,string>={};
  for(const k of ['em','ph','external_id','fn','ln','ct','st','zp','country'])if(raw[k]!==undefined){const v=String(raw[k]);if(!HASH.test(v))return apiJson({error:`${k} must be SHA-256 hashed before submission.`},400);userData[k]=v.toLowerCase();}
  if(!Object.keys(userData).length)return apiJson({error:'At least one pre-hashed user identifier is required.'},400);
  const customData=b.customData&&typeof b.customData==='object'?b.customData:{};
  const allowedCustom:Record<string,unknown>={};
  for(const k of ['currency','value','content_name','content_category','order_id'])if(customData[k]!==undefined)allowedCustom[k]=customData[k];
  if(allowedCustom.value!==undefined&&(!Number.isFinite(Number(allowedCustom.value))||Number(allowedCustom.value)<0))return apiJson({error:'Invalid conversion value.'},400);
  const {data:existing}=await ctx.db.from('growth_conversion_events').select('id,status,meta_event_id').eq('organization_id',organizationId).eq('event_id',eventId).maybeSingle();
  if(existing)return apiJson({success:true,duplicate:true,event:existing},200);
  const {data:record,error:insertError}=await ctx.db.from('growth_conversion_events').insert({organization_id:organizationId,event_id:eventId,event_name:eventName,event_time:eventTime,event_source_url:parsed.toString(),action_source:'website',user_data_hashes:userData,custom_data:allowedCustom,consent_recorded:true,status:'queued',created_by:ctx.userId}).select('id').single();
  if(insertError)return apiJson({error:'Could not queue conversion event. Ensure eventId is unique.'},409);
  const pixel=process.env.META_PIXEL_ID,token=process.env.META_CONVERSIONS_ACCESS_TOKEN,version=process.env.META_GRAPH_API_VERSION;
  if(!pixel||!token||!version){await ctx.db.from('growth_conversion_events').update({status:'blocked',last_error:'Meta Conversions API environment is not configured.'}).eq('id',record.id);return apiJson({success:false,eventId,queued:false,error:'Configure META_PIXEL_ID and META_CONVERSIONS_ACCESS_TOKEN in Vercel.'},503);}
  const response=await fetch(`https://graph.facebook.com/${version}/${pixel}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:[{event_name:eventName,event_time:eventTime,event_id:eventId,event_source_url:parsed.toString(),action_source:'website',user_data:userData,custom_data:allowedCustom}],access_token:token}),cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const message=String(result?.error?.message||'Meta Conversions API rejected event.').slice(0,900);await ctx.db.from('growth_conversion_events').update({status:'failed',last_error:message,meta_response:result}).eq('id',record.id);return apiJson({error:message,eventId},502);}
  await ctx.db.from('growth_conversion_events').update({status:'sent',meta_event_id:String(result.events_received??1),meta_response:{events_received:result.events_received,fbtrace_id:result.fbtrace_id},sent_at:new Date().toISOString(),last_error:null}).eq('id',record.id);
  return apiJson({success:true,eventId,eventsReceived:result.events_received??1,status:'sent'});
 }catch{return apiJson({error:'Conversion event submission failed.'},400);}
}
