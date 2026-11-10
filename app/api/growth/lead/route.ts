import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {runLeadCreatedRules} from '@/lib/growth-automation';
import {enforceGrowthRateLimit} from '@/lib/growth-rate-limit';
import {consumeGrowthQuota,quotaErrorMessage} from '@/lib/growth-quota';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Lead capture is not configured.'},{status:503});
 try{
  const b=await req.json();
  const name=String(b.name||'').trim().slice(0,120),phone=String(b.phone||'').trim().slice(0,40),email=String(b.email||'').trim().slice(0,160),requirement=String(b.requirement||'').trim().slice(0,1500),consent=b.consent===true;
  const conversationId=typeof b.conversationId==='string'?b.conversationId:null;
  const requestedSlug=String(b.slug||'').trim().toLowerCase().slice(0,100);
  if(!name||(!phone&&!email)||!requirement||!consent)return NextResponse.json({error:'Name, phone or email, requirement and contact consent are required.'},{status:400});
  const db=createClient(url,key,{auth:{persistSession:false}});
  const rate=await enforceGrowthRateLimit(db,req,'website-lead',5,600);
  if(!rate.allowed)return NextResponse.json({error:'Too many enquiries from this connection. Please try again later.',retryAfter:rate.retryAfter},{status:429});

  // A conversation is authoritative for tenant routing. A public slug is only
  // used for first-contact forms and must resolve to an active organization.
  let org:any=null;
  if(conversationId){
   const {data:conversation}=await db.from('growth_conversations').select('id,organization_id').eq('id',conversationId).maybeSingle();
   if(!conversation)return NextResponse.json({error:'Conversation not found.'},{status:400});
   const {data:conversationOrg}=await db.from('growth_organizations').select('id,slug').eq('id',conversation.organization_id).eq('status','active').maybeSingle();
   if(!conversationOrg)return NextResponse.json({error:'This workspace is not available.'},{status:404});
   if(requestedSlug&&requestedSlug!==conversationOrg.slug)return NextResponse.json({error:'Conversation and workspace do not match.'},{status:400});
   org=conversationOrg;
  }else{
   if(!/^[a-z0-9-]{2,100}$/.test(requestedSlug))return NextResponse.json({error:'A valid workspace slug is required.'},{status:400});
   const {data:workspace}=await db.from('growth_organizations').select('id,slug').eq('slug',requestedSlug).eq('status','active').maybeSingle();
   org=workspace;
  }
  if(!org)return NextResponse.json({error:'Lead capture is unavailable for this workspace.'},{status:404});

  const quota=await consumeGrowthQuota(db,org.id,'leads',1,undefined,{source:'website_chat'});
  if(!quota.allowed)return NextResponse.json({error:quotaErrorMessage(quota),quota},{status:quota.reason==='quota_exceeded'?402:503});
  const textForScore=requirement.toLowerCase();
  const hotWords=['urgent','asap','immediately','this week','ready to start','quotation','quote','budget'];
  const coldWords=['just exploring','just looking','maybe later','not sure'];
  const score=Math.max(0,Math.min(100,50+(phone?10:0)+(email?5:0)+(hotWords.some(w=>textForScore.includes(w))?25:0)-(coldWords.some(w=>textForScore.includes(w))?25:0)));
  const temperature=score>=70?'hot':score<=35?'cold':'warm';
  const {data,error}=await db.from('growth_leads').insert({organization_id:org.id,conversation_id:conversationId,name,phone:phone||null,email:email||null,requirement,source:'website_chat',consent_to_contact:true,contact_consent_at:new Date().toISOString(),contact_consent_source:'website_lead_form',contact_consent_method:'explicit_checkbox',lead_temperature:temperature,lead_score:score}).select('id,lead_score,lead_temperature').single();
  if(error)return NextResponse.json({error:'Could not save enquiry.'},{status:500});
  try{await runLeadCreatedRules(db,org.id,{...data,id:data.id,name,phone,email,consent_to_contact:true});}catch{}
  return NextResponse.json({success:true,leadId:data.id,leadScore:data.lead_score,leadTemperature:data.lead_temperature});
 }catch{return NextResponse.json({error:'Unable to submit enquiry.'},{status:500});}
}
