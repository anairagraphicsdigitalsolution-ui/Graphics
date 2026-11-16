# Anaira AI Growth Engine v6.94.0 — Send-time Communication Policy

## Implemented in source
- Tenant-level communication policy stored on `growth_organizations.communication_policy`.
- Owner/manager API to read and update quiet hours, IANA timezone, weekdays and per-channel enablement.
- Quiet hours support same-day, overnight and all-day windows; default timezone is Asia/Kolkata, but tenant-configurable.
- Per-contact channel suppression flags for email, WhatsApp, SMS and voice. Suppression overrides consent.
- Worker defers queued email/WhatsApp jobs during quiet hours before the external-effect marker is written.
- Worker send functions and direct email, WhatsApp, approved-template and Twilio voice initiation paths re-check channel suppression and workspace channel policy.

## API
- `GET /api/growth/communication-policy?organizationId=<uuid>`
- `PUT /api/growth/communication-policy` with `{ "organizationId": "...", "policy": { "quiet_hours": { "enabled": true, "start": "21:00", "end": "08:00", "timezone": "Asia/Kolkata", "days": [0,1,2,3,4,5,6] }, "channel_enabled": { "email": true, "whatsapp": true, "sms": false, "voice": false } } }`

## Migration
Apply `supabase/migrations/20261115160000_growth_send_policy_v6940.sql` to the dedicated Growth Engine Supabase project before using the policy API or updated send routes.

## Boundaries
- This release does not add an SMS provider sender or a UI to manage individual suppression flags; it establishes schema and send-time enforcement for the existing email/WhatsApp/voice paths.
- Workflow-run enqueueing may still create a queued message during quiet hours; the worker defers the external send at execution time.
- Scheduled social publishing is not subject to customer communication quiet hours.
- Source/static checks do not prove remote migration application, live provider behavior, full browser E2E or production deployment.
