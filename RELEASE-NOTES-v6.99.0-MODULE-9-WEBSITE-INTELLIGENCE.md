# Release Notes — v6.99.0 — Module 9 Website Intelligence

## Delivered

- Visitor analytics and first-party tracking API with domain-bound, rotatable site keys.
- Consent-gated page views, visitor/session identifiers, form starts/submits, chat opens and conversion events.
- UTM and Google click-id attribution persisted on website form leads.
- Website enquiry capture into tenant CRM, with separate analytics, contact and ad-measurement consent.
- Idempotent form submissions and rate-limited public ingestion endpoints.
- 30-day dashboard for visitors, sessions, page views, form funnel, top landing pages and traffic sources.
- Homepage SEO audit change detection versus the previous audit.

## Database

Applied live to Anaira Growth Supabase:
- `growth_website_intelligence_v6990`
- `growth_website_form_idempotency_v6990a`

RLS enabled on all three Module 9 tables; anonymous direct access revoked. Live catalog confirmed one tenant-aware policy per table.

## Verification and release limits

- Module 9 verifier: 36 PASS, 0 FAIL.
- Full regression: 1,345 PASS, 0 FAIL.
- Syntax: 224 TS/TSX files, 0 syntax errors.
- Build: not run successfully; `next` binary is not installed in this workspace.
- Live browser E2E, consent-manager integration and external verified-domain form submission remain pending. Do not label this module production-certified until those checks pass.
