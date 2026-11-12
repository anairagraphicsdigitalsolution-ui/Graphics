import { enrichWebsite } from '@/lib/growth-prospect-enrichment';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
import { growthContext, apiJson, requireGrowthRole } from '@/lib/growth-server';
import {NextRequest} from 'next/server';
const clean=(v:unknown,n=160)=>String(v??'').trim().slice(0,n);
const unique=(values:string[])=>Array.from(new Set(values.map(v=>v.trim()).filter(Boolean)));
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=clean(b.organizationId,80),industry=clean(b.industry,100),location=clean(b.location,120),keywords=clean(b.keywords,180);
  if(!orgId||!industry||!location)return apiJson({error:'Workspace, industry and target location are required.'},400);
  if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const workspaceGoogle=await getWorkspaceIntegration(c.db,orgId,'google_cse');
  const key=(workspaceGoogle.credentials.api_key||process.env.GOOGLE_CSE_API_KEY||'').trim(),cx=(workspaceGoogle.settings.cx||process.env.GOOGLE_CSE_CX||'').trim();
  if(!key||!cx)return apiJson({error:'Prospect discovery provider is not configured. Add Google Custom Search API Key and Search Engine ID under Integrations, or configure GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX on the server.'},503);
  const q=[industry,location,keywords,'business company official website'].filter(Boolean).join(' ');
  const url=new URL('https://www.googleapis.com/customsearch/v1');url.searchParams.set('key',key);url.searchParams.set('cx',cx);url.searchParams.set('q',q);url.searchParams.set('num','10');
  const response=await fetch(url,{cache:'no-store'}),payload=await response.json().catch(()=>({}));
  if(!response.ok)return apiJson({error:payload.error?.message||'Search provider request failed.'},502);
  const items=Array.isArray(payload.items)?payload.items:[];let saved=0,duplicates=0,skipped=0;const results=[];const {data:run}=await c.db.from('growth_prospect_discovery_runs').insert({organization_id:orgId,created_by:c.userId,industry,location,keywords:keywords||null,status:'running',started_at:new Date().toISOString()}).select('id').single();
  for(const item of items){
   let parsed:URL;try{parsed=new URL(String(item.link||''));}catch{skipped++;continue;}
   if(parsed.protocol!=='https:'||!parsed.hostname||parsed.hostname.includes('google.')){skipped++;continue;}
   const website=`https://${parsed.hostname}`;const company=clean(item.title?.split(/\s[|–-]\s/)[0]||parsed.hostname,160);const enrichment=await enrichWebsite(website);
   const {data:existing}=await c.db.from('growth_prospects').select('id').eq('organization_id',orgId).eq('website',website).maybeSingle();
   if(existing){duplicates++;continue;}
   const score=Math.min(100,25+(enrichment.verified?20:0)+(enrichment.title?10:0)+(enrichment.description?10:0)+(enrichment.email?15:0)+(enrichment.phone?10:0)+(enrichment.pagesCrawled>1?5:0)+(parsed.hostname.includes('.')?5:0));
   const {data,error}=await c.db.from('growth_prospects').insert({organization_id:orgId,company_name:enrichment.title||company,website,website_domain:parsed.hostname.toLowerCase(),industry,location,email:enrichment.email,phone:enrichment.phone,quality_score:score,enrichment_status:enrichment.verified?'enriched':'partial',last_enriched_at:new Date().toISOString(),verified_website:enrichment.verified,source:'google_custom_search',discovery_query:q,discovered_at:new Date().toISOString(),notes:[clean(item.snippet,900),enrichment.description?`Website description: ${enrichment.description}`:'',`Website fetch verified: ${enrichment.verified?'yes':'no'}`,`Same-domain pages crawled: ${enrichment.pagesCrawled}`].filter(Boolean).join('\n'),consent_to_contact:false,status:'new',created_by:c.userId}).select('id,company_name,website,email,phone,industry,location,status').single();
   if(error){if(error.code==='23505')duplicates++;else skipped++;}else{saved++;results.push(data);}
  }
  if(run?.id)await c.db.from('growth_prospect_discovery_runs').update({status:skipped?'partial':'completed',discovered_count:items.length,saved_count:saved,duplicate_count:duplicates,skipped_count:skipped,completed_at:new Date().toISOString()}).eq('id',run.id).eq('organization_id',orgId);
  return apiJson({success:true,runId:run?.id||null,query:q,discovered:items.length,saved,duplicates,skipped,prospects:results,notice:'Discovery uses publicly indexed business websites and attempts a bounded homepage fetch for publicly displayed business contact details. Data is unverified until human review; no outreach consent is assumed.'});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Prospect discovery failed.'},500);}
}
