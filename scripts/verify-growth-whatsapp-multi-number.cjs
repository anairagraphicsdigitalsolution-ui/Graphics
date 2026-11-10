const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261109170828_growth_whatsapp_multi_number_v678.sql');
const connection=read('app/api/growth/whatsapp/connection/route.ts');
const helper=read('lib/growth-whatsapp.ts');
const webhook=read('app/api/growth/whatsapp/webhook/route.ts');
const reply=read('app/api/growth/inbox/reply/route.ts');
const worker=read('app/api/growth/worker/route.ts');
const direct=read('app/api/growth/whatsapp/send/route.ts');
const ui=read('components/growth-whatsapp-connection.tsx');
const checks=[
 ['migration removes tenant-wide unique constraint while preserving phone-number uniqueness',migration.includes('drop constraint if exists growth_whatsapp_connections_organization_id_key')&&migration.includes('growth_whatsapp_connections_org_status_idx')],
 ['conversations persist receiving phone-number ID',migration.includes('add column if not exists channel_phone_number_id')],
 ['connection API lists all tenant numbers',connection.includes("select(fields)")&&connection.includes(".order('created_at'")],
 ['connection API upserts by globally unique Meta phone-number ID',connection.includes("{onConflict:'phone_number_id'}")],
 ['disconnect API revokes one selected connection only',connection.includes(".eq('id',connectionId)")&&connection.includes("encrypted_credentials:'revoked'")],
 ['WhatsApp credentials resolver supports an explicit phone-number ID',helper.includes('phoneNumberId?: string | null')&&helper.includes("query.eq('phone_number_id', phoneNumberId)")],
 ['credential resolver fails closed instead of guessing when multiple senders exist',helper.includes('Never guess a sender')&&helper.includes('(rows?.length || 0) > 1')],
 ['inbound webhook resolves tenant by verified phone-number ID',webhook.includes(".eq('phone_number_id',phoneId)")&&webhook.includes('channel_phone_number_id:phoneId')],
 ['conversations are isolated by receiving phone-number ID',webhook.includes(".eq('channel_phone_number_id',phoneId)")],
 ['human inbox replies use the conversation phone-number ID',reply.includes('conv.channel_phone_number_id||null')],
 ['manual CRM WhatsApp sends use the conversation phone-number ID',direct.includes('conversation?.channel_phone_number_id||null')],
 ['worker text and template sends use the originating conversation endpoint',worker.includes('conversation?.channel_phone_number_id||null')&&worker.includes('originConversation?.channel_phone_number_id||null')],
 ['workspace UI lists multiple connections and disconnects by connection ID',ui.includes('connections.map')&&ui.includes('disconnect(connection.id)')],
 ['workspace UI explains multiple number setup',ui.includes('Connect multiple verified WhatsApp Business phone numbers')],
];let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} multi-number checks passed.`);
