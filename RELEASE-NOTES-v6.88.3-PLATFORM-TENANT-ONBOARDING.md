# Anaira AI Growth Engine v6.88.3 — Platform Tenant Onboarding

## Added
- Platform-admin-only tenant creation endpoint (`POST /api/growth/platform`).
- Workspace name, slug, plan, website URL and industry validation.
- Atomic PostgreSQL onboarding RPC creates the organization, assigns an existing authenticated owner account and writes a platform audit event in one transaction.
- Duplicate slug conflicts are returned as HTTP 409; migration-not-applied/database failures are reported without claiming creation succeeded.

## Apply before use
Apply `supabase/migrations/20261113090000_growth_platform_tenant_onboarding_v6883.sql` to the target Supabase project. Then call `POST /api/growth/platform` with an authenticated platform administrator and JSON fields `name`, `ownerUserId`, and optional `slug`, `plan`, `websiteUrl`, `industry`.

## Limitations
Owner must already have an authenticated Supabase account. Owner invitation/onboarding by email, UI form, plan subscription provisioning and live cross-tenant tests are not included in this milestone. No production build or live database migration was run in this environment.
