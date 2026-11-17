# Anaira AI Growth Engine — Production audit update
**Date:** 2026-11-17  
**Release:** v6.124.6  
**Supabase project:** `nrsdqrqkffhbicfskilb`  
**Vercel project:** `anaira-graphics-portfolio`  
**Production domain:** `https://graphics.anairapos.in`

## Completed against production

### Supabase migrations
The following migrations are present in remote migration history and were applied successfully:
- `20261117034519_growth_command_action_governance_v62200`
- `20261117034528_growth_sms_quota_support_v61246`
- `20261117034628_growth_command_action_feedback_v62000`
- `20261117034631_growth_command_action_alerts_v62400`
- `20261117034633_growth_command_center_scheduler_v62500`
- `20261117034807_growth_rls_initplan_performance_hardening`
- `20261117034818_growth_seo_tasks_rls_initplan_hardening`
- `20261117034842_growth_prospects_duplicate_index_cleanup`
- `20261117035933_growth_fk_indexes_and_rls_policy_overlap_cleanup`

### Performance and RLS cleanup
- Added 58 targeted indexes covering the 58 foreign keys identified by the Supabase performance advisor. The affected relations were checked first; they were empty or very small (largest observed relation under 120 KB).
- Supabase performance advisor now reports **0 unindexed foreign keys**.
- Reworked four overlapping permissive-policy cases without broadening access:
  - `growth_attribution_events`: manager write access split into INSERT/UPDATE/DELETE; member SELECT remains.
  - `growth_autonomous_schedules`: manager write access split into INSERT/UPDATE/DELETE; member/admin SELECT remains.
  - `projects`: public SELECT remains; admin INSERT/UPDATE/DELETE remain.
  - `site_settings`: public SELECT remains; admin INSERT/UPDATE/DELETE remain.
- Supabase performance advisor now reports **0 multiple-permissive-policy warnings** and **0 duplicate-index warnings**.
- RLS remains enabled on all 98 public tables.
- 29 RLS-enabled tables without policies have no SELECT grants to `anon` or `authenticated`; these remain service-role-only.
- Supabase health advisor returned no health lints.
- The advisor currently reports 159 unused indexes. This count includes the 58 just-created FK indexes, which have not yet accumulated production query usage. Do not remove them solely from this fresh snapshot; review after representative workload.

### Source and verification repairs
- Updated verifier references to the exact remote migration filenames for governance, feedback, alerts, and scheduler migrations.
- `npm run verify:syntax`: **249 TS/TSX files checked, 0 syntax errors**.
- Focused recent Command Center verification: **107/107 checks passed** across governance, atomic execution, performance, alerts, scheduler, outcomes, and usage-order checks.
- Additional broad module verifiers were run in batches and passed through the inspected modules.
- The complete `npm run verify:all` command was attempted but exceeded the 5-minute execution window. It is therefore not certified as a single completed full-suite run.
- A Next.js production build was not run in this environment because project dependencies (`next`, `react`) are not installed here. The package does not include a lockfile in this source bundle.

## Remaining external / account actions
These cannot be completed safely or from the available project connection alone:
1. **OpenAI credits:** Production logs previously showed HTTP 429, `You have no credits remaining`. Add credits in OpenAI billing: https://platform.openai.com/settings/organization/billing/
2. **Leaked-password protection:** Supabase security advisor still reports this disabled. Enable it in Supabase Dashboard → Authentication → Settings / Password Security.
3. **GitHub worker fallback:** The 5-minute GitHub Actions workflow exists in source, but repository secrets and run history could not be verified because the connected GitHub account cannot access the Vercel-linked `anairagraphicsdigitalsolution-ui/Graphics` repository. Required secrets: `ANAIRA_GROWTH_SITE_URL`, `ANAIRA_GROWTH_CRON_SECRET`.
4. **Social publishing:** No connected rows were present in `growth_social_accounts`; connect the real Meta/Instagram/LinkedIn/YouTube accounts before attempting a live publish.
5. **Authenticated tenant-isolation and live provider E2E:** Not run. These require real test users/provider accounts and may create external side effects; no test messages or posts were sent.
6. **Two SECURITY DEFINER advisor warnings:** Retained after review because both functions contain internal authorization checks. Do not revoke grants without a dedicated authorization regression test.

## Current production status
- Vercel deployment observed previously: `READY`.
- Production app is deployed, but AI-generated briefing quality depends on replenishing OpenAI credits.
- Database performance warnings for unindexed FKs and overlapping permissive policies have been resolved.
- Remaining blockers are account configuration and live integration verification, not pending schema migration work.
