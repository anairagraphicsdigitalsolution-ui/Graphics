# ANAIRA AI Growth Engine v6.77.1 — Email Inbox Reply Extension

## Baseline
Continues from v6.77.0. This release is scoped to AI Growth Engine only. Main portfolio pages and general Website Settings are not intentionally changed.

## New in v6.77.1
- Unified inbox now exposes Email as a channel filter.
- Human inbox replies support existing `email` conversations through Resend.
- Recipient is validated as an email address before sending.
- Sending requires a matching lead in the same organization with explicit `consent_to_contact=true`.
- Resend credentials are read only from server environment (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`).
- Provider rejection is handled before the conversation history is marked as delivered. Provider message ID is retained in the human message record.
- Added `verify:growth-email-inbox` and included it in `verify:all`.

## Verification
- TypeScript/TSX syntax: 118 files, 0 syntax errors.
- Full `npm run verify:all`: PASS.
- Email inbox checks: 6/6 PASS.
- Prior v6.77.0 checks remain passing: worker, scheduler, recovery, security, release, tenant lead routing, navigation, team, tenant WhatsApp, billing (14/14), CRM (6/6), website handoff (6/6).
- ZIP integrity verified after packaging.

## Remaining / not certified
- Inbound email receiving webhook and automatic creation of email conversations are not implemented; this release supports replies only when an email conversation already exists.
- Payment checkout, invoice generation, payment webhooks and reconciliation are not implemented. Payment provider selection/credentials are required.
- Workflow engine remains sequential; visual graph canvas, parallel branches, versioning and rollback are not complete.
- WhatsApp currently supports one phone number per organization. Multi-number tenant routing is not implemented.
- Social and messaging provider live E2E tests require the customer's Meta/LinkedIn/Google/Resend accounts and approved scopes.
- Full Next.js production build and Vercel deployment are not verified because dependencies are not installed in this workspace and prior npm registry access failed with DNS `EAI_AGAIN`.
- Cross-tenant security/load certification is still required.
- Supabase manual settings still require leaked-password protection to be enabled; the pre-existing `is_anaira_admin()` SECURITY DEFINER Advisor warning remains to be reviewed.

## Release verdict
v6.77.1 adds consent-gated outbound human email replies to the unified inbox and passes the source regression suite. It is not a full SaaS or production certification release.
