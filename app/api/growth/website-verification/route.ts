import { NextRequest } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
export const runtime = 'nodejs';
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const cleanDomain = (value:string) => value.toLowerCase().trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/:\d+$/,'').replace(/^www\./,'').replace(/\.$/,'');
export async function POST(req:NextRequest){
 const ctx=await growthContext(req); if('response' in ctx)return ctx.response;
 try {
  const body=await req.json(), organizationId=String(body.organizationId||''), websiteId=String(body.websiteId||''), action=String(body.action||'');
  if(!await requireGrowthRole(ctx.db,ctx.userId,organizationId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const {data:site,error}=await ctx.db.from('growth_websites').select('id,name,domain,website_url,verification_status').eq('id',websiteId).eq('organization_id',organizationId).maybeSingle();
  if(error)return apiJson({error:'Website verification storage is unavailable. Apply the website verification migration.'},503);
  if(!site)return apiJson({error:'Website not found in this workspace.'},404);
  const domain=cleanDomain(String(site.domain||new URL(site.website_url).hostname));
  if(!domain||!domain.includes('.')||domain.length>253||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain))return apiJson({error:'A valid public domain is required.'},400);
  if(action==='generate'){
   const token=`anaira-growth-verification=${randomBytes(24).toString('hex')}`;
   const {error:updateError}=await ctx.db.from('growth_websites').update({verification_token_hash:hash(token),verification_status:'pending',verification_checked_at:null}).eq('id',websiteId).eq('organization_id',organizationId);
   if(updateError)return apiJson({error:'Could not save verification challenge. Apply the website verification migration first.'},503);
   return apiJson({success:true,domain,record_name:`_anaira-growth.${domain}`,record_type:'TXT',record_value:token,instructions:`Add a DNS TXT record named _anaira-growth.${domain} with the exact value shown. DNS propagation may take several minutes.`});
  }
  if(action==='verify'){
   const {data:row,error:readError}=await ctx.db.from('growth_websites').select('verification_token_hash').eq('id',websiteId).eq('organization_id',organizationId).maybeSingle();
   if(readError||!row?.verification_token_hash)return apiJson({error:'Generate a verification record first.'},409);
   let records:string[][]=[];
   try{records=await resolveTxt(`_anaira-growth.${domain}`);}catch(e:any){const msg=e?.code==='ENODATA'||e?.code==='ENOTFOUND'?'DNS TXT record was not found yet. Check the record name/value and allow time for DNS propagation.':'DNS lookup failed. Please retry shortly.';await ctx.db.from('growth_websites').update({verification_status:'failed',verification_checked_at:new Date().toISOString()}).eq('id',websiteId).eq('organization_id',organizationId);return apiJson({success:false,verified:false,error:msg},200);}
   const found=records.flat().some(value=>hash(value.trim())===row.verification_token_hash);
   await ctx.db.from('growth_websites').update({verification_status:found?'verified':'failed',verification_checked_at:new Date().toISOString(),verified_at:found?new Date().toISOString():null}).eq('id',websiteId).eq('organization_id',organizationId);
   return apiJson({success:found,verified:found,message:found?'Domain ownership verified successfully.':'TXT record exists but does not match the current verification token. Check the exact value and retry.'});
  }
  return apiJson({error:'Unsupported verification action.'},400);
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Website verification failed.'},400);}
}
