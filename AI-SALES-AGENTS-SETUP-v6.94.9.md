# Anaira AI Growth Engine — Module 4: AI Sales Agents (v6.94.9)

## Included in this release

- Tenant-scoped WhatsApp Business Calling queue for inbound user-initiated calls.
- Signed Meta webhook handling for inbound `connect` call events; the incoming SDP offer is persisted in the call session metadata.
- Manager-only inbound queue API and browser UI with Accept / Reject actions.
- Browser-generated WebRTC SDP answer; server performs Meta `pre_accept` followed by `accept`.
- Outbound WhatsApp calls remain gated by a matching, current customer-granted call permission and contact opt-out checks.
- Call lifecycle uses the live database column contract: `direction`, `whatsapp_call_id`, `call_metadata`, `provider_error`, `connected_at`, `ended_at`.
- Optional short-lived TURN REST credentials generated server-side using HMAC-SHA1; only expiring credentials are sent to the browser.
- Provider call lookup and inbound queue indexes.
- Twilio ConversationRelay worker continues to validate its signed WebSocket handshake, record transcript/summary, honor verbal opt-out, and create a human follow-up task.

## Required environment

```env
# Optional but strongly recommended for production NAT/firewall reliability
WHATSAPP_TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349
WHATSAPP_TURN_SHARED_SECRET=your-coturn-static-auth-secret
WHATSAPP_TURN_TTL_SECONDS=900

# Existing Twilio ConversationRelay worker requirements
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VOICE_AGENT_WS_URL=wss://your-worker-host/twilio/voice
TWILIO_AUTH_TOKEN=
```

`WHATSAPP_TURN_URLS` and `WHATSAPP_TURN_SHARED_SECRET` must match a TURN server configured for the coturn REST credential mechanism. If they are not configured, the browser uses the public STUN fallback only; restrictive networks may fail media negotiation.

## Meta setup

1. Enable WhatsApp Business Calling for the connected Cloud API phone number and confirm the number/app is eligible.
2. Subscribe the Meta webhook to the `calls` field and point it at `/api/growth/whatsapp/webhook`.
3. Ensure `META_APP_SECRET` is configured so the webhook signature is verified.
4. Keep the AI Growth Engine calling dashboard open for inbound call queue polling; browser microphone permission is required to accept.
5. Verify a real inbound test call and a real outbound test call with the connected WABA. Source checks do not prove Meta account eligibility or live provider acceptance.

## Database migration

`20261115140404_growth_ai_sales_agent_inbound_call_queue_v6949.sql` adds two non-destructive indexes; the two following v6.94.9 privacy migrations restrict call-session reads to managers and platform admins to the existing live calling schema. The inbound/provider indexes and manager-only session-read policy were applied to project `nrsdqrqkffhbicfskilb` and confirmed in the live catalog.

The live project already had the call-session table and its prior lifecycle migrations. The older source migration `20261114130000_growth_whatsapp_native_call_sessions.sql` was aligned to the live column contract for future clean deployments; do not replay historical DDL manually against an existing database.

## Verification limits

- Static source checks cover inbound/outbound consent gates, signed webhook intake, WebRTC offer/answer handling, queue behavior, TURN credential generation and Twilio worker protections.
- A live Meta call, TURN relay, Twilio call, inbound human transfer and real audio quality test still require configured provider accounts, a public deployment and owner-controlled credentials.
- Human escalation currently creates a CRM follow-up task; it is not a live PSTN/agent bridge transfer.
