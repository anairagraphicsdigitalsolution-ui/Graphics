# Anaira AI Growth Engine v6.84.2 — WhatsApp Calling Permission Lifecycle

## Implemented

- Tenant-scoped `growth_whatsapp_call_permissions` records with RLS and role-aware policies.
- Workspace owner/manager API to request explicit WhatsApp Business Calling permission for a CRM lead.
- Request requires an active WhatsApp tenant connection, a matching WhatsApp conversation, a valid international phone number, no contact opt-out and an open 24-hour customer-service window.
- Request throttling enforces at most one request per rolling 24 hours and two requests per rolling seven days for each lead.
- Meta interactive `call_permission_request` message is sent through the connected Cloud API number.
- Incoming `call_permission_reply` webhook events are parsed and recorded as granted, rejected or revoked; temporary permission defaults to seven days when the provider omits an expiry timestamp.
- Growth Intelligence includes a permission-request action. It explicitly reports that no voice call was placed.
- Readiness now separates the implemented permission workflow from the still-unconfigured WebRTC/SIP media and SDP calling engine.

## Still not complete / external dependencies

- Actual WhatsApp voice media is not implemented in this release. A WebRTC/SIP media provider, SDP offer/answer handling, call connect/status/terminate lifecycle and Meta Calling enablement are still required.
- The interactive permission request is only sent inside the 24-hour customer-service window. Approved call-permission templates outside that window need a template manager integration.
- Phase 24 public prospect discovery/enrichment is still not implemented; prospect entry remains manual.
- Phase 30 remains a readiness checklist, not production certification.

## Database migration

Apply `supabase/migrations/20261111170000_growth_whatsapp_call_permissions.sql` after the existing Phase 29 migration.

## Verification

- TypeScript/TSX transpile syntax: 141 files, 0 syntax errors.
- Full `npm run verify:all`: passed, including the new 5/5 call-permission checks.
- Growth Operations checks: 6/6 passed.
- WhatsApp call permission lifecycle checks: 5/5 passed.
- ZIP integrity: verified after packaging.
- Live Meta call permission and voice tests: not run; require the user's eligible Meta WhatsApp Business number and live webhook configuration.
