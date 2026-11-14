# Native WhatsApp Business Calling setup — v6.90.3

## What this release supports
Outbound WhatsApp Business Calling from the Growth workspace using Meta's native Calling API and browser WebRTC. This is not the Twilio voice path. The workspace page is `/admin/ai-growth/calling`.

## Required deployment steps
1. Confirm the Meta Business number is eligible for WhatsApp Business Calling and Calling is enabled for that phone number.
2. Connect the number through Growth Engine Integrations so its access token, phone-number ID and Graph API version are stored in the encrypted tenant integration vault.
3. Configure the Meta webhook for the same app and phone number. The existing WhatsApp webhook signature validation must be active with `META_APP_SECRET`.
4. Apply `supabase/migrations/20261114130000_growth_whatsapp_native_call_sessions.sql` to the dedicated Growth Engine Supabase project only.
5. Deploy the release on HTTPS. Browser microphone access requires a secure context.
6. For production, provision a TURN service and implement short-lived TURN credential delivery; the current browser page includes a public STUN server as a development baseline only.
7. In CRM, obtain explicit contact consent where required and send the WhatsApp call-permission request. The user must grant the permission. The calling page filters to granted, unexpired permissions.
8. Open WhatsApp Calling, select the same workspace and lead, choose the active permission and start the call. The user must allow microphone access.

## API and safety behavior
- `POST /api/growth/whatsapp/calling/calls` with `action=connect` accepts a browser-generated SDP offer and calls Meta `/{PHONE_NUMBER_ID}/calls` with `action=connect`.
- `action=terminate` terminates a known tenant-scoped Meta call ID.
- Owner/manager role and WhatsApp plan entitlement are checked server-side.
- Contact consent, opt-out, phone match, granted call permission and permission expiry are rechecked at call initiation.
- Concurrent active calls per lead are blocked by an RLS-protected session table and a partial unique index.
- Meta webhook call lifecycle events update outbound call session state.
- The UI auto-terminates if WebRTC media does not connect within 45 seconds.

## Not included / not certified
- Inbound WhatsApp call answering and agent routing.
- Production TURN provisioning and media quality certification.
- Meta app review, Business Calling eligibility approval, actual account configuration and live end-to-end call testing.
- A call can still be rejected by Meta if the account, phone number, token scopes, permission or Calling feature is not eligible.
