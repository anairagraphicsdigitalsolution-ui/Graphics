# Anaira AI Growth Engine v6.75.7 — Database hardening and scheduler readiness

## Live Supabase changes applied
Project: `nrsdqrqkffhbicfskilb` (Anaira Graphics & Digital Solution).

- Migration `20261109160834_growth_security_and_fk_index_hardening_v6757` applied successfully.
- Added 13 indexes for foreign-key columns identified by Supabase Performance Advisor.
- Revoked anonymous access to `public.is_anaira_admin()` while retaining authenticated execution needed by existing RLS policies.
- Revoked public, anon and authenticated execution of `public.rls_auto_enable()`; retained service-role execution.
- Verified 13 expected indexes are present through the live migration and catalog.
- Verified anon cannot execute either helper; authenticated can execute only `is_anaira_admin()` as required by RLS.

## Worker scheduling options
- Default `vercel.json` remains once daily for Hobby compatibility. Hobby cron is not suitable for timed follow-ups.
- `vercel.pro.json` contains the one-minute schedule and is for Vercel Pro/Enterprise only. Copy it to `vercel.json` only after confirming the project plan supports per-minute cron.
- GitHub Actions fallback calls the protected worker every five minutes. Configure repository secrets `ANAIRA_GROWTH_SITE_URL` (for example `https://graphics.anairapos.in`) and `ANAIRA_GROWTH_CRON_SECRET` (must exactly match Vercel `CRON_SECRET`). Enable Actions for the repository. A manual workflow dispatch is available for testing.
- Worker endpoint remains protected by `Authorization: Bearer CRON_SECRET`. Do not expose the secret in browser code.

## Verification
- `npm run verify:syntax`: passed (90 TS/TSX files, 0 syntax errors).
- `npm run verify:growth-worker`: passed (all current static regression checks).
- `npm run verify:growth-scheduler`: passed (daily/Pro/external fallback and auth checks).
- Recovery verifier path was corrected to reference the actual v6.75.6 migration filename.
- Full `npm run verify:all` and production build must be rerun after this correction.
- `npm install` was attempted but did not complete within the available execution window; no successful production build is claimed.

## Remaining production sign-off blockers
- Enable Supabase Auth leaked-password protection in Auth settings (Dashboard setting; not changed by SQL).
- Confirm the GitHub Actions repository secrets and a successful scheduled/manual worker invocation.
- Complete full `npm install`, lockfile generation, `npm run build`, and TypeScript checks in the deployment environment.
- Verify actual Meta/WhatsApp/Instagram/Messenger/LinkedIn/YouTube/Resend credentials, webhook delivery, OAuth refresh and provider publishing against connected business accounts.
- Perform tenant isolation and full customer-to-lead-to-consented-follow-up-to-approved-publish E2E tests.

This release improves database hardening and operational readiness. It does not claim provider integrations or production deployment are certified.
