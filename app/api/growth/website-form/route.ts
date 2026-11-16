import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { runLeadCreatedRules } from '@/lib/growth-automation';
import { enforceGrowthRateLimit } from '@/lib/growth-rate-limit';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';
export const runtime = 'nodejs';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value: unknown, max = 500) => String(value || '').trim().slice(0, max);
function allowedOrigin(origin: string, website: any) {
  try { const host = new URL(origin).hostname.toLowerCase(); const candidates = [website.domain, website.website_url].filter(Boolean).flatMap((v: string) => { try { return [new URL(v.includes('://') ? v : `https://${v}`).hostname.toLowerCase()]; } catch { return [String(v).toLowerCase()]; } }); return candidates.some((base: string) => host === base || host === `www.${base}` || host.endsWith(`.${base}`)); } catch { return false; }
}
function cors(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Cache-Control': 'no-store' }; }
export async function POST(req: NextRequest) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Website form capture is not configured.'},{status:503});
 try {
  const raw=await req.text(); if(raw.length>20000)return NextResponse.json({error:'Form submission is too large.'},{status:413});
  const b=JSON.parse(raw), publicKey=clean(b.publicKey,100), websiteId=clean(b.websiteId,80), origin=req.headers.get('origin')||'';
  if(!/^agw_[a-f0-9]{64}$/.test(publicKey)||!/^[0-9a-f-]{36}$/i.test(websiteId))return NextResponse.json({error:'Invalid website form configuration.'},{status:400});
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data:tracker}=await db.from('growth_website_tracking_keys').select('organization_id,website_id').eq('website_id',websiteId).eq('key_hash',sha256(publicKey)).eq('is_active',true).maybeSingle();
  if(!tracker)return NextResponse.json({error:'Tracking key is invalid or revoked.'},{status:403});
  const {data:website}=await db.from('growth_websites').select('domain,website_url,verification_status').eq('id',websiteId).eq('organization_id',tracker.organization_id).maybeSingle();
  if(!website||website.verification_status!=='verified'||!origin||!allowedOrigin(origin,website))return NextResponse.json({error:'Origin is not authorized for this website.'},{status:403});
  const rate=await enforceGrowthRateLimit(db,req,`website-form-${websiteId}`,5,600);
  if(!rate.allowed)return NextResponse.json({error:'Too many form submissions. Please retry later.'},{status:429,headers:cors(origin)});
  const name=clean(b.name,120),email=clean(b.email,160).toLowerCase(),phone=clean(b.phone,40),requirement=clean(b.requirement,1500);
  const formKey=clean(b.formKey,100)||'default',visitorId=clean(b.visitorId,100),pageUrl=clean(b.pageUrl,1000),submissionId=clean(b.submissionId,100),consent=b.consent===true;
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(submissionId))return NextResponse.json({error:'Invalid submission identifier.'},{status:400,headers:cors(origin)});
  if(!name||(!email&&!phone)||!requirement)return NextResponse.json({error:'Name, email or phone, and enquiry details are required.'},{status:400,headers:cors(origin)});
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400,headers:cors(origin)});
  const attribution=b.attribution&&typeof b.attribution==='object'?b.attribution:{};
  const quota=await consumeGrowthQuota(db,tracker.organization_id,'leads',1,undefined,{source:'website_form'});
  if(!quota.allowed)return NextResponse.json({error:quotaErrorMessage(quota),quota},{status:quota.reason==='quota_exceeded'?402:503,headers:cors(origin)});
  const {data:claim,error:claimError}=await db.from('growth_website_form_submissions').insert({organization_id:tracker.organization_id,website_id:websiteId,submission_id:submissionId,form_key:formKey,visitor_id:visitorId||null,page_url:pageUrl,consent_to_contact:consent,attribution:{utm_source:clean(attribution.utm_source,160)||null,utm_medium:clean(attribution.utm_medium,160)||null,utm_campaign:clean(attribution.utm_campaign,160)||null,gclid:clean(attribution.gclid,500)||null}}).select('id').single();
  if(claimError){if(claimError.code==='23505')return NextResponse.json({success:true,duplicate:true,automationQueued:false},{headers:cors(origin)});return NextResponse.json({error:'Form submission could not be registered.'},{status:500,headers:cors(origin)});}
  const leadPayload={organization_id:tracker.organization_id,website_id:websiteId,name,email:email||null,phone:phone||null,requirement,source:'website_form',consent_to_contact:consent,contact_consent_at:consent?new Date().toISOString():null,contact_consent_source:consent?'website_form':null,contact_consent_method:consent?'explicit_checkbox':null,gclid:clean(attribution.gclid,500)||null,gbraid:clean(attribution.gbraid,500)||null,wbraid:clean(attribution.wbraid,500)||null,utm_source:clean(attribution.utm_source,160)||null,utm_medium:clean(attribution.utm_medium,160)||null,utm_campaign:clean(attribution.utm_campaign,160)||null,utm_term:clean(attribution.utm_term,160)||null,utm_content:clean(attribution.utm_content,160)||null,ad_user_data_consent:b.adUserDataConsent===true};
  const {data:lead,error:leadError}=await db.from('growth_leads').insert(leadPayload).select('id,lead_score,lead_temperature').single();
  if(leadError){await db.from('growth_website_form_submissions').delete().eq('id',claim.id);return NextResponse.json({error:'Enquiry could not be saved to CRM.'},{status:500,headers:cors(origin)});}
  const {error:formError}=await db.from('growth_website_form_submissions').update({lead_id:lead.id}).eq('id',claim.id);
  let automationQueued=false;
  if(consent){try{await runLeadCreatedRules(db,tracker.organization_id,{...lead,id:lead.id,name,phone,email,consent_to_contact:true});automationQueued=true;}catch(error){console.error('Website lead saved; workflow enqueue failed.',{websiteId,leadId:lead.id,error:error instanceof Error?error.message:'unknown'});}}
  return NextResponse.json({success:true,leadId:lead.id,automationQueued,formRecordSaved:!formError,consentRecorded:consent},{status:201,headers:cors(origin)});
 }catch{return NextResponse.json({error:'Unable to process website form.'},{status:400});}
}
