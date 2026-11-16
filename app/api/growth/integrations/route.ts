import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';
export const runtime = 'nodejs';

const CATALOG: Record<string,{label:string;secret:string[];settings:string[]}> = {
  openai:{label:'OpenAI',secret:['api_key'],settings:['model','base_url']},
  google:{label:'Google Cloud / OAuth',secret:['client_id','client_secret','api_key','access_token','refresh_token'],settings:['project_id','redirect_uri','business_account_name','business_location_name','review_url']},
  google_cse:{label:'Google Custom Search',secret:['api_key'],settings:['cx']},
  google_ads:{label:'Google Ads (Client Account)',secret:['refresh_token','access_token','client_id','client_secret'],settings:['customer_id','login_customer_id','redirect_uri','currency_code','time_zone','conversion_action_id','conversion_customer_id','google_ads_auto_pause_enabled','google_ads_auto_pause_min_cost_micros','google_ads_auto_pause_min_clicks','google_ads_auto_pause_min_impressions']},
  zerobounce:{label:'ZeroBounce Email Verification',secret:['api_key'],settings:[]},
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
  c.db.from('growth_integrations').select('id,provider,display_name,encrypted_credentials,settings,connection_status,last_tested_at,last_success_at,last_error,credential_version,credential_rotated_at,updated_at').eq('organization_id',org).order('provider'),
  c.db.from('growth_integration_events').select('id,provider,event_type,status,message,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(30),
  c.db.from('growth_webhook_events').select('id,provider,event_type,processing_status,error_message,received_at').eq('organization_id',org).order('received_at',{ascending:false}).limit(30)
 ]);
 if(error)return apiJson({error:'Integration storage is unavailable. Apply the integrations migration first.'},503);
 const rows=(data||[]).map((r:any)=>{let secrets:any={};try{secrets=decryptSecret(r.encrypted_credentials||'')||{};}catch{};const spec=CATALOG[r.provider];return {id:r.id,provider:r.provider,displayName:r.display_name||spec?.label||r.provider,settings:r.settings||{},configuredKeys:spec?spec.secret.filter((k:string)=>Boolean(secrets[k])):[],masked:spec?Object.fromEntries(spec.secret.filter((k:string)=>Boolean(secrets[k])).map((k:string)=>[k,`••••••${String(secrets[k]).slice(-4)}`])):{},connectionStatus:r.connection_status,lastTestedAt:r.last_tested_at,lastSuccessAt:r.last_success_at||null,credentialVersion:r.credential_version||1,credentialRotatedAt:r.credential_rotated_at||null,lastError:r.last_error,updatedAt:r.updated_at};});
 return apiJson({catalog:Object.entries(CATALOG).map(([id,v])=>({id,...v})),integrations:rows,events:events||[],webhooks:webhooks||[]});
}
export async function PUT(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;
 try{const b=await req.json(),org=String(b.organizationId||''),provider=String(b.provider||'');if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
  const spec=CATALOG[provider];if(!spec)return apiJson({error:'Unsupported integration provider.'},400);
  const {data:old,error:readError}=await c.db.from('growth_integrations').select('id,encrypted_credentials,settings,credential_version').eq('organization_id',org).eq('provider',provider).maybeSingle();if(readError)return apiJson({error:'Could not read existing integration.'},500);
  let secrets:any={};if(old?.encrypted_credentials){try{secrets=decryptSecret(old.encrypted_credentials)||{};}catch{return apiJson({error:'Stored credentials cannot be decrypted. Check GROWTH_TOKEN_ENCRYPTION_KEY.'},503);}}
  const incoming=b.credentials&&typeof b.credentials==='object'?b.credentials:{};
  let rotated=false;for(const key of spec.secret){if(typeof incoming[key]==='string'&&incoming[key].trim()){const next=safe(incoming[key]);if(secrets[key]!==next)rotated=true;secrets[key]=next;}if(incoming[key]===null&&secrets[key]!==undefined){delete secrets[key];rotated=true;}}
  const incomingSettings=b.settings&&typeof b.settings==='object'?b.settings:{};const settings:any={...(old?.settings||{})};for(const key of spec.settings){if(incomingSettings[key]!==undefined)settings[key]=typeof incomingSettings[key]==='boolean'?incomingSettings[key]:safe(String(incomingSettings[key]));}
  const displayName=safe(b.displayName)||spec.label;
  const stamp=new Date().toISOString();const payload={organization_id:org,provider,display_name:displayName,encrypted_credentials:encryptSecret(secrets),settings,connection_status:Object.keys(secrets).length?'saved':'not_configured',last_error:null,credential_version:(Number(old?.credential_version)||0)+(rotated?1:0),credential_rotated_at:rotated?stamp:undefined,updated_at:stamp,updated_by:c.userId};
  const {data,error}=await c.db.from('growth_integrations').upsert(payload,{onConflict:'organization_id,provider'}).select('id,provider,display_name,settings,connection_status,updated_at').single();
  if(error)return apiJson({error:'Could not securely save integration. Verify the Phase 31.2 migration and encryption key.'},500);
  await c.db.from('growth_integration_events').insert({organization_id:org,provider,event_type:rotated?'credential_rotated':'credential_saved',status:'success',message:rotated?'Workspace provider credentials rotated.':'Workspace provider settings saved.',metadata:{credential_version:payload.credential_version,actor_id:c.userId}});
  return apiJson({success:true,integration:data});
 }catch(e){return apiJson({error:e instanceof Error?e.message:'Invalid integration payload.'},400);}
}
export async function DELETE(req:NextRequest){
 const c=await growthContext(req);if('response'in c)return c.response;const org=req.nextUrl.searchParams.get('organizationId')||'',provider=req.nextUrl.searchParams.get('provider')||'';
 if(!await requireGrowthRole(c.db,c.userId,org,['owner','manager']))return apiJson({error:'Workspace owner or manager permission required.'},403);
 if(!CATALOG[provider])return apiJson({error:'Unsupported integration provider.'},400);
 const {data:existing}=await c.db.from('growth_integrations').select('settings').eq('organization_id',org).eq('provider',provider).maybeSingle();
 if(provider==='whatsapp'&&existing?.settings?.phone_number_id)await c.db.from('growth_whatsapp_connections').delete().eq('organization_id',org).eq('phone_number_id',String(existing.settings.phone_number_id));
 const {error}=await c.db.from('growth_integrations').delete().eq('organization_id',org).eq('provider',provider);if(error)return apiJson({error:'Could not remove integration.'},500);await c.db.from('growth_integration_events').insert({organization_id:org,provider,event_type:'credential_removed',status:'success',message:'Workspace provider credentials removed.',metadata:{actor_id:c.userId}});return apiJson({success:true});
}
