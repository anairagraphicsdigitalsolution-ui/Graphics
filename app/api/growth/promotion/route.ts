import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
function safeUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u:null;}catch{return null;}}
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const {data,error}=await c.db.from('growth_promotion_links').select('id,slug,name,destination_url,campaign_source,campaign_medium,campaign_name,click_count,enabled,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(100);
 if(error)return apiJson({error:'Promotion links migration is not applied.'},503);
 return apiJson({links:data||[]});
}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),org=String(b.organizationId||'');
  if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','editor']))return apiJson({error:'Campaign editor permission required.'},403);
  const name=String(b.name||'').trim().slice(0,120),dest=safeUrl(String(b.destinationUrl||''));
  if(name.length<3||!dest)return apiJson({error:'Provide a link name and a valid HTTPS destination URL.'},400);
  const slug=crypto.randomUUID().replace(/-/g,'');
  const params=new URLSearchParams(dest.search);if(b.utm!==false){if(b.source)params.set('utm_source',String(b.source).slice(0,80));if(b.medium)params.set('utm_medium',String(b.medium).slice(0,80));if(b.campaign)params.set('utm_campaign',String(b.campaign).slice(0,100));}
  dest.search=params.toString();
  const {data,error}=await c.db.from('growth_promotion_links').insert({organization_id:org,slug,name,destination_url:dest.toString(),campaign_source:String(b.source||'').slice(0,80)||null,campaign_medium:String(b.medium||'').slice(0,80)||null,campaign_name:String(b.campaign||'').slice(0,100)||null,created_by:c.userId}).select('id,slug,name,destination_url,campaign_source,campaign_medium,campaign_name,click_count,enabled,created_at').single();
  if(error)return apiJson({error:'Unable to create promotion link. Apply the Phase 29 migration.'},503);
  return apiJson({link:data,redirectPath:`/r/${slug}`},201);
 }catch{return apiJson({error:'Invalid promotion link request.'},400);}
}
