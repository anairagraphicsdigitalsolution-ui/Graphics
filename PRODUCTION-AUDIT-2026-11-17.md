# Anaira AI Growth Engine v6.124.6 — Production Audit

Audit date: 2026-11-17  
Supabase project: `nrsdqrqkffhbicfskilb`  
Vercel project: `anaira-graphics-portfolio`  
Production domain: `https://graphics.anairapos.in`

## Database changes applied

The following migrations were applied to the live Supabase project and recorded in migration history:

- `20261117034519_growth_command_action_governance_v62200`
- `20261117034528_growth_sms_quota_support_v61246`
- `20261117034628_growth_command_action_feedback_v62000`
- `20261117034631_growth_command_action_alerts_v62400`
- `20261117034633_growth_command_center_scheduler_v62500`
- `20261117034807_growth_rls_initplan_performance_hardening`
- `20261117034818_growth_seo_tasks_rls_initplan_hardening`
- `20261117034842_growth_prospects_duplicate_index_cleanup`
- `20261117035933_growth_fk_indexes_and_rls_policy_overlap_cleanup`

The last migration adds 58 indexes for previously unindexed foreign keys and separates four overlapping `ALL` policies into INSERT/UPDATE/DELETE policies while preserving their SELECT policies and authorization predicates.

## Verification after the last migration

- Public tables: 98; RLS enabled: 98; RLS disabled: 0.
- Added FK indexes: 58.
- Supabase performance advisor: 0 `unindexed_foreign_keys`, 0 `multiple_permissive_policies`, 0 `duplicate_index` findings.
- Supabase health advisor: 0 health lints.
- Security advisor: 29 `rls_enabled_no_policy` INFO findings; verified earlier that these service-role-only tables have no anon/authenticated SELECT grants. Two SECURITY DEFINER function warnings remain and were not blindly revoked because one is used by policy authorization and the other has internal authorization checks. One Auth warning remains: leaked-password protection is disabled and must be enabled in Supabase Auth settings.
- Performance advisor still reports 159 unused indexes (INFO). These are not dropped because a short usage window is not sufficient evidence that an index is unnecessary.
- The 58 new FK indexes are present in `pg_indexes`.

## Source verification

- `VERIFY-ALL-v6.124.6.log`: 1,825 PASS assertions, 0 FAIL.
- Syntax verification: 249 TS/TSX files, 0 syntax errors.
- Focused latest checks: usage-order 6/6; automation stale-lease null guard 8/8; AI credit fallback 8/8.
- Vercel production deployment `dpl_vscqADL7K4r1nSzHQ5tCh7jwGnoX` was READY and its build events report `Build Completed in /vercel/output [1m]`. This certifies the deployed Git commit `10231889322336f1fded10cbebe579d428f2b45c`, not the post-build database migration package or an authenticated end-to-end test.
- Local `npm install` timed out in this environment; local dependency-backed build was therefore not run. No clean-install lockfile is present in this source package.

## Outstanding production certification

1. OpenAI daily briefing encountered HTTP 429 / no API credits. Fund the OpenAI Platform organization or configure a funded workspace key.
2. Social provider publishing is not live-certified; no connected social-account rows were present during the prior audit. Connect and verify each intended provider account.
3. GitHub Actions worker cadence cannot be certified. The repository `anairagraphicsdigitalsolution-ui/Graphics` is linked to Vercel but is not visible to the currently connected GitHub account. The workflow requires GitHub secrets `ANAIRA_GROWTH_SITE_URL` and `ANAIRA_GROWTH_CRON_SECRET`. Vercel Hobby cron remains daily at 03:00 UTC in `vercel.json`.
4. Enable Supabase Auth leaked-password protection in the Auth dashboard.
5. Run authenticated browser E2E with two separate tenants, including cross-tenant denial, provider OAuth refresh/revocation, outbound consent checks, webhook replay, worker retry/DLQ, billing reconciliation, backup/restore and incident recovery.
6. Live WhatsApp native Calling media/signalling, approved provider capabilities, and real account eligibility must be certified with Meta/provider test accounts; code presence alone is not certification.
7. Production deployment of this updated ZIP was not performed because the connected GitHub identity cannot access the Vercel-linked `Graphics` repository.

Do not treat this audit as a 100% production certification. The database issues above are fixed; external credentials, account permissions, live E2E and deployment of this exact source package remain gates.

## v6.124.7 follow-up — Customer Retention

Applied and verified migration `20261117060000_growth_retention_multichannel_v61310` on project `nrsdqrqkffhbicfskilb`. The retention channel constraint now permits `email`, `whatsapp`, and `sms`; `template_id` and the channel/status index exist. Source supports approved WhatsApp templates and SMS queueing with consent/policy checks. No external provider credentials were added and no messages were sent.
