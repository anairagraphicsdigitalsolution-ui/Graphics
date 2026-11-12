import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
const env=(...keys:string[])=>keys.every(k=>Boolean(process.env[k]?.trim()));
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const [{data:facebookAccounts},{data:whatsappConnections}]=await Promise.all([
  c.db.from('growth_social_accounts').select('id,platform,connection_status,scopes').eq('organization_id',org).eq('platform','facebook').eq('connection_status','connected'),
  c.db.from('growth_whatsapp_connections').select('id,connection_status').eq('organization_id',org).eq('connection_status','connected')
 ]);
 const hasAdsScope=(facebookAccounts||[]).some((a:any)=>Array.isArray(a.scopes)&&a.scopes.includes('ads_management'));
 const checks=[
  {id:'ai',name:'AI strategy and generation',ready:env('OPENAI_API_KEY'),requirements:['OPENAI_API_KEY']},
  {id:'meta_ads',name:'Meta Ads API',ready:env('META_GRAPH_API_VERSION')&&hasAdsScope,requirements:['Connected Facebook account with ads_management permission','META_GRAPH_API_VERSION']},
  {id:'meta_conversions',name:'Meta Conversions API',ready:env('META_PIXEL_ID','META_CONVERSIONS_ACCESS_TOKEN','META_GRAPH_API_VERSION'),requirements:['META_PIXEL_ID','META_CONVERSIONS_ACCESS_TOKEN','META_GRAPH_API_VERSION']},
  {id:'whatsapp_text',name:'WhatsApp messaging',ready:env('META_APP_SECRET','WHATSAPP_VERIFY_TOKEN','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY')&&(whatsappConnections||[]).length>0,requirements:['Meta app webhook configuration','Active tenant WhatsApp connection']},
  {id:'whatsapp_call_permissions',name:'WhatsApp call permission lifecycle',ready:true,requirements:['Apply 20261111170000_growth_whatsapp_call_permissions.sql','Active tenant WhatsApp connection','Customer-service window for interactive permission request'],note:'Permission requests and reply capture are implemented. This does not place voice calls.'},
  {id:'whatsapp_calling',name:'WhatsApp Business Calling media',ready:false,requirements:['Meta WhatsApp Business Calling eligibility and feature enablement','WebRTC/SIP media provider with SDP offer/answer handling','Calling connect/status/terminate webhook processing','Live inbound and outbound call tests'],note:'Customer permission workflow is implemented; live voice media/signalling is not. No call will be initiated.'},
  {id:'email',name:'Email delivery',ready:env('RESEND_API_KEY'),requirements:['RESEND_API_KEY','Verified sending domain and webhook']},
  {id:'scheduler',name:'Automation scheduler',ready:env('CRON_SECRET'),requirements:['CRON_SECRET','Deploy scheduled worker/cron invocation']},
  {id:'database',name:'Supabase server integration',ready:env('NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'),requirements:['Supabase URL and service role key']},
 ];
 const {data:workflows}=await c.db.from('growth_automation_rules').select('id,enabled').eq('organization_id',org).limit(200);
 const {data:links}=await c.db.from('growth_promotion_links').select('id,click_count,enabled').eq('organization_id',org).limit(200);
 return apiJson({checks:checks.map(x=>({...x,status:x.ready?'configured':'action_required'})),metrics:{workflowRules:(workflows||[]).length,enabledWorkflows:(workflows||[]).filter(x=>x.enabled).length,promotionLinks:(links||[]).length,promotionClicks:(links||[]).reduce((n,x)=>n+Number(x.click_count||0),0)},certification:'not_certified',generatedAt:new Date().toISOString()});
}
