# ANAIRA AI GROWTH ENGINE v6.75.9 — Release Readiness

## Included in this release

- Carries forward the v6.75.8 AI Growth source, scheduler configuration, database hardening migration and public production smoke-test script.
- Adds `.github/workflows/anaira-growth-ci.yml` to run dependency installation, the full static/regression suite and `next build` on pushes and pull requests to `main`/`master`, plus manual dispatch.
- CI uses build-only public Supabase placeholders. It does not receive production service-role keys, provider tokens or other production secrets.
- Adds `verify:growth-release` and includes it in `verify:all`.

## Verification in the packaging environment

- `npm run verify:all`: PASS (syntax, worker regression, scheduler, recovery, database security and release workflow checks).
- ZIP integrity: must be checked after packaging.
- `npm install`: attempted but timed out in the packaging environment; no lockfile or `node_modules` was generated.
- `npm run build`: NOT RUN successfully; dependency installation did not complete.
- Live website/webhook checks: NOT VERIFIED. The packaging environment could not resolve the production domain.
- Provider send/publish E2E: NOT VERIFIED. Requires the owner's Meta, WhatsApp, LinkedIn, Google and Resend accounts and approved credentials.

## Activation requirements

1. Push this source to the GitHub repository connected to the Vercel project.
2. Confirm the `Anaira AI Growth CI` workflow passes. Fix any real build/type errors it reports before production deployment.
3. Configure GitHub Actions repository secrets `ANAIRA_GROWTH_SITE_URL` and `ANAIRA_GROWTH_CRON_SECRET` for the existing five-minute worker workflow. The latter must exactly match Vercel `CRON_SECRET`.
4. Configure provider credentials only in Vercel environment variables; never commit them or put them in CI build variables.
5. Run `npm run smoke:growth-public` against the deployed HTTPS origin, supplying the webhook verification tokens as environment variables in a secure local/CI environment.
6. Complete provider-specific OAuth, inbound webhook, reply, consent/opt-out, approved publishing, token refresh and delivery-status tests.
7. Enable Supabase leaked-password protection in Auth password security settings.

## Certification boundary

This release adds a repeatable CI build gate but does not prove that the gate has passed on GitHub. The product must not be called fully autonomous or production-certified until the deployed build, worker schedule and real provider end-to-end flows have passed.
