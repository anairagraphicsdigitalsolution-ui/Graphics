# ANAIRA AI GROWTH ENGINE — v6.75.8

## Included
- Carries forward the v6.75.7 Growth Engine source and applied Supabase hardening migration.
- Adds a read-only production smoke-check command: `npm run smoke:growth-public`.
- Smoke checks cover the public homepage, worker unauthenticated rejection, WhatsApp verification challenge and Meta Lead Ads verification challenge.
- The smoke script does not send messages, publish content, execute the authenticated worker, or print secrets.

## Verified in this release
- ZIP integrity check passed.
- `npm run verify:all` passed: 90 TS/TSX files syntax-checked; worker/workflow, scheduler, stale-lock recovery and security migration regression assertions passed.
- Live Supabase recheck: three server-only Growth tables have RLS enabled, no anon/authenticated SELECT or INSERT grants, and service_role SELECT access.
- Live Supabase function privileges: `is_anaira_admin()` has no anon execution; authenticated execution remains for existing RLS policies. `rls_auto_enable()` is service_role-only.
- Live migrations include `20261109160539_growth_job_stale_lock_recovery_v6756` and `20261109160834_growth_security_and_fk_index_hardening_v6757`.

## Not certified yet
- Full Next.js production build and strict TypeScript build: dependency installation timed out, so `npm run build` was not run successfully.
- Vercel production deployment and public smoke tests: deployment could not be reached from this environment.
- GitHub Actions five-minute scheduler: workflow file exists, but repository secrets and a successful workflow run have not been verified.
- Live provider E2E for Meta, WhatsApp, Instagram/Messenger, LinkedIn, YouTube and Resend.
- Supabase Auth leaked-password protection remains a Dashboard setting to enable.
- Tenant isolation and end-to-end customer journey certification.

## Required before declaring Production Ready
1. Deploy this package to the intended Vercel project and verify the deployed commit.
2. Configure all provider and server-only environment variables in Vercel Production; never expose service-role/provider secrets to the browser.
3. Configure GitHub repository secrets `ANAIRA_GROWTH_SITE_URL` and `ANAIRA_GROWTH_CRON_SECRET`, enable Actions, and confirm a successful scheduled/manual run.
4. Run `npm run smoke:growth-public` against the production origin.
5. Perform provider-authorized inbound/outbound tests and verify CRM persistence, consent checks, human handoff, approval gates, retries and delivery outcomes.
6. Enable leaked-password protection in Supabase Auth settings.

**Release status: hardened implementation + static regression checks passed; production certification remains conditional on deployment, dependency build, scheduler activation and provider E2E.**
