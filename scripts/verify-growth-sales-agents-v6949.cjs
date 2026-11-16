'use strict';
const fs=require('node:fs');
const api=fs.readFileSync('app/api/growth/whatsapp/calling/calls/route.ts','utf8');
const webhook=fs.readFileSync('app/api/growth/whatsapp/webhook/route.ts','utf8');
const ui=fs.readFileSync('app/admin/ai-growth/calling/page.tsx','utf8');
const worker=fs.readFileSync('services/voice-agent/server.mjs','utf8');
const status=fs.readFileSync('app/api/growth/voice-calls/status/route.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20261115140404_growth_ai_sales_agent_inbound_call_queue_v6949.sql','utf8');
const privacyMigration=fs.readFileSync('supabase/migrations/20261115140807_growth_ai_sales_agent_call_session_privacy_hardening_v6949b.sql','utf8');
const checks=[
 ['Manager-only API authorization',api.includes("requireGrowthRole(c.db, c.userId, organizationId, ['owner', 'manager'])")],
 ['WhatsApp feature entitlement',api.includes("requireGrowthFeature(c.db, c.userId, organizationId, 'whatsapp')")],
 ['Outbound calls require granted, unexpired customer permission',api.includes("permission.permission_status !== 'granted'")&&api.includes('permission.expires_at')],
 ['Outbound calls block global opt-out',api.includes('lead.contact_opted_out_at')],
 ['Inbound call offer persisted from signed Meta webhook',webhook.includes("direction==='USER_INITIATED'")&&webhook.includes('session:{sdp_type')],
 ['Inbound call remains queueable if lead already has active call',webhook.includes('fallbackError')&&webhook.includes('lead_id:null')],
 ['Inbound accept creates browser SDP answer',api.includes("action === 'accept'")&&api.includes("sdp_type: 'answer'")],
 ['Inbound calls can be explicitly rejected',api.includes("action === 'reject'")],
 ['Inbound call queue is tenant scoped',api.includes("eq('organization_id', organizationId)")&&api.includes("eq('direction', 'inbound')")],
 ['Live schema uses whatsapp_call_id and call_metadata',api.includes('whatsapp_call_id')&&api.includes('call_metadata')&&!api.includes("select('id,phone_number_id,provider_call_id")],
 ['TURN credentials are short-lived HMAC credentials',api.includes('WHATSAPP_TURN_SHARED_SECRET')&&api.includes("createHmac('sha1'")],
 ['Browser auto-refreshes incoming call queue',ui.includes('INBOUND CALL QUEUE')&&ui.includes('setInterval(load,2500)')],
 ['Browser creates real WebRTC answer for inbound calls',ui.includes("setRemoteDescription({type:'offer'")&&ui.includes('createAnswer()')],
 ['Browser uses returned ICE server configuration',ui.includes('loadIceServers')&&ui.includes('iceServers:await loadIceServers()')],
 ['Twilio status callbacks validate signature',status.includes('validTwilioSignature')&&status.includes('timingSafeEqual')],
 ['ConversationRelay verifies signed websocket handshake',worker.includes('validTwilioHandshake')&&worker.includes('timingSafeEqual')],
 ['Voice agent records caller opt-out',worker.includes('voice_call.opt_out')&&worker.includes("contact_opt_out_source: 'voice_call_verbal_request'")],
 ['Voice agent creates human follow-up task',worker.includes('Human follow-up requested during AI voice call')],
 ['Inbound queue and provider lookup indexes included',migration.includes('growth_wa_inbound_call_queue_v6949_idx')&&migration.includes('growth_wa_call_provider_lookup_v6949_idx')],
 ['Call SDP and session metadata are manager-only',privacyMigration.includes('growth_wa_call_sessions_member_select')&&privacyMigration.includes('private.is_growth_manager(organization_id)')],
];
let failed=0;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;
