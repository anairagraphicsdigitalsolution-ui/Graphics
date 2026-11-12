import { NextRequest } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const maxDuration = 45;

function privateIp(ip:string){
  if(isIP(ip)===4){const p=ip.split('.').map(Number);return p[0]===10||p[0]===127||p[0]===0||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]>=224;}
  const x=ip.toLowerCase();return x==='::1'||x==='::'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe80:')||x.startsWith('::ffff:');
}
async function publicUrl(raw:string){
  const u=new URL(raw);if(u.protocol!=='https:'&&u.protocol!=='http:')throw new Error('Only HTTP and HTTPS websites can be scanned.');
  if(u.username||u.password)throw new Error('URLs containing credentials are not allowed.');
  const host=u.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local'))throw new Error('Private or local hosts cannot be scanned.');
  const records=await lookup(host,{all:true,verbatim:true});if(!records.length||records.some(x=>privateIp(x.address)))throw new Error('Website resolves to a private or restricted IP address.');
  return u;
}
const text=(html:string)=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
function tags(html:string,tag:string){return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`,'gi'))].map(m=>text(m[2]).slice(0,300));}
export async function POST(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{
  const b=await req.json(),orgId=String(b.organizationId||''),websiteId=String(b.websiteId||''),action=String(b.action||'scan');
  if(!orgId||!websiteId||!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const {data:site,error}=await c.db.from('growth_websites').select('id,name,website_url,domain,verification_status').eq('id',websiteId).eq('organization_id',orgId).maybeSingle();
  if(error||!site)return apiJson({error:'Website not found or unavailable.'},404);
  if(site.verification_status!=='verified')return apiJson({error:'Verify domain ownership before running website scans.'},409);
  const base=await publicUrl(site.website_url);
  // Respect robots.txt before requesting the homepage.
  try{
   const robotsResponse=await fetch(new URL('/robots.txt',base),{signal:AbortSignal.timeout(5000),headers:{'User-Agent':'AnairaGrowthBot/1.0'}});
   if(robotsResponse.ok){
    const robotsText=(await robotsResponse.text()).slice(0,100000);
    let applies=false,blocked=false;
    for(const line of robotsText.split(/\\r?\\n/)){
     const clean=line.replace(/#.*/,'').trim();const m=clean.match(/^(user-agent|disallow):\\s*(.*)$/i);if(!m)continue;
     if(m[1].toLowerCase()==='user-agent'){applies=m[2].trim()==='*'||m[2].trim().toLowerCase()==='anairagrowthbot';continue;}
     if(applies&&m[1].toLowerCase()==='disallow'&&m[2].trim()==='/')blocked=true;
    }
    if(blocked)return apiJson({error:'This website disallows automated crawling in robots.txt. No scan was performed.'},403);
   }
  }catch{}
  const started=Date.now();
  const response=await fetch(base.toString(),{redirect:'manual',signal:AbortSignal.timeout(18000),headers:{'User-Agent':'AnairaGrowthBot/1.0 (+website audit; respect robots.txt)','Accept':'text/html,application/xhtml+xml'}});
  if(response.status>=300&&response.status<400){const loc=response.headers.get('location');if(!loc)return apiJson({error:'Website returned a redirect without a destination.'},502);const next=new URL(loc,base);await publicUrl(next.toString());}
  if(!response.ok)return apiJson({error:`Website returned HTTP ${response.status}.`},502);
  const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return apiJson({error:'The website homepage did not return HTML.'},415);
  const html=(await response.text()).slice(0,2_000_000);
  const title=tags(html,'title')[0]||'';
  const description=html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]||html.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)?.[1]||'';
  const h1=tags(html,'h1');const canonical=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]||'';
  const robots=html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1]||'default';
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi)].map(m=>m[1]).slice(0,500);
  const internal=new Set<string>(),external=new Set<string>();for(const href of links){try{const u=new URL(href,base);if(!['http:','https:'].includes(u.protocol))continue;(u.hostname===base.hostname?internal:external).add(u.toString().split('#')[0]);}catch{}}
  const checks=[
   {key:'title',label:'Page title',pass:!!title,detail:title?title:'Missing title tag'},
   {key:'description',label:'Meta description',pass:!!description,detail:description?description:'Missing meta description'},
   {key:'h1',label:'H1 heading',pass:h1.length===1,detail:`Found ${h1.length} H1 headings`},
   {key:'canonical',label:'Canonical URL',pass:!!canonical,detail:canonical||'Canonical link not found'},
   {key:'robots',label:'Indexability',pass:!/(noindex|none)/i.test(robots),detail:robots},
   {key:'https',label:'HTTPS',pass:base.protocol==='https:',detail:base.protocol},
   {key:'viewport',label:'Mobile viewport',pass:/name=["']viewport["']/i.test(html),detail:/name=["']viewport["']/i.test(html)?'Viewport configured':'Viewport meta tag missing'},
   {key:'sitemap',label:'Sitemap',pass:false,detail:'Sitemap check pending'}
  ];
  let sitemap=false;try{const sr=await fetch(new URL('/sitemap.xml',base),{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'AnairaGrowthBot/1.0'}});sitemap=sr.ok&&((sr.headers.get('content-type')||'').includes('xml')|| (await sr.text()).includes('<urlset'));}catch{}checks.find(x=>x.key==='sitemap')!.pass=sitemap;checks.find(x=>x.key==='sitemap')!.detail=sitemap?'Sitemap found':'Sitemap not found at /sitemap.xml';
  const score=Math.round(checks.filter(x=>x.pass).length/checks.length*100);
  const report={websiteId,domain:base.hostname,scannedAt:new Date().toISOString(),httpStatus:response.status,elapsedMs:Date.now()-started,title,description,h1,canonical,robots,internalLinks:internal.size,externalLinks:external.size,checks,score,summary:`${checks.filter(x=>x.pass).length} of ${checks.length} homepage checks passed.`};
  const {data:audit,error:saveError}=await c.db.from('growth_website_audits').insert({organization_id:orgId,website_id:websiteId,audit_type:action==='health'?'health':'seo',score,report,created_by:c.userId}).select('id,score,created_at').single();
  if(saveError)return apiJson({error:'Audit completed but report could not be saved. Apply the Website Growth Intelligence migration.'},503);
  return apiJson({success:true,audit,report});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Website scan failed.'},400);}
}
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const orgId=req.nextUrl.searchParams.get('organizationId')||'',websiteId=req.nextUrl.searchParams.get('websiteId')||'';
 if(!await requireGrowthRole(c.db,c.userId,orgId,['owner','manager','editor','viewer','client']))return apiJson({error:'Workspace permission denied.'},403);
 let q=c.db.from('growth_website_audits').select('id,website_id,audit_type,score,report,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(30);
 if(websiteId)q=q.eq('website_id',websiteId);const {data,error}=await q;
 if(error)return apiJson({error:'Website audit history unavailable. Apply the Website Growth Intelligence migration.'},503);
 return apiJson({audits:data||[]});
}
