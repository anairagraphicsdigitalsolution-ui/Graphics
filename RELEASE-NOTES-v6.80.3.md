# Anaira AI Growth Engine v6.80.3

## Email unsubscribe lifecycle implementation

- Added signed, expiring unsubscribe tokens using HMAC-SHA256.
- Added tenant-scoped unsubscribe endpoint at `/api/growth/email/unsubscribe`.
- GET displays a confirmation page and does not unsubscribe when link scanners prefetch the URL.
- POST supports JSON and RFC 8058 one-click form submissions; token is read from the signed URL.
- Successful opt-out revokes `consent_to_contact`, records opt-out timestamp/source and adds a CRM timeline event.
- Resend worker sends a visible unsubscribe link and `List-Unsubscribe` / `List-Unsubscribe-Post` headers.
- Existing bounce, complaint and consent suppression remains active.
- Added 9 regression checks and included them in `npm run verify:all`.

## Configuration
Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS application origin. Set a dedicated random `GROWTH_UNSUBSCRIBE_SECRET` (recommended); if absent, the service-role key is used as a signing-key fallback. See `EMAIL-UNSUBSCRIBE-SETUP-v6.80.3.md`.

## Verification
- `npm run verify:all`: PASS.
- Syntax scan: 131 TS/TSX files, 0 syntax errors.
- New unsubscribe checks: 9/9 PASS.
- Workflow engine: 17/17 PASS.
- WhatsApp multi-number: 14/14 PASS.
- Cashfree: 11/11 PASS.
- CRM reports: 7/7 PASS.
- Inbound email lifecycle: 10/10 PASS.
- `npm run build`: BLOCKED — `sh: 1: next: Permission denied`.

## Remaining certification
This release does not complete the entire SaaS roadmap. Parallel workflow graph execution, graph joins/loops, tenant lifecycle and feature entitlement enforcement, recurring billing/refunds/GST reconciliation, advanced attribution, full provider E2E and production build/deployment certification remain open. No new Supabase migration was required for this change.
