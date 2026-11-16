import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
const clean=(v:unknown,n=160)=>String(v??'').trim().slice(0,n);
const unique=(values:string[])=>Array.from(new Set(values.map(v=>v.trim()).filter(Boolean)));
const MAX_HTML_BYTES=750_000;
async function readBoundedText(response:Response,maxBytes=MAX_HTML_BYTES){
 const declared=Number(response.headers.get('content-length')||0);
 if(Number.isFinite(declared)&&declared>maxBytes){await response.body?.cancel();return null;}
 if(!response.body)return '';
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>maxBytes){await reader.cancel();return null;}chunks.push(value);}}}
 finally{reader.releaseLock();}
 const merged=new Uint8Array(total);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength;}
 return new TextDecoder('utf-8',{fatal:false}).decode(merged);
}
function isPublicIp(ip:string){
 if(isIP(ip)===4){const p=ip.split('.').map(Number);return !(p[0]===10||p[0]===127||p[0]===0||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]>=224);}
 const x=ip.toLowerCase();return !(x==='::1'||x==='::'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe80:')||x.startsWith('::ffff:127.')||x.startsWith('::ffff:10.')||x.startsWith('::ffff:192.168.'));
}
export async function enrichWebsite(website:string,timeoutMs=10000){
 let origin:URL;try{origin=new URL(website);}catch{return {verified:false,email:null,phone:null,title:null,description:null,pagesCrawled:0};}const host=origin.hostname.toLowerCase();if(origin.protocol!=='https:'||origin.username||origin.password||!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||isIP(host))return {verified:false,email:null,phone:null,title:null,description:null,pagesCrawled:0};
 try{const addresses=await lookup(host,{all:true});if(!addresses.length||addresses.some(a=>!isPublicIp(a.address)))return {verified:false,email:null,phone:null,title:null,description:null,pagesCrawled:0};}catch{return {verified:false,email:null,phone:null,title:null,description:null,pagesCrawled:0};}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1000,Math.min(10000,timeoutMs)));
 try{
  const queue=[origin.href],visited=new Set<string>(),htmlParts:string[]=[];let title:string|null=null,description:string|null=null;
  while(queue.length&&visited.size<4){
   const target=queue.shift()!;if(visited.has(target))continue;visited.add(target);
   const targetUrl=new URL(target);if(targetUrl.protocol!=='https:'||targetUrl.hostname.toLowerCase()!==host||targetUrl.username||targetUrl.password)continue;
   // Re-check DNS for every fetched page; never follow redirects to a different host.
   const pageAddresses=await lookup(host,{all:true});if(!pageAddresses.length||pageAddresses.some(a=>!isPublicIp(a.address)))continue;
   const response=await fetch(target,{signal:controller.signal,headers:{'User-Agent':'AnairaGrowthBot/1.0 (+business prospect verification)','Accept':'text/html'},redirect:'manual',cache:'no-store'});
   if(response.status>=300&&response.status<400){await response.body?.cancel();continue;}if(!response.ok){await response.body?.cancel();continue;}
   const type=response.headers.get('content-type')||'';if(!type.toLowerCase().includes('text/html')){await response.body?.cancel();continue;}
   const html=await readBoundedText(response);if(html===null)continue;htmlParts.push(html);
   if(!title)title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&'),180)||null;
   if(!description)description=clean(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1],500)||null;
   if(queue.length<3){
    const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
    for(const href of links){try{const u=new URL(href,target);if(u.protocol!=='https:'||u.hostname!==host||!/(about|contact|company|team|business)/i.test(u.pathname)||u.pathname.length>120)continue;u.hash='';u.search='';if(!visited.has(u.href)&&!queue.includes(u.href))queue.push(u.href);}catch{}}
   }
  }
  const html=htmlParts.join('\n');
  const emails=unique([...(html.match(/mailto:([^"'?>\s]+)/gi)||[]).map(x=>x.replace(/^mailto:/i,'').split('?')[0]),...(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])].map(x=>x.toLowerCase()).filter(x=>!/(example\.|\.png$|\.jpg$|\.webp$)/i.test(x))).slice(0,3);
  const phones=unique([...(html.match(/tel:([^"'?>\s]+)/gi)||[]).map(x=>x.replace(/^tel:/i,'')),...(html.match(/(?:\+?\d[\d ()-]{7,}\d)/g)||[])].map(x=>x.replace(/[^+\d]/g,'')).filter(x=>x.length>=8&&x.length<=16)).slice(0,3);
  return {verified:htmlParts.length>0,email:emails[0]||null,phone:phones[0]||null,title,description,pagesCrawled:htmlParts.length};
 }catch{return {verified:false,email:null,phone:null,title:null,description:null,pagesCrawled:0};}finally{clearTimeout(timer);}
}

