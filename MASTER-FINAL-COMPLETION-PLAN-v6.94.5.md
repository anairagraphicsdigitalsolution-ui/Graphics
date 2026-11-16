# Anaira AI Growth Engine — Final Completion Control Plan

**Baseline:** v6.94.4 source ZIP supplied in this work session.  
**Working version:** v6.94.5 (not packaged; final ZIP intentionally withheld until the consolidated release gate is satisfied).

## User delivery rule

Do not create or deliver another incremental ZIP. Continue on this same extracted source tree, close all source-level partials, run the full verification and build gates, update this audit, and produce one consolidated final ZIP only after the final release gate. Do not mark external provider/database certification complete without live evidence.

## v6.94.5 source change

- Added an owner/manager-only, tenant-scoped Knowledge Hub embedding backfill endpoint.
- Processes at most 64 unembedded passages per request using the existing workspace credential resolver, AI quota checks, provider usage logging and embedding validation.
- Uses compare-and-set updates so an existing vector is not overwritten.
- Recalculates per-document embedding status and returns the remaining count.
- Added a CRM/Knowledge Hub UI action and per-document embedding status display.
- Added 14 focused static regression assertions.

## Current verified source gates

- `npm run verify:all`: exit 0 after adding the v6.94.5 suite.
- `npm run verify:syntax`: 207 TS/TSX files, zero syntax errors.
- `npm run audit:growth-migrations`: exit 0; static source audit only.
- Focused re-index verifier: 14 PASS / 0 FAIL.

## Source-level gaps still to close

### P0 — Build and release engineering
- Reproducible dependency lockfile is absent.
- Dependency install was attempted but timed out; npm cache does not contain the required Next.js packages.
- `next build` remains blocked because Next.js is not installed.
- Strict TypeScript check, route compilation and production bundle analysis remain pending.
- Need a repeatable clean install/build in a network-enabled CI or project environment.

### P0 — Database and tenant security
- Confirm the dedicated Growth Engine Supabase project reference; do not assume the separate Anaira CRM project is the target.
- Apply all unapplied migrations in order, including v6.94.0–v6.94.5-related migrations.
- Verify extension availability (`vector`), actual function signatures/owners/grants, RLS, storage policies and indexes from the live catalog.
- Run two-tenant adversarial tests across APIs, documents, storage objects, integrations, jobs, analytics and exports.
- Verify data deletion/export, suspended tenants, role downgrade, workspace switching and platform-admin boundaries.

### P1 — Knowledge Hub
- OCR for scanned PDFs and image files is not implemented.
- Backfill endpoint now exists; it still requires live DB/provider validation and execution against existing documents.
- Evaluate retrieval quality, chunk overlap, multilingual documents, citation coverage, prompt injection, hallucination resistance and cross-tenant leakage.
- Verify pgvector extension, HNSW index and service-role-only RPC on the target database.

### P1 — AI Sales Agents and channels
- Inbound WhatsApp calling, production TURN/media reliability and Meta calling certification remain pending.
- Validate WhatsApp webhook signature/replay protection, template approval, message delivery, inbound replies, opt-out and human handoff against live WABA.
- Validate email sender/domain, bounce/complaint webhooks, suppression and retries against a real provider.
- SMS provider dispatch is not implemented; voice provider behavior requires live Twilio validation.

### P1 — Social and paid campaign execution
- Validate Meta OAuth scopes, Page/Instagram account eligibility, media upload, publishing, insights, ads lifecycle and rollback on a real test ad account.
- Validate LinkedIn and YouTube OAuth, token rotation, media publishing and analytics with live accounts.
- Validate Google Ads OAuth, customer access, campaign creation in paused state, approval/activation, GAQL reporting and offline conversion upload.
- Reconcile provider spend, attribution, won revenue and refunds before claiming ROAS/CAC accuracy.

### P1 — Automation and retention
- Test scheduler cadence, worker concurrency, lock contention, retry/backoff, DLQ replay, stale-job recovery and ambiguous provider outcomes under injected failures.
- Retention journey source currently creates internal follow-up tasks; actual customer messaging journeys need a complete consent-aware workflow and live provider E2E.
- Test quiet-hours boundaries across time zones and daylight-saving transitions, channel-specific consent, suppression and opt-out at final dispatch.

### P1 — Billing and SaaS operations
- Complete payment lifecycle tests: success, pending, failure, duplicate webhook, refund, cancellation, tax/invoice generation and reconciliation.
- Verify plan entitlements, quotas, overage behavior, suspended tenant restrictions and platform usage reports.
- Confirm webhook signature validation, idempotency and audit coverage for every payment provider.

### P2 — Product completeness and quality
- Run browser E2E across all 15 modules and role combinations.
- Validate responsive layouts, accessibility, empty/loading/error states, pagination and export flows.
- Validate backup/restore, data retention, incident logging, observability and operational runbooks.
- Confirm all settings forms and provider diagnostics surface actionable errors without leaking secrets.

## External prerequisites (not to be fabricated)

- Dedicated Growth Engine Supabase project reference and authorized migration target.
- Owner-provided API credentials and provider account approvals configured in the Integration UI / deployment environment.
- Network-enabled dependency install/build environment.
- Test Meta, Google Ads, LinkedIn, YouTube, WhatsApp, Resend and Twilio accounts where applicable.

## Final ZIP release gate

The single final ZIP is eligible only after:
1. All source-level gaps that can be completed without owner secrets are implemented.
2. Full automated verification passes with zero failures.
3. A clean dependency install, strict typecheck and production build pass in a supported environment.
4. Static migration/security audit passes and all migration SQL is included in order.
5. Live DB/provider/browser checks are either passed with evidence or explicitly labelled as external prerequisites; the product must not claim 100% live certification if these were not performed.
6. Release notes, exact version, migration instructions, environment template, audit matrix, test logs and ZIP checksum are included.

**Current release state: NOT READY. No ZIP generated for v6.94.5.**
