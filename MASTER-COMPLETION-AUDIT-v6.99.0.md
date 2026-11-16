# Master Completion Audit — Anaira AI Growth Engine v6.99.0

## Module 9 — Website Intelligence

### Baseline and objective

The earlier Website Intelligence foundation primarily scanned the homepage for technical SEO/health. The Module 9 scope expands it to first-party visitor analytics, landing-page and form funnel measurement, website-to-CRM capture, campaign attribution and chat engagement events.

### Implemented in this release

| Capability | Status | Evidence |
|---|---|---|
| Per-website tracking key issue, rotation and revocation | Complete in source | Owner/manager-only API; random 256-bit key; SHA-256 hash at rest; plaintext shown once |
| Domain ownership enforcement | Complete in source | Tracking key cannot be issued until the existing DNS verification state is `verified`; public endpoints re-check origin |
| First-party visitor/session tracking | Complete in source | Public tracker; persistent pseudonymous visitor ID and per-tab session ID |
| Consent-gated page/form/chat/conversion events | Complete in source | Tracker sends analytics events only after `setConsent(true)` |
| UTM and click-ID attribution | Complete in source | UTM fields and gclid/gbraid/wbraid stored on website form leads and event snapshots |
| Website enquiry forms to CRM | Complete in source | Tenant/site-scoped lead creation; explicit contact-consent field |
| Duplicate form protection | Complete in source | Site-scoped submission ID unique index and claim-before-lead flow |
| Follow-up automation consent guard | Complete in source | `runLeadCreatedRules` is invoked only when contact consent is checked |
| Visitor, session, landing-page, source and form funnel dashboard | Complete in source | 30-day aggregate dashboard; no seeded/sample data |
| Website chat-open event | Integrated for Anaira chat | Existing AI sales chat calls the consent-gated tracker when opened |
| Homepage scan change detection | Complete in source | Latest report compares current checks and score to previous saved audit |

### Explicitly partial / not included

- Form abandonment is an estimate based on consented `form_start` and `form_submit` events. It is not session replay or a fully normalized form-step funnel. Visitors who decline analytics consent are not counted in behavioural event metrics; their CRM form records are counted separately.
- The module provides a tracking embed for existing landing pages and forms. It does not add a new visual landing-page builder.
- Other chat vendors must call `window.anairaGrowth.track('chat_open')`; only the existing Anaira AI sales chat is wired directly.
- Homepage technical scanning remains a homepage scan. Full-site crawling, deep crawl scheduling, competitor analysis and page-content auto-editing are not certified by this release.

### Live Supabase changes

Applied to the connected project `nrsdqrqkffhbicfskilb`:

1. `20261116044413` — `growth_website_intelligence_v6990`
2. `20261116044552` — `growth_website_form_idempotency_v6990a`

Live database checks confirmed:
- `growth_website_tracking_keys`, `growth_website_events` and `growth_website_form_submissions` exist.
- RLS is enabled on all three tables and each has a tenant-aware policy.
- Anonymous direct table grants are absent. Authenticated access is SELECT-only and constrained by RLS; server-side service role performs validated writes.
- Form submission idempotency index exists.

### Verification

- Module 9 assertions: 35 PASS, 0 FAIL.
- Full regression: 1,344 PASS, 0 FAIL.
- Syntax: 224 TS/TSX files, 0 syntax errors.
- Static migration audit: no missing RLS enablement, no tables flagged for policy/privilege review, no duplicate migration timestamps.

### Release blockers / production certification

- `npm run build` could not execute because the working environment has no installed Next.js binary (`next: not found`).
- No live browser E2E was run against a verified external website.
- Two-tenant isolation, actual consent-manager integration, public form delivery, chat event collection and deployed CSP/CORS configuration require runtime certification.
- No production tracking key has been issued; no visitor or customer data was seeded or fabricated.

**Release decision:** Module 9 source and database foundation are implemented and statically verified. Production certification remains pending until dependency installation/build, browser E2E, consent and tenant-isolation tests pass.
