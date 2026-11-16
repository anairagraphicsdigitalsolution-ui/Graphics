import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime = 'nodejs';
const TYPES = ['post','reel','story','carousel','article','ad_copy','blog','seo','product','festival'];
export async function GET(req: NextRequest) {
  const c = await growthContext(req); if ('response' in c) return c.response;
  const orgId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager','editor','viewer'])) return apiJson({error:'Workspace permission denied.'},403);
  const {data,error}=await c.db.from('growth_content_templates').select('id,name,platform,content_type,language,tone,prompt_template,variables,is_default,created_at,updated_at').eq('organization_id',orgId).order('updated_at',{ascending:false}).limit(100);
  if(error)return apiJson({error:'Content templates are unavailable. Apply the Module 5 migration.'},500);
  return apiJson({templates:data||[]});
}
export async function POST(req: NextRequest) {
  const c=await growthContext(req);if('response'in c)return c.response;
  try {
    const b=await req.json(),orgId=String(b.organizationId||''),name=String(b.name||'').trim().slice(0,100),prompt=String(b.promptTemplate||'').trim().slice(0,4000),type=String(b.contentType||'post');
    if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace manager permission required.'},403);
    if(!await requireGrowthFeature(c.db,c.userId,orgId,'social_channels'))return apiJson({error:'Content Studio is not included in this workspace plan.'},402);
    if(!name||!prompt||!TYPES.includes(type))return apiJson({error:'Template name, prompt and a supported content type are required.'},400);
    const row={organization_id:orgId,name,platform:b.platform?String(b.platform).slice(0,30):null,content_type:type,language:String(b.language||'en').slice(0,12),tone:String(b.tone||'professional').slice(0,40),prompt_template:prompt,variables:Array.isArray(b.variables)?b.variables.slice(0,30):[],is_default:b.isDefault===true,created_by:c.userId,updated_at:new Date().toISOString()};
    if(row.is_default)await c.db.from('growth_content_templates').update({is_default:false,updated_at:new Date().toISOString()}).eq('organization_id',orgId).eq('content_type',type);
    const {data,error}=await c.db.from('growth_content_templates').insert(row).select('*').single();
    if(error)return apiJson({error:'Could not save content template.'},500);
    return apiJson({template:data},201);
  }catch{return apiJson({error:'Invalid content template request.'},400);}
}
export async function PATCH(req: NextRequest) {
  const c=await growthContext(req);if('response'in c)return c.response;
  try {const b=await req.json(),orgId=String(b.organizationId||''),id=String(b.id||'');if(!id||!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace manager permission required.'},403);
    const patch:any={updated_at:new Date().toISOString()};for(const [source,target,max] of [['name','name',100],['platform','platform',30],['contentType','content_type',30],['language','language',12],['tone','tone',40],['promptTemplate','prompt_template',4000]] as const){if(b[source]!==undefined)patch[target]=String(b[source]).trim().slice(0,max);}
    if(b.variables!==undefined)patch.variables=Array.isArray(b.variables)?b.variables.slice(0,30):[];if(b.isDefault!==undefined)patch.is_default=b.isDefault===true;
    const {data,error}=await c.db.from('growth_content_templates').update(patch).eq('id',id).eq('organization_id',orgId).select('*').maybeSingle();if(error||!data)return apiJson({error:'Template update failed.'},400);return apiJson({template:data});
  }catch{return apiJson({error:'Invalid template update.'},400);}
}
export async function DELETE(req: NextRequest) {const c=await growthContext(req);if('response'in c)return c.response;const orgId=req.nextUrl.searchParams.get('organizationId')||'',id=req.nextUrl.searchParams.get('id')||'';if(!id||!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace manager permission required.'},403);const {error}=await c.db.from('growth_content_templates').delete().eq('id',id).eq('organization_id',orgId);return error?apiJson({error:'Template could not be deleted.'},400):apiJson({deleted:true});}
