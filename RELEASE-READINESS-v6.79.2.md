# Anaira AI Growth Engine v6.79.2 — Platform Admin Authorization Fix

## Changes
- Fixed platform-admin authorization for service-role API requests. The previous implementation called `is_anaira_admin()` through a service-role Supabase client; `auth.uid()` is null in that context, so legitimate platform administrators could receive HTTP 403.
- Platform and platform-billing APIs now check the authenticated user ID (resolved from the validated bearer token) against `public.admin_users`.
- Shared `requireGrowthRole` fallback uses the same explicit allow-list check.
- No database migration is required. The intended Anaira platform administrator must already exist in `public.admin_users`.
- Main portfolio pages and general Website Settings were not modified.

## Verification
- `npm run verify:all`: PASS.
- 120 TS/TSX files syntax-checked; 0 syntax errors.
- Billing checks: 15/15 PASS.
- Team/platform authorization checks: PASS.
- Workflow engine checks: 16/16 PASS.
- Full Next.js production build and live Vercel/API verification were not run in this environment.
