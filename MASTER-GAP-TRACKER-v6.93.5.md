# Anaira AI Growth Engine — Master Gap Tracker v6.93.5

This tracker is the execution baseline for closing the v6.93.3 audit. It deliberately separates source changes from external acceptance evidence. Never mark an external gate complete based only on a source assertion.

## Release blockers

| ID | Priority | Workstream | Source location / target | Acceptance evidence | Status |
|---|---|---|---|---|---|
| DB-01 | P0 | Confirm dedicated Growth Engine Supabase project | Supabase project settings / deployment environment | Project ref explicitly confirmed by owner; not the CRM project by assumption | BLOCKED: owner confirmation required |
| DB-02 | P0 | Review and apply 74 ordered migrations | `supabase/migrations/` | `supabase migration list` shows all expected versions applied; schema/RLS checks pass | NOT RUN: no DB connection |
| DB-03 | P0 | RLS and function grants | All migration SQL and live DB catalog | Tenant A/B adversarial SQL/API tests; SECURITY DEFINER search_path and grants verified | NOT RUN |
| BUILD-01 | P0 | Reproducible dependency installation | `package.json`, `package-lock.json` | Clean `npm ci` succeeds in clean environment | BLOCKED: lockfile absent and registry install timed out |
| BUILD-02 | P0 | Production build | Next.js application | `npm run build` succeeds with production env placeholders and no type/prerender errors | BLOCKED: Next.js not installed |
| SEC-01 | P0 | Tenant isolation | Growth APIs, storage, jobs, AI context | Two authenticated tenants cannot read/write each other's data or credentials | NOT RUN |
| SEC-02 | P0 | Role/entitlement enforcement | All `app/api/growth/**/route.ts` | Owner/manager/editor/viewer/client matrix tested per route | PARTIAL: source checks only |
| GOV-01 | P0 | Approval and consent at dispatch | Worker and outbound APIs | Every outbound action rechecks permission, channel consent, suppression, quiet hours and audit | PARTIAL |
| INT-01 | P0 | Meta/WhatsApp live certification | `app/api/growth/meta/**`, `app/api/growth/whatsapp/**` | OAuth, send/receive, webhook, template, token refresh and delivery lifecycle | NOT RUN |
| INT-02 | P0 | Email live certification | `app/api/growth/email/**`, worker | Verified sender, consent, unsubscribe, bounce/complaint webhook and delivery lifecycle | NOT RUN |
| INT-03 | P1 | Google Ads/Search Console/GA4 | Google integration routes | OAuth, account scope, reporting, spend reconciliation and token refresh | NOT RUN |
| INT-04 | P1 | LinkedIn/YouTube publishing | Social integration routes | OAuth scopes, publish, comments/inbox and analytics E2E | NOT RUN |
| REL-01 | P1 | Worker concurrency/recovery | `app/api/growth/worker/route.ts`, claim RPC migrations | Concurrent workers, duplicate claim, stale job, provider timeout, ambiguous outcome and DLQ replay drills | PARTIAL |
| REL-02 | P1 | Scheduler recovery | `app/api/growth/worker/route.ts`, autonomous schedule runner | Cron cadence, missed-run catchup, duplicate schedule and suspended tenant tests | NOT RUN |
| OPS-01 | P1 | Backup/restore | Supabase operations | Restore into isolated project and verify row counts, storage and RLS | NOT RUN |
| OPS-02 | P1 | Monitoring/incident response | Vercel/Supabase | Alerts, dashboards, runbooks and incident exercise | NOT RUN |
| BILL-01 | P1 | Subscription/payment lifecycle | Billing routes and provider webhooks | Paid, failed, partial, refund, cancellation, dispute and suspended-tenant E2E | PARTIAL |
| BILL-02 | P1 | Usage/invoice reconciliation | Usage ledger and billing | Metered usage equals provider usage and invoice line items | PARTIAL |

## Module acceptance backlog

1. **AI Command Center** — reconcile dashboard KPIs to source tables; run browser test for briefing, recommendation approval and action result.
2. **Lead Intelligence** — test source coverage, dedupe, website verification, independent contact verification and scoring precision/recall.
3. **CRM & Sales** — test prospect conversion through lead, opportunity, proposal, customer response, won/lost, export and deletion.
4. **AI Sales Agents** — finish inbound WhatsApp Calling, TURN/media, provider eligibility, live consented call, handoff and transcript retention.
5. **AI Content Studio** — live generation, assets, revisions, approval, schedule, publish and analytics loop.
6. **Social Media** — provider OAuth, account selection, publishing, inbox/comments, metrics and token rotation.
7. **Campaign Manager** — live Ads lifecycle, spend reconciliation, experiments, approval, auto-pause and rollback.
8. **SEO Intelligence** — Search Console/GA4 OAuth, crawl, keyword/rank inputs and report acceptance.
9. **Website Intelligence** — DNS/domain proof, crawler safety, crawl limits, content extraction and change detection.
10. **WhatsApp & Email Center** — inbound/outbound lifecycle, templates, unsubscribe, suppression, bounce/complaint and webhooks.
11. **Marketing Automation** — schedules, triggers, workflow versions, retries, concurrency and dead-letter recovery.
12. **Analytics & Reports** — reconciled channel spend, attribution, revenue, currency and incomplete-data labeling.
13. **Customer Retention** — channel-specific consent, retention journeys, approval, delivery status, opt-out and outcomes. Current task planner is not an automated messaging journey.
14. **AI Knowledge Hub** — document ingestion, extraction, indexing, citations, retrieval evaluation and tenant isolation.
15. **Integrations & Settings** — OAuth lifecycle, token rotation, webhook diagnostics, secret rotation and connection health.

