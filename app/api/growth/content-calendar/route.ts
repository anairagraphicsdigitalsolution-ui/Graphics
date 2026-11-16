import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole, requireGrowthFeature } from '@/lib/growth-server';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const p=req.nextUrl.searchParams,orgId=p.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager','editor','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 if(!await requireGrowthFeature(c.db,c.userId,orgId,'social_channels'))return apiJson({error:'Content Studio is not included in this workspace plan.'},402);
 const startRaw=p.get('from'),endRaw=p.get('to'),now=new Date();const start=startRaw&&Number.isFinite(Date.parse(startRaw))?new Date(startRaw):new Date(now.getTime()-30*86400000);const end=endRaw&&Number.isFinite(Date.parse(endRaw))?new Date(endRaw):new Date(now.getTime()+90*86400000);
 if(end<=start||end.getTime()-start.getTime()>180*86400000)return apiJson({error:'Calendar range must be positive and no longer than 180 days.'},400);
 const {data:allItems,error}=await c.db.from('growth_content').select('id,title,platform,content_type,status,scheduled_at,published_at,created_at,caption,hashtags,generation_metadata,last_publish_error,social_account_id').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(500);
 if(error)return apiJson({error:'Content calendar could not be loaded.'},500);
 const items=(allItems||[]).filter((x:any)=>{const relevantDate=x.scheduled_at||x.published_at||x.created_at;const value=relevantDate?Date.parse(relevantDate):NaN;return Number.isFinite(value)&&value>=start.getTime()&&value<=end.getTime();});
 const ids=items.map((x:any)=>x.id);let events:any[]=[];if(ids.length){const {data}=await c.db.from('growth_content_publication_events').select('id,content_id,platform,event_type,provider_post_id,message,created_at').eq('organization_id',orgId).in('content_id',ids).order('created_at',{ascending:false}).limit(500);events=data||[];}
 return apiJson({range:{from:start.toISOString(),to:end.toISOString()},items,publicationEvents:events});
}
