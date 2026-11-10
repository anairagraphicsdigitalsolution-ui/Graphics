# ANAIRA AI Growth Engine v6.76.0 — SaaS Foundation Release

## Scope
This release continues from v6.75.11 and is limited to the AI Growth Engine. Public portfolio pages, the portfolio CMS and general website settings were not intentionally changed.

## Implemented in source
- Independent App Router URLs for Overview, CRM, Marketing, Tasks, Campaigns, AI Employee, Automation, Channels, Analytics, Team and Platform Admin.
- Shared workspace selection is retained between Growth module routes in browser local storage.
- Navigation links now render as route links and have desktop/mobile styling.
- Team invitation lifecycle API: list members/invitations, invite by email through Supabase Admin, accept invitation against the exact invited user/email, change member roles, remove non-owner members, revoke invitations and expire stale invitations.
- Organization owner cannot be removed or demoted through the team API. Only the owner can assign the manager role or change/remove members.
- Platform tenant directory and active/suspended lifecycle, gated by `is_anaira_admin()`.
- Service-role-only invitation and platform audit tables; invitation, role, removal, acceptance and tenant-status events are recorded.
- Shared Growth authorization helper denies ordinary tenant members access when the tenant is not active. Platform admins retain administrative access.

## New migration
`supabase/migrations/20261109260000_growth_team_invitations_v676.sql`

Apply this migration to the exact Anaira Supabase project before using Team & Permissions or Platform Admin audit events.

## Required environment
- `SUPABASE_SERVICE_ROLE_KEY` must be set server-side only.
- `NEXT_PUBLIC_SITE_URL` must be set to the exact deployed origin, e.g. `https://graphics.anairapos.in`.
- Supabase Auth email delivery and redirect allow-list must be configured for `/admin/ai-growth/team`.
- Do not expose the service-role key in `NEXT_PUBLIC_*` variables or browser code.

## Verification completed
- 106 TypeScript/TSX files passed TypeScript transpile syntax checks with 0 syntax errors.
- `npm run verify:all` passed, including existing Growth worker, scheduler, recovery, security, release, tenant lead-routing and navigation checks plus new team/tenant static checks.
- Source contains 40 Growth API route files and 25 SQL migration files.

## Verification pending
- `npm install --no-audit --no-fund --fetch-retries=0` failed because DNS could not resolve `registry.npmjs.org` (`EAI_AGAIN`).
- Full `tsc --noEmit` and Next.js production build are not certified because dependencies are unavailable in this environment.
- Migration has not been applied to live Supabase. GitHub CI and Vercel deployment were not run.

## Known incomplete / not certified
- WhatsApp still uses deployment-global credentials in inbound/outbound routes; tenant-specific WhatsApp credential onboarding and phone-number routing are not complete.
- Subscription checkout, payment reconciliation, plan entitlements and hard usage quotas are not implemented.
- Platform admin currently provides tenant listing and suspend/reactivate only; tenant deletion, plan controls, subscription management and complete support tooling are not implemented.
- Suspension enforcement was added to shared `requireGrowthRole`; routes that do not use this helper and background worker paths still require a dedicated audit.
- Workflow engine remains sequential (up to 12 steps); no parallel branches, versioning or full drag/drop canvas.
- Meta, WhatsApp, LinkedIn, YouTube and Resend provider E2E tests require real provider credentials and verified callback configuration. They were not run.
- Cross-tenant isolation tests with multiple real tenants and roles remain pending.

## Release verdict
A substantial SaaS foundation update, not a fully complete SaaS platform or production-certified AI Employee.
