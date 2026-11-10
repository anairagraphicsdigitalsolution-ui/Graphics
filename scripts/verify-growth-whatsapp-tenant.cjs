const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const checks=[
 ['tenant WhatsApp connection migration is present',fs.existsSync('supabase/migrations/20261109270000_growth_whatsapp_tenant_connections_v6761.sql')],
 ['WhatsApp credentials are encrypted using existing AES-GCM helper',read('app/api/growth/whatsapp/connection/route.ts').includes('encryptSecret')&&read('lib/growth-crypto.ts').includes('aes-256-gcm')],
 ['connection setup verifies phone ID with Meta before persistence',read('app/api/growth/whatsapp/connection/route.ts').includes('graph.facebook.com')&&read('app/api/growth/whatsapp/connection/route.ts').includes('verified_name')],
 ['connection status API never selects encrypted credentials for client response',!read('app/api/growth/whatsapp/connection/route.ts').split('export async function GET')[1].split('export async function POST')[0].includes('encrypted_credentials')],
 ['incoming webhook maps Meta phone_number_id to one tenant',read('app/api/growth/whatsapp/webhook/route.ts').includes("eq('phone_number_id',phoneId)")&&read('app/api/growth/whatsapp/webhook/route.ts').includes('growth_whatsapp_connections')],
 ['outbound WhatsApp API resolves credentials by organization',read('app/api/growth/whatsapp/send/route.ts').includes('getWhatsAppCredentials(c.db,orgId,conversation?.channel_phone_number_id||null)')],
 ['human inbox WhatsApp reply resolves tenant credentials',read('app/api/growth/inbox/reply/route.ts').includes('getWhatsAppCredentials(ctx.db,org,conv.channel_phone_number_id||null)')],
 ['worker WhatsApp text and template sends resolve tenant credentials',read('app/api/growth/worker/route.ts').includes('getWhatsAppCredentials(db,job.organization_id,conversation?.channel_phone_number_id||null)')&&read('app/api/growth/worker/route.ts').includes('originConversation?.channel_phone_number_id||null')],
 ['free-form direct sends enforce consent and 24-hour window',read('app/api/growth/whatsapp/send/route.ts').includes('contact_opted_out_at')&&read('app/api/growth/whatsapp/send/route.ts').includes('24 hours')],
 ['channel UI includes tenant WhatsApp connection form',read('components/growth-control-center.tsx').includes('GrowthWhatsAppConnection')&&fs.existsSync('components/growth-whatsapp-connection.tsx')],
 ['suspended tenants pause background jobs',read('app/api/growth/worker/route.ts').includes('paused_tenant')&&read('app/api/growth/worker/route.ts').includes('Workspace is suspended')],
];let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