## New v6.93.5 preflight

Run `npm run preflight:growth-production` before a release attempt. It reports migration count/order, lockfile and Next.js installation, source prerequisites, environment variable *names* (never values), and whether local environment files exist. It is read-only: it does not apply migrations, deploy, or call providers.

`npm run verify:all` includes the preflight verifier. The preflight intentionally exits with blockers when release prerequisites are missing. This is not a failure of the feature suite; it is a release gate.

## External inputs needed to close blocked gates

- Owner confirmation of the dedicated Growth Engine Supabase project reference.
- Provider app access/permissions and verified test accounts for Meta, WhatsApp, Google, LinkedIn/YouTube and email.
- Vercel project/deployment access for production build/deploy verification.
- Approved test contacts and consent evidence; never use real customers for uncontrolled tests.


## v6.93.7 completion update
- Added migration `20261115120000_growth_invoice_ledger_service_role_lockdown_v6937.sql`.
- `growth_manual_payments` and `growth_invoices` now explicitly revoke all access from PUBLIC/anon/authenticated and grant service_role only.
- Static migration audit now classifies service-role-only tables separately from tables requiring a policy/privilege review.
- Static scan: 75 migration files, 67 table declarations, no missing explicit RLS-enable statements, no remaining tables in the policy/privilege-review bucket. These are source findings, not remote database certification.
- Full `npm run verify:all` passes; production build remains blocked by missing installed Next.js dependencies.

## v6.93.8 workspace-context update
- Added active workspace switching to Growth Engine navigation.
- Membership query now resolves organization-specific roles and lists only active workspaces the user belongs to; platform admins can select active workspaces.
- Selected workspace persists via `anaira-growth-active-org`, shared with the dashboard.
- Added `verify:growth-workspace-context-v6938` (10 assertions).
- This is a navigation/context improvement only. API-level cross-tenant adversarial testing and entitlement verification remain open.

## v6.93.9 channel-specific consent update
- Added per-channel consent evidence for email, WhatsApp, SMS and voice.
- CRM manager UI can record/revoke channel consent with source evidence.
- Generic contact consent alone no longer authorizes provider dispatch.
- Worker and direct send paths now check channel-specific consent at execution time.
- Email one-click unsubscribe revokes email only; global opt-out clears all channels.
- Added migration `20261115140000_growth_channel_specific_consent_v6939.sql`.
- Source verifiers pass; migration is not applied remotely and provider E2E is not certified.

## v6.94.0 send-time communication policy update
- Added `growth_organizations.communication_policy` and `growth_leads.channel_suppressions` in migration `20261115160000_growth_send_policy_v6940.sql`.
- Added owner/manager API at `/api/growth/communication-policy` for quiet-hours enablement, start/end, IANA timezone, weekdays and channel enablement.
- Quiet-hours evaluator handles same-day, overnight and full-day windows. Default timezone is Asia/Kolkata; each workspace can configure its own IANA timezone.
- Worker defers queued email/WhatsApp jobs during quiet hours before writing `external_effect_started_at`.
- Worker send paths and direct email, WhatsApp free-form, approved-template and Twilio voice paths check channel suppression and workspace channel policy. Per-contact suppression overrides channel consent.
- Added `verify:growth-send-policy-v6940` (19 source assertions); full suite: 1,047 PASS / 0 FAIL; syntax scan: 201 TS/TSX files / 0 syntax errors; static migration audit runs successfully.
- `npm run build` remains blocked (`next: not found`); production preflight remains blocked by absent `package-lock.json`, Next.js installation and local production environment. Remote migration and provider E2E are not run.
- SMS dispatch remains unimplemented; this release adds its policy/suppression schema only. Retention messaging journeys, workflow journey policy at each action and complete UI for per-contact suppression remain open.

## v6.94.4 Knowledge Hub semantic retrieval update
- Added 1536-dimensional OpenAI `text-embedding-3-small` embeddings for newly uploaded document chunks, in bounded batches.
- Added tenant-scoped pgvector cosine similarity RPC and HNSW index in `20261115180000_growth_knowledge_semantic_retrieval_v6944.sql`.
- Knowledge search and grounded answer endpoints now prefer semantic retrieval and fall back to PostgreSQL full-text when vector retrieval is unavailable.
- Added embedding quota consumption and usage/cost logging; document embedding state is recorded.
- Aligned DB/storage file limit with the API's 10 MiB limit.
- Verification: 1,104 individual assertions PASS / 0 FAIL; syntax scan 206 files / 0 errors; migration static audit PASS.
- Remaining: existing-document embedding backfill, scanned PDF/image OCR, live vector extension/RPC test, remote migration, production build (Next.js missing), and full live 15-module certification.
