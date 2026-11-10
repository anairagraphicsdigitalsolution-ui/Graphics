# ANAIRA AI Growth Engine v6.77.0 — CRM, AI Employee Handoff, Billing & Usage

## Scope
Continues from v6.76.1. Changes are limited to the AI Growth Engine. Main portfolio pages and general Website Settings were not intentionally modified.

## Implemented in source

### CRM / Customer 360
- Replaced the CRM route's generic dashboard wrapper with a dedicated CRM workspace.
- Lead pipeline counts for New, Contacted, Qualified, Won and Lost.
- Search by name, email, phone and requirement; filters by status, temperature and source.
- Lead assignment to a verified workspace member.
- Follow-up date editing, lead score/temperature/status visibility, consent and opt-out context.
- Tenant-scoped activity timeline for notes, calls, emails, meetings and WhatsApp interactions.
- Automatic status-change activity records.
- CSV export of the currently filtered lead set.
- Possible duplicate indicators based on matching email or phone; this is a review hint, not automatic merge.

### Website AI Employee / human handoff
- Website chat now creates a stable per-widget visitor session ID.
- Public conversation reads and writes are bound to workspace slug, conversation ID and visitor session token.
- Website widget polls for new human replies while the chat is open.
- When an agent takes over, subsequent visitor messages are recorded without calling the AI model.
- Human inbox replies are written to the website conversation timeline and delivered to the open widget by polling.
- WhatsApp, Instagram and Facebook Messenger replies continue through their provider APIs.

### Billing / plan entitlements / usage metering
- Plan catalogue with INR/USD currency, monthly/yearly price in minor units, features and configurable metric limits.
- One current subscription record per organization, including status, period, trial and provider-reference fields.
- Atomic monthly usage counters and append-only usage events.
- Service-role-only `consume_growth_quota` RPC with row locking, quota checks, idempotency and inactive-subscription rejection.
- Plan and subscription administration in `/admin/ai-growth/platform/billing`.
- Workspace subscription and usage view at `/admin/ai-growth/billing`.
- Quota checks wired into website AI chat, website lead capture, AI content generation, media upload, direct WhatsApp sends, WhatsApp inbound AI/outbound replies, queued WhatsApp/email/social publishing and workflow-run starts.
- Existing tenants without an assigned subscription remain on legacy/unmetered behavior until the platform admin assigns a plan. Once a subscription exists, paused/past-due/cancelled/expired subscriptions fail closed.
- `-1` means unlimited. Missing metric keys are treated as unlimited until a limit is explicitly configured.

### Unified inbox
- Search and filter by channel and handoff/status.
- Website replies now support the human-handoff/polling path.

## Database migrations
Source contains 31 migration files total. Five new migrations were applied to the correct live project:
1. `growth_billing_usage_entitlements_v677`
2. `growth_quota_subscription_guard_v6771`
3. `growth_quota_idempotency_fix_v6772`
4. `growth_crm_activities_v6773`
5. `growth_crm_activity_fk_indexes_v6774`

The idempotency smoke test confirmed: first usage event increments once; an over-limit additional event is denied; retrying the same idempotency key returns duplicate/allowed without incrementing again. Test data was executed inside a transaction and rolled back.

## Verification
- 118 TypeScript/TSX files transpile with zero syntax errors.
- Full `npm run verify:all` passed, including existing worker, scheduler, stale-recovery, security, release, tenant-lead, navigation, team, WhatsApp, billing, CRM and website-human-handoff checks.
- Billing-specific static assertions: 14/14 passed.
- CRM-specific static assertions: 6/6 passed.
- Website human-handoff assertions: 6/6 passed.
- Source contains 44 Growth API route files and 31 SQL migration files.
- ZIP integrity check passed.

## Live Supabase verification
Project: `nrsdqrqkffhbicfskilb` — Anaira Graphics & Digital Solution, ACTIVE_HEALTHY, `ap-northeast-1`.
- All five new migration names appear in `supabase_migrations.schema_migrations`.
- RLS enabled on the new plan, subscription, usage and CRM activity tables.
- `anon` and `authenticated` have no SELECT grants on these service-role-only tables; `service_role` has SELECT access.
- `consume_growth_quota` execution is revoked from anon/authenticated and granted to service_role.
- Security Advisor reports RLS-enabled/no-policy informational findings for service-role-only tables (intentional), plus pre-existing `is_anaira_admin()` SECURITY DEFINER warning and leaked-password protection disabled.
- Performance Advisor no longer reports unindexed foreign keys for `growth_lead_activities`; existing unused-index and unrelated `projects`/`site_settings` multiple-permissive-policy notices remain.

Current live data after migration:
- 1 organization, 1 active organization
- 1 membership
- 0 leads, 0 websites
- 0 connected social accounts
- 0 connected WhatsApp accounts
- 0 billing plans, 0 subscriptions
- 0 CRM activity records

## Not complete / not certified
- No payment gateway checkout, invoice generation, payment webhook signature verification, settlement or reconciliation. Subscription assignment is platform-admin managed; provider IDs are only schema fields.
- Feature flags are stored on plans but fine-grained feature-by-feature enforcement is not yet applied to every route. Configured usage limits are enforced on the listed metered paths.
- Workflow engine remains bounded sequential steps/conditions; drag-and-drop graph canvas, parallel branches, versions and rollback are not complete.
- CRM duplicate handling is a UI hint; automatic merge and robust import/deduplication are not implemented.
- Email human replies are not part of the unified inbox send flow yet.
- Multiple WhatsApp numbers per tenant are not supported (one connected phone number per organization).
- Meta/WhatsApp/LinkedIn/YouTube/Resend live provider E2E is not certified; no client provider accounts are connected in the live database.
- Cross-tenant security/load certification is not complete.
- Full Next.js production build and Vercel deployment are not verified. Dependencies are not installed in this source workspace; previous npm registry access failed with DNS `EAI_AGAIN`.

## Release verdict
v6.77.0 adds a real CRM activity workspace, website human handoff and the first operational plan/usage metering layer. It is a significant SaaS foundation release, not a declaration of full payment-enabled or production-certified SaaS completion.
