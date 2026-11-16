'use strict';
const fs=require('node:fs');
const route=fs.readFileSync('app/api/growth/whatsapp/calling/calls/route.ts','utf8');
const page=fs.readFileSync('app/admin/ai-growth/calling/page.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261114130000_growth_whatsapp_native_call_sessions.sql','utf8');
const webhook=fs.readFileSync('app/api/growth/whatsapp/webhook/route.ts','utf8');
const nav=fs.readFileSync('components/growth-primary-nav.tsx','utf8');
const permissionRoute=fs.readFileSync('app/api/growth/whatsapp/calling/permission/route.ts','utf8');
const checks=[
 ['Native Meta calls endpoint',route.includes('/calls')],
 ['Browser SDP offer required',route.includes("sdp_type: 'offer'")&&route.includes("sdp.startsWith('v=0')")],
 ['Granted permission required',route.includes("permission.permission_status !== 'granted'")],
 ['Permission expiry enforced',route.includes('permission.expires_at')],
 ['Lead opt-out enforced',route.includes('lead.contact_opted_out_at')],
 ['Tenant role and feature gates',route.includes("requireGrowthRole")&&route.includes("requireGrowthFeature")],
 ['Call termination action',route.includes("action: 'terminate'")],
 ['Single active call database invariant',migration.includes('growth_whatsapp_call_sessions_one_active_lead_idx')],
 ['RLS enabled',migration.includes('enable row level security')],
 ['Browser WebRTC microphone',page.includes('getUserMedia')&&page.includes('RTCPeerConnection')],
 ['Remote SDP answer applied',page.includes('setRemoteDescription')],
 ['Customer-granted permission selector',page.includes('growth_whatsapp_call_permissions')&&page.includes("permission_status','granted")],
 ['Call termination UI',page.includes('End Call')&&page.includes("action:'terminate'")],
 ['Webhook call lifecycle updates',webhook.includes('callEvents')&&webhook.includes("event==='terminate'")],
 ['Inbound caller connect webhook persisted',webhook.includes("direction==='USER_INITIATED'")&&webhook.includes("call_status:'ringing'")],
 ['Inbound queue endpoint',route.includes("eq('direction', 'inbound')")&&route.includes("eq('call_status', 'ringing')")],
 ['Inbound accept uses browser SDP answer',route.includes("action === 'accept'")&&route.includes("sdp_type: 'answer'")],
 ['Inbound reject action',route.includes("action === 'reject'")],
 ['Meta pre-accept and accept sequence',route.includes("action: 'pre_accept'")&&route.includes("action: 'accept'")],
 ['Live database column contract',route.includes('whatsapp_call_id')&&route.includes('call_metadata')&&route.includes("direction: 'outbound'")&&!route.includes("select('id,phone_number_id,provider_call_id")],
 ['Short-lived TURN credentials',route.includes('WHATSAPP_TURN_SHARED_SECRET')&&route.includes("createHmac('sha1'")],
 ['Inbound queue UI polling',page.includes('INBOUND CALL QUEUE')&&page.includes('acceptIncoming')&&page.includes('rejectIncoming')],
 ['TURN configuration is consumed by browser',page.includes('loadIceServers')&&page.includes('new RTCPeerConnection({iceServers:await loadIceServers()})')],
 ['Navigation entry',nav.includes('/admin/ai-growth/calling')],
 ['Permission request resolves credentials within the tenant',permissionRoute.includes('getWhatsAppCredentials(c.db,orgId,conv.channel_phone_number_id||null)')],
 ['WebRTC timeout automatically terminates unanswered media session',page.includes('45000')&&page.includes("action:'terminate'")],
 ['SDP failure attempts provider cleanup',page.includes('catch(remoteError)')&&page.includes('sessionId:data.sessionId')],
];
let failed=0;
for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);
process.exitCode=failed?1:0;
