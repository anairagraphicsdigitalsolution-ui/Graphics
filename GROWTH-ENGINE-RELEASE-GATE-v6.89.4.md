# Release Gate v6.89.4

## Source changes
- CRM follow-up dates now create/update an internal follow-up reminder task; clearing a date or moving the deal to Won/Lost cancels active internal reminders.
- Added meeting scheduling and meeting lifecycle endpoints with tenant membership checks, lead ownership checks, time validation and CRM activity records.
- Added proposal/quotation drafts with server-side line-item/tax/discount calculations, approval states and enforced status transitions. Marking a proposal as sent is blocked until an actual delivery integration confirms a send.
- CRM Customer 360 includes meeting and proposal tools.

## Database
- Migration: `20261113160000_growth_meetings_proposals_v6894.sql`.
- `growth_meetings` and `growth_proposals` enable RLS and revoke direct anon/authenticated table access. Application APIs use the server service role only after validating the bearer-token user and tenant membership.

## Verification boundary
- Run `npm run verify:all` and the dedicated CRM sales execution checks.
- Next.js production build remains unverified when dependency installation is unavailable.
- Calendar invites, proposal delivery, WhatsApp/email/voice provider sends, live provider permissions, tenant-isolation penetration tests and production deployment certification require actual external credentials and deployment access.
