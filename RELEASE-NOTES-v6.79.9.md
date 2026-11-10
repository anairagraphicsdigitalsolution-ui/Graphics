# Anaira AI Growth Engine v6.79.9

## Supabase production database update

- Applied live migration `growth_engine_fk_index_hardening_v6798` to the Anaira Graphics & Digital Solution Supabase project (`nrsdqrqkffhbicfskilb`).
- Added four missing FK indexes identified by Supabase Performance Advisor:
  - `growth_lead_attachments(lead_id)`
  - `growth_payment_transactions(plan_id)`
  - `growth_workflow_run_events(run_id)`
  - `growth_workflow_versions(created_by)`
- Re-queried `pg_indexes`; all four indexes are present.
- Existing CRM attachment, Cashfree payment ledger and webhook ledger tables were confirmed present before migration; no duplicate table creation was required.
- Existing tenant and service-role data boundaries were not loosened.

## Remaining Supabase findings

- 14 RLS-enabled/no-policy INFO findings are service-role-only tables by design; authenticated/anon access remains denied. Review grants before changing any policy.
- `public.is_anaira_admin()` remains a SECURITY DEFINER helper executable by authenticated users because tenant/platform RLS policies depend on it. Do not revoke its execute grant without replacing those policies/helper safely.
- Leaked-password protection remains a Supabase Auth dashboard setting and needs enabling in Auth > Settings.
- Performance Advisor still reports unused indexes; these are not removed because a fresh/low-traffic database may not have exercised legitimate query paths.

## Release verification boundary

The live SQL migration and index verification passed. This does not certify external provider connections, production Next.js build, Vercel deployment, full RLS penetration tests, or Cashfree live payment settlement.
