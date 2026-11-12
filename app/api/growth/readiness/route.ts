import {NextRequest} from 'next/server';
import {apiJson,growthContext,requireGrowthRole} from '@/lib/growth-server';
export const runtime='nodejs';
const env=(...keys:string[])=>keys.every(k=>Boolean(process.env[k]?.trim()));
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager','viewer']))return apiJson({error:'Workspace permission denied.'},403);
 const [{data:facebookAccounts,error:facebookError},{data:socialAccounts,error:socialError},{data:whatsappConnections,error:whatsappError},{data:workflows,error:workflowError},{data:links,error:linksError},{data:jobs,error:jobsError},{data:deadLetters,error:deadLetterError},{data:inboundAddresses,error:inboundError},{data:integrationRows,error:integrationError}]=await Promise.all([
  c.db.from('growth_social_accounts').select('id,platform,connection_status,scopes').eq('organization_id',org).eq('platform','facebook').eq('connection_status','connected'),
  c.db.from('growth_social_accounts').select('id,platform,connection_status').eq('organization_id',org).eq('connection_status','connected'),
  c.db.from('growth_whatsapp_connections').select('id,connection_status').eq('organization_id',org).eq('connection_status','connected'),
  c.db.from('growth_automation_rules').select('id,enabled').eq('organization_id',org).limit(200),
  c.db.from('growth_promotion_links').select('id,click_count,enabled').eq('organization_id',org).limit(200),
  c.db.from('growth_jobs').select('id,status,job_type').eq('organization_id',org).in('status',['queued','processing','failed']).limit(500),
  c.db.from('growth_workflow_dead_letters').select('id,status').eq('organization_id',org).eq('status','open').limit(200),
  c.db.from('growth_inbound_email_addresses').select('id,is_active').eq('organization_id',org).eq('is_active',true).limit(100),
  c.db.from('growth_integrations').select('provider,connection_status,settings').eq('organization_id',org).eq('connection_status','connected'),
 ]);
 const connectedIntegration=(provider:string)=>((integrationRows||[]) as any[]).find(x=>x.provider===provider)?.settings||null;
 const openaiIntegration=connectedIntegration('openai'),googleCseIntegration=connectedIntegration('google_cse'),twilioIntegration=connectedIntegration('twilio'),resendIntegration=connectedIntegration('resend');
 const hasAdsScope=(facebookAccounts||[]).some((a:any)=>Array.isArray(a.scopes)&&a.scopes.includes('ads_management'));
 const hasAdsReadScope=(facebookAccounts||[]).some((a:any)=>Array.isArray(a.scopes)&&a.scopes.includes('ads_read'));
 const socialCount=(socialAccounts||[]).length;
 const queuedJobs=(jobs||[]).filter((j:any)=>j.status==='queued'||j.status==='processing').length;
 const failedJobs=(jobs||[]).filter((j:any)=>j.status==='failed').length;
 const openDeadLetters=(deadLetters||[]).length;
 const checks=[
  {id:'ai',name:'AI strategy and generation',ready:env('OPENAI_API_KEY')||Boolean(openaiIntegration),requirements:['Connected OpenAI integration or OPENAI_API_KEY server environment variable']},
  {id:'meta_ads',name:'Meta Ads API',ready:env('META_GRAPH_API_VERSION')&&hasAdsScope,requirements:['Connected Facebook account with ads_management permission','META_GRAPH_API_VERSION']},
  {id:'meta_conversions',name:'Meta Conversions API',ready:env('META_PIXEL_ID','META_CONVERSIONS_ACCESS_TOKEN','META_GRAPH_API_VERSION'),requirements:['META_PIXEL_ID','META_CONVERSIONS_ACCESS_TOKEN','META_GRAPH_API_VERSION']},
  {id:'social_publishing',name:'Social publishing accounts',ready:socialCount>0,requirements:['Connect at least one eligible Facebook, Instagram, LinkedIn or YouTube account'],note:'Connection presence is checked; a live publish test is still required.'},
  {id:'whatsapp_text',name:'WhatsApp messaging',ready:env('META_APP_SECRET','WHATSAPP_VERIFY_TOKEN','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY')&&(whatsappConnections||[]).length>0,requirements:['Meta app webhook configuration','Active tenant WhatsApp connection']},
  {id:'whatsapp_call_permissions',name:'WhatsApp call permission lifecycle',ready:!whatsappError,requirements:['Apply 20261111170000_growth_whatsapp_call_permissions.sql','Active tenant WhatsApp connection','Customer-service window for interactive permission request'],note:'Permission requests and reply capture are implemented. This does not place voice calls.'},
  {id:'whatsapp_calling',name:'WhatsApp Business Calling media',ready:false,requirements:['Meta WhatsApp Business Calling eligibility and feature enablement','WebRTC/SIP media provider with SDP offer/answer handling','Calling connect/status/terminate webhook processing','Live inbound and outbound call tests'],note:'WhatsApp-native WebRTC calling is still not implemented. The separate Twilio outbound TTS call foundation is available when configured.'},
  {id:'outbound_voice',name:'Outbound voice calling (Twilio)',ready:env('TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_VOICE_FROM','APP_BASE_URL'),requirements:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_VOICE_FROM','APP_BASE_URL','Explicit lead consent'],note:'Twilio outbound calling, signed status callbacks and call audit lifecycle are implemented. Live provider certification is still required.'},
  {id:'conversational_voice',name:'Conversational AI voice agent',ready:env('VOICE_AGENT_WS_URL','OPENAI_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN'),requirements:['Persistent WebSocket deployment for services/voice-agent','VOICE_AGENT_WS_URL (public wss:// URL)','OPENAI_API_KEY','Twilio ConversationRelay enabled and tested'],note:'ConversationRelay WebSocket service is included. It is not ready until the persistent service is deployed and a real consented call is verified.'},
  {id:'email',name:'Outbound email delivery',ready:env('RESEND_API_KEY')||Boolean(resendIntegration?.from_email),requirements:['Connected Resend integration with verified From Email, or RESEND_API_KEY and RESEND_FROM_EMAIL']},
  {id:'inbound_email',name:'Inbound email routing',ready:(env('RESEND_API_KEY')||Boolean(resendIntegration?.from_email))&&(inboundAddresses||[]).length>0,requirements:['RESEND_API_KEY','Active tenant inbound address','Provider inbound webhook and verified domain']},
  {id:'scheduler',name:'Automation scheduler',ready:env('CRON_SECRET'),requirements:['CRON_SECRET','Deploy scheduled worker/cron invocation']},
  {id:'database',name:'Supabase server integration',ready:env('NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'),requirements:['Supabase URL and service role key']},
  {id:'prospect_discovery',name:'Automated business prospect discovery',ready:env('GOOGLE_CSE_API_KEY','GOOGLE_CSE_CX')||Boolean(googleCseIntegration?.cx),requirements:['Connected Google Custom Search integration with Search Engine ID, or GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX','Human review before CRM import/outreach'],note:'Searches indexed public business websites, performs a bounded homepage enrichment attempt, stores public business contact details and a heuristic quality score, and records run history. Contact details require human verification; outreach consent remains false.'},
  {id:'campaign_optimization',name:'Live Meta campaign performance optimization',ready:env('META_GRAPH_API_VERSION')&&hasAdsReadScope,requirements:['Connected Facebook account with ads_read permission','META_GRAPH_API_VERSION','Correct Meta conversion event attribution'],note:'Live Meta insights and performance recommendations are available. Phase 31 adds approval-gated budget/status proposals, stale-state checks, bounded budget changes and rollback. Requires ads_read for analysis and ads_management for execution.'},
  {id:'campaign_optimization_execution',name:'Campaign optimization execution',ready:env('META_GRAPH_API_VERSION')&&hasAdsScope,requirements:['Connected Facebook account with ads_management permission','Owner/manager approval','MAX_AUTOMATED_BUDGET_CHANGE_PERCENT and MAX_META_DAILY_BUDGET_MINOR safety limits'],note:'Changes remain approval-gated: proposals require explicit owner/manager approval and can be rolled back.'},
 ];
 const queryErrors=[facebookError,socialError,whatsappError,workflowError,linksError,jobsError,deadLetterError,inboundError,integrationError].filter(Boolean);
 const blockingChecks=checks.filter((x:any)=>!x.ready).map((x:any)=>x.id);
 const workflowRows=workflows||[],linkRows=links||[];
 const metrics={workflowRules:workflowRows.length,enabledWorkflows:workflowRows.filter((x:any)=>x.enabled).length,promotionLinks:linkRows.length,promotionClicks:linkRows.reduce((n:number,x:any)=>n+Number(x.click_count||0),0),connectedSocialAccounts:socialCount,connectedWhatsAppNumbers:(whatsappConnections||[]).length,activeInboundEmailAddresses:(inboundAddresses||[]).length,queuedOrProcessingJobs:queuedJobs,failedJobs,openWorkflowDeadLetters:openDeadLetters};
 const operationalState=queryErrors.length?'data_check_required':failedJobs||openDeadLetters?'attention_required':'observed';

 return apiJson({checks:checks.map((x:any)=>({...x,status:x.ready?'configured':'action_required'})),metrics,operationalState,blockingChecks,certification:'not_certified',completion:'incomplete',queryErrors:queryErrors.length?['One or more operational tables could not be read; verify required Supabase migrations and permissions.']:[],generatedAt:new Date().toISOString()});
}
