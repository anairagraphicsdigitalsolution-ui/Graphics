import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { estimateOpenAICost } from '@/lib/growth-cost';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';
import { requireGrowthFeature } from '@/lib/growth-server';
export const runtime = 'nodejs';
const json = (b: unknown, s=200) => NextResponse.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
export async function POST(req: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY, key=process.env.OPENAI_API_KEY;
  if(!url||!anon||!service||!key) return json({error:'Server integrations are not configured.'},503);
  const auth=req.headers.get('authorization')||''; const token=auth.startsWith('Bearer ')?auth.slice(7):''; if(!token) return json({error:'Sign in required.'},401);
  const authClient=createClient(url,anon,{auth:{persistSession:false}}); const {data:{user},error:authError}=await authClient.auth.getUser(token); if(authError||!user) return json({error:'Invalid session.'},401);
  try {
    const b=await req.json(); const orgId=String(b.organizationId||''); const prompt=String(b.prompt||'').trim().slice(0,2000); const platform=String(b.platform||'instagram').slice(0,30); const type=String(b.contentType||'post'); const mediaUrls=Array.isArray(b.mediaUrls)?b.mediaUrls.slice(0,10).map((x:unknown)=>String(x).trim()).filter((x:string)=>{try{return ['http:','https:'].includes(new URL(x).protocol)}catch{return false}}):[];
    if(!orgId||!prompt) return json({error:'Workspace and content brief are required.'},400);
    const db=createClient(url,service,{auth:{persistSession:false}}); const {data:member}=await db.from('growth_members').select('role').eq('organization_id',orgId).eq('user_id',user.id).maybeSingle();
    if(!member||!['owner','manager','editor'].includes(member.role)) return json({error:'You do not have permission for this workspace.'},403);
    if(!await requireGrowthFeature(db,user.id,orgId,'social_channels')) return json({error:'Social content tools are not included in your workspace plan.'},402);
    const {data:org}=await db.from('growth_organizations').select('name,brand_profile,knowledge_base,status').eq('id',orgId).maybeSingle(); if(!org||org.status!=='active') return json({error:'Workspace not found or inactive.'},404);
    const quota=await consumeGrowthQuota(db,orgId,'ai_messages',1,undefined,{channel:'content_studio'});if(!quota.allowed)return json({error:quotaErrorMessage(quota),quota},quota.reason==='quota_exceeded'?402:503);
    const ai=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.7,max_tokens:900,messages:[{role:'system',content:`Create original, platform-appropriate social media marketing content for ${org.name}. Follow brand voice ${JSON.stringify(org.brand_profile||{})}. Do not invent claims, offers or contact details. Return title then polished post copy, hashtags and a short CTA. ${type} for ${platform}.`},{role:'user',content:prompt}]})});
    if(!ai.ok) return json({error:'AI content generation failed.'},502); const out=await ai.json(); const text=String(out.choices?.[0]?.message?.content||'');
    const {data:saved,error}=await db.from('growth_content').insert({organization_id:orgId,title:prompt.slice(0,120),body:text,platform,content_type:['post','reel','story','carousel','article'].includes(type)?type:'post',media_urls:mediaUrls,status:'draft'}).select('id,title,body,platform,content_type,status,created_at').single();
    if(error) return json({error:'Could not save generated content.'},500);
    const usage=out.usage||{}; await db.from('growth_usage_logs').insert({organization_id:orgId,provider:'openai',model:process.env.OPENAI_MODEL||'gpt-4.1-mini',operation:'content_generation',input_units:usage.prompt_tokens||0,output_units:usage.completion_tokens||0,estimated_cost:estimateOpenAICost(process.env.OPENAI_MODEL||'gpt-4.1-mini',usage.prompt_tokens||0,usage.completion_tokens||0)});
    return json({content:saved});
  } catch { return json({error:'Unable to generate content.'},500); }
}
