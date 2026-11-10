# Release readiness — v6.79.9

## Verified
- `npm run verify:all`: PASS.
- Workflow engine regression: 17/17 PASS, including nested ALL/ANY condition validation/evaluation.
- CRM attachments: 8/8 PASS.
- Cashfree regression: 11/11 PASS.
- Billing regression: 15/15 PASS.
- Multi-number WhatsApp regression: 14/14 PASS.
- Supabase live migration `growth_engine_fk_index_hardening_v6798`: applied successfully.
- Live SQL verification confirmed all four FK indexes exist.

## Supabase project
- Anaira Graphics & Digital Solution (`nrsdqrqkffhbicfskilb`), region `ap-northeast-1`.

## Remaining external certification
- Supabase Auth leaked-password protection is still disabled; enable it in Authentication > Settings.
- `public.is_anaira_admin()` SECURITY DEFINER helper remains callable by authenticated users because tenant/platform RLS policies depend on it. Replace dependent policy/helper design before revoking execution.
- 14 RLS-enabled/no-policy advisor INFO findings are service-role-only tables; do not add broad client policies.
- Performance Advisor reports unused indexes and two multiple-permissive-policy warnings on existing portfolio tables (`projects`, `site_settings`); these portfolio policies were not modified.
- `npm install --package-lock-only` could not complete in this environment; no lockfile was generated.
- Next.js production build, live provider E2E, Cashfree settlement/refund, Vercel deployment and cross-tenant penetration tests remain unverified.

This release is not represented as 100% production-certified.
