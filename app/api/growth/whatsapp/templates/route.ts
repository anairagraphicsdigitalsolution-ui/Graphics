import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
const roles=['owner','manager'];
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const {data,error}=await c.db.from('growth_whatsapp_templates').select('id,template_name,language,category,body_text,variables,approval_status,provider_template_id,provider_status_checked_at,approval_note,created_at,updated_at').eq('organization_id',org).order('created_at',{ascending:false});
 if(error)return apiJson({error:'Unable to load WhatsApp templates. Apply the v6.68 migration.'},500);
 return apiJson({templates:data||[]});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),name=String(b.template_name||'').trim().toLowerCase(),language=String(b.language||'en').trim(),category=String(b.category||'UTILITY'),body=String(b.body_text||'').trim(),vars=Array.isArray(b.variables)?b.variables:[];
  if(!await requireGrowthRole(c.db,c.userId,org,roles))return apiJson({error:'Only owner or manager can create templates.'},403);
  if(!/^[a-z0-9_]{3,512}$/.test(name)||!/^[a-zA-Z0-9_-]{2,16}$/.test(language)||!['UTILITY','MARKETING'].includes(category)||!body||body.length>1024||vars.length>10||vars.some((v:any)=>typeof v!=='string'||!v.trim()||v.length>80))return apiJson({error:'Invalid template name, language, category, body or variables.'},400);
  const placeholders=[...body.matchAll(/\{\{(\d+)\}\}/g)].map((m:any)=>Number(m[1]));
  if(placeholders.some(n=>n<1||n>vars.length)||new Set(placeholders).size!==vars.length||placeholders.length!==vars.length)return apiJson({error:'Body placeholders must use every variable exactly once, sequentially as {{1}}, {{2}}, etc.'},400);
  const {data,error}=await c.db.from('growth_whatsapp_templates').insert({organization_id:org,template_name:name,language,category,body_text:body,variables:vars,created_by:c.userId}).select('id,template_name,language,category,body_text,variables,approval_status').single();
  if(error)return apiJson({error:error.code==='23505'?'A template with this name and language already exists.':'Unable to save template.'},400);
  return apiJson({template:data},201);
 }catch{return apiJson({error:'Invalid template request.'},400);}
}
export async function PATCH(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),org=String(b.organizationId||''),id=String(b.templateId||''),status=String(b.approval_status||''),note=String(b.approval_note||'').trim();
  if(!id||!await requireGrowthRole(c.db,c.userId,org,roles))return apiJson({error:'Only owner or manager can update template approval.'},403);
  if(!['pending','approved','rejected','paused'].includes(status))return apiJson({error:'Invalid approval status.'},400);
  if(status==='approved'&&(!b.providerConfirmed||note.length<8))return apiJson({error:'Confirm that this exact template is approved in WhatsApp Manager and add a verification note.'},400);
  const patch:any={approval_status:status,approval_note:note||null,provider_status_checked_at:status==='approved'?new Date().toISOString():null,approval_confirmed_by:status==='approved'?c.userId:null,updated_at:new Date().toISOString()};
  const {data,error}=await c.db.from('growth_whatsapp_templates').update(patch).eq('id',id).eq('organization_id',org).select('id,template_name,approval_status,approval_note,provider_status_checked_at').maybeSingle();
  if(error)return apiJson({error:'Template update failed.'},500);if(!data)return apiJson({error:'Template not found.'},404);
  return apiJson({template:data});
 }catch{return apiJson({error:'Invalid template update.'},400);}
}
