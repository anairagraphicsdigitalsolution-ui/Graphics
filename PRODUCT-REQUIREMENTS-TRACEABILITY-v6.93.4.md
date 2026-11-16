# Anaira AI Growth Engine — Product Requirements Traceability v6.93.4

This document distinguishes source presence, configuration presence, and production verification. A configured integration is not considered live-certified until a real, consented provider transaction and its webhook/status lifecycle have passed.

| # | Module | Current source-level assessment | Remaining acceptance evidence |
|---|---|---|---|
| 01 | AI Command Center | Partial | Live tenant metrics reconciliation; daily briefing delivery; browser command-to-outcome E2E |
| 02 | Lead Intelligence | Source workflows present | Discovery source coverage; independently verified contact details; scoring quality evaluation |
| 03 | CRM & Sales | Broad source workflows present | Lead-to-deal browser journey; customer communication; export/deletion; tenant isolation |
| 04 | AI Sales Agents | Partial | Inbound WhatsApp call answering; production TURN/media; Meta eligibility; consented live call; human handoff |
| 05 | AI Content Studio | Partial | Provider generation; asset lifecycle; approval; publication; performance feedback |
| 06 | Social Media | Partial | OAuth scope validation; live publish; inbox/comments; analytics; token refresh |
| 07 | Campaign Manager | Partial | Live Ads provider tests; spend/revenue reconciliation; experiments; approval/rollback |
| 08 | SEO Intelligence | Partial | Search Console/GA4 OAuth; crawl acceptance; keyword/rank data validation |
| 09 | Website Intelligence | Source workflows present | DNS/domain ownership proof; real-site crawl; browser E2E |
| 10 | WhatsApp & Email Center | Partial | WABA send/receive/template/webhook lifecycle; verified email sender; bounce/complaint tests |
| 11 | Marketing Automation | Source workflows present | Production scheduler cadence; concurrency; retries; DLQ replay; outage recovery |
| 12 | Analytics & Reports | Partial | Reconciled provider spend, attribution, revenue and currency totals |
| 13 | Customer Retention | Internal task planner present | Consent-aware communication journeys; delivery outcomes; opt-out and suppression E2E |
| 14 | AI Knowledge Hub | Partial | Full document ingestion/indexing; grounded citations; retrieval evaluation; tenant leakage tests |
| 15 | Integrations & Settings | Partial | Provider OAuth/token lifecycle; webhook health; secret rotation; connection diagnostics |

## Platform release gates

### P0 — required before production
- Identify and confirm a dedicated Growth Engine Supabase project.
- Review all 74 migrations in order; apply only to the confirmed project; verify schema, RLS, storage policies, function grants and migration history.
- Produce a reproducible dependency lockfile and clean install; pass the production build.
- Verify two-tenant isolation for API, database, storage, jobs, AI context, integrations and exports.
- Run live provider certification for every enabled channel.
- Confirm approvals, consent, suppression, quiet hours, opt-out and audit records at execution time.

### P1 — required for reliable operations
- Exercise worker concurrency, duplicate claims, stale jobs, provider timeouts, webhook replay and DLQ recovery.
- Test backup/restore and disaster recovery.
- Add production monitoring, alerting, runbooks and incident response.
- Reconcile plan entitlements, usage metering, billing, refunds and suspended-tenant behavior.
- Complete full browser E2E for all 15 modules.

### Explicit limitations
- WhatsApp native Calling source contains outbound browser WebRTC signaling and permission-gated session initiation. Inbound answering, production TURN/media reliability, Meta number eligibility and live Meta call certification are not complete.
- Twilio outbound voice is a separate provider path and is not native WhatsApp Calling.
- Customer Retention currently supports internal relationship/renewal/feedback/review tasks; it is not a fully certified automated customer messaging lifecycle.
- Analytics correctly withholds CPL/CAC/ROAS where spend/revenue inputs are not reconciled.
- External-effect reconciliation reduces blind retries but does not provide a universal exactly-once guarantee.

## Verification semantics
- `configured`: required configuration/connection presence was detected.
- `not_live_verified`: a live provider transaction has not been certified by this readiness check.
- `not_run`: browser E2E, tenant isolation, provider certification or build evidence has not been supplied.
- Overall certification remains `not_certified` until all release gates have independent evidence.
