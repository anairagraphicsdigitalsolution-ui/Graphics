# Anaira AI Growth Engine — Release Notes v6.90.3

## Native WhatsApp Business Calling — outbound foundation
- Added a tenant-scoped call-session table with RLS, audit metadata, and a partial unique index preventing multiple active calls per lead.
- Added a protected Meta Graph `/{PHONE_NUMBER_ID}/calls` signaling route for outbound `connect` and `terminate`.
- Outbound initiation requires a current, matching customer-granted call permission, contact consent, non-opted-out lead, owner/manager role, and WhatsApp feature entitlement.
- Added browser WebRTC microphone capture, SDP offer/answer exchange, remote audio playback, call status and end-call controls.
- Added Meta calling webhook lifecycle updates for connected/terminated/rejected outbound sessions.
- Added navigation entry under WhatsApp Calling.
- Fixed the call-permission endpoint's tenant credential lookup to pass the organization ID separately from the optional phone-number ID.

## Explicit limitations
- Inbound WhatsApp call answering is not implemented.
- Production TURN configuration, network/media soak tests, Meta app review, calling-number eligibility and live call certification remain deployment gates.
- A public STUN server is only a development baseline; configure an organization-approved TURN service for production.
- WhatsApp Calling API signaling does not replace Meta's eligibility, consent, account configuration or platform policy requirements.

## Verification
- Added `verify:growth-whatsapp-native-calling` covering consent, tenant gates, SDP, lifecycle, RLS and UI wiring.
- Full build and real provider E2E must still be run in an environment with the exact dependency lockfile and eligible Meta credentials.
