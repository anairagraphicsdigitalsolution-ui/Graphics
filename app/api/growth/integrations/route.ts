import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';
export const runtime = 'nodejs';

const CATALOG: Record<string,{label:string;secret:string[];settings:string[]}> = {
  openai:{label:'OpenAI',secret:['api_key'],settings:['model','base_url']},
  google:{label:'Google Cloud / OAuth',secret:['client_id','client_secret','api_key','access_token','refresh_token'],settings:['project_id','redirect_uri']},
  google_cse:{label:'Google Custom Search',secret:['api_key'],settings:['cx']},
  meta:{label:'Meta / Facebook / Instagram',secret:['app_id','app_secret','access_token','app_id_secret'],settings:['graph_api_version','redirect_uri','webhook_verify_token','pixel_id']},
  whatsapp:{label:'WhatsApp Business Cloud API',secret:['access_token','app_secret'],settings:['phone_number_id','waba_id','graph_api_version','verify_token']},
  instagram:{label:'Instagram Graph API',secret:['access_token','app_secret'],settings:['instagram_user_id','graph_api_version']},
  twilio:{label:'Twilio Voice / SMS',secret:['account_sid','auth_token','api_key_sid','api_key_secret'],settings:['from_number','voice_agent_ws_url','app_base_url']},
  resend:{label:'Resend Email',secret:['api_key'],settings:['from_email','from_name','webhook_secret']},
  cashfree:{label:'Cashfree Payments',secret:['client_id','client_secret'],settings:['environment','api_version','webhook_secret']},
  youtube:{label:'YouTube Data API',secret:['api_key','client_id','client_secret','access_token','refresh_token'],settings:['channel_id','redirect_uri']},
  linkedin:{label:'LinkedIn',secret:['client_id','client_secret','access_token','refresh_token'],settings:['organization_id','redirect_uri']},
  anthropic:{label:'Anthropic',secret:['api_key'],settings:['model','base_url']},
  gemini:{label:'Google Gemini',secret:['api_key'],settings:['model']},
  razorpay:{label:'Razorpay',secret:['key_id','key_secret','webhook_secret'],settings:['environment']},
  smtp:{label:'Custom SMTP',secret:['password'],settings:['host','port','username','from_email','secure']},
};
const safe = (v:unknown)=>typeof v==='string'?v.trim().slice(0,2000):'';
export async function GET(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 const org=req.nextUrl.searchParams.get('organizationId')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
 const [{data,error},{data:events},{data:webhooks}]=await Promise.all([
  c.db.from('growth_integrations').select('id,provider,display_name,encrypted_credentials,settings,connection_status,last_tested_at,last_error,updated_at').eq('organization_id',org).order('provider'),
  c.db.from('growth_integration_events').select('id,provider,event_type,status,message,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(30),
  c.db.from('growth_webhook_events').select('id,provider,event_type,processing_status,error_message,received_at').eq('organization_id',org).order('received_at',{ascending:false}).limit(30)
 ]);
 if(error)return apiJson({error:'Integration storage is unavailable. Apply the integrations migration first.'},503);
 const rows=(data||[]).map((r:any)=>{let secrets:any={};try{secrets=decryptSecret(r.encrypted_credentials||'')||{};}catch{};const spec=CATALOG[r.provider];return {id:r.id,provider:r.provider,displayName:r.display_name||spec?.label||r.provider,settings:r.settings||{},configuredKeys:spec?spec.secret.filter((k:string)=>Boolean(secrets[k])):[],masked:spec?Object.fromEntries(spec.secret.filter((k:string)=>Boolean(secrets[k])).map((k:string)=>[k,`••••••${String(secrets[k]).slice(-4)}`])):{},connectionStatus:r.connection_status,lastTestedAt:r.last_tested_at,lastError:r.last_error,updatedAt:r.updated_at};});
 return apiJson({catalog:Object.entries(CATALOG).map(([id,v])=>({id,...v})),integrations:rows,events:events||[],webhooks:webhooks||[]});
}
export async function PUT(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),org=String(b.organizationId||''),provider=String(b.provider||'');if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const spec=CATALOG[provider];if(!spec)return apiJson({error:'Unsupported integration provider.'},400);
  const {data:old,error:readError}=await c.db.from('growth_integrations').select('id,encrypted_credentials,settings').eq('organization_id',org).eq('provider',provider).maybeSingle();if(readError)return apiJson({error:'Could not read existing integration.'},500);
  let secrets:any={};if(old?.encrypted_credentials){try{secrets=decryptSecret(old.encrypted_credentials)||{};}catch{return apiJson({error:'Stored credentials cannot be decrypted. Check GROWTH_TOKEN_ENCRYPTION_KEY.'},503);}}
  const incoming=b.credentials&&typeof b.credentials==='object'?b.credentials:{};
  for(const key of spec.secret){if(typeof incoming[key]==='string'&&incoming[key].trim())secrets[key]=safe(incoming[key]);if(incoming[key]===null)delete secrets[key];}
  const incomingSettings=b.settings&&typeof b.settings==='object'?b.settings:{};const settings:any={...(old?.settings||{})};for(const key of spec.settings){if(incomingSettings[key]!==undefined)settings[key]=typeof incomingSettings[key]==='boolean'?incomingSettings[key]:safe(String(incomingSettings[key]));}
  const displayName=safe(b.displayName)||spec.label;
  const payload={organization_id:org,provider,display_name:displayName,encrypted_credentials:encryptSecret(secrets),settings,connection_status:Object.keys(secrets).length?'saved':'not_configured',last_error:null,updated_at:new Date().toISOString(),updated_by:c.userId};
  const {data,error}=await c.db.from('growth_integrations').upsert(payload,{onConflict:'organization_id,provider'}).select('id,provider,display_name,settings,connection_status,updated_at').single();
  if(error)return apiJson({error:'Could not securely save integration. Verify the Phase 31.2 migration and encryption key.'},500);
  return apiJson({success:true,integration:data});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Invalid integration payload.'},400);}
}
export async function DELETE(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;const org=req.nextUrl.searchParams.get('organizationId')||'',provider=req.nextUrl.searchParams.get('provider')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
 if(!CATALOG[provider])return apiJson({error:'Unsupported integration provider.'},400);
 const {data:existing}=await c.db.from('growth_integrations').select('settings').eq('organization_id',org).eq('provider',provider).maybeSingle();
 if(provider==='whatsapp'&&existing?.settings?.phone_number_id)await c.db.from('growth_whatsapp_connections').delete().eq('organization_id',org).eq('phone_number_id',String(existing.settings.phone_number_id));
 const {error}=await c.db.from('growth_integrations').delete().eq('organization_id',org).eq('provider',provider);if(error)return apiJson({error:'Could not remove integration.'},500);return apiJson({success:true});
}
