# Module 6 migration status — v6.96.0

Supabase project: `nrsdqrqkffhbicfskilb` (Mine Own)

| Version | Migration | Result |
|---|---|---|
| 20261116040854 | growth_social_management_v6960 | Applied successfully |
| 20261116040940 | growth_social_comment_reply_claim_v6960b | Applied successfully |
| 20261116041244 | growth_social_comment_outcome_unknown_v6960c | Applied successfully |
| 20261116041334 | growth_social_table_privilege_lockdown_v6960d | Applied successfully |

Live verification:
- `growth_social_accounts`: 19 columns (including the five new account-health fields).
- `growth_social_posts`: 13 columns; RLS enabled; tenant SELECT policy present.
- `growth_social_comments`: 24 columns after both follow-up migrations; RLS enabled; tenant SELECT policy present.
- Reply-claim follow-up adds `reply_claimed_at`, `reply_claimed_by`, and the `replying` status.
- Outcome-unknown follow-up adds a terminal `outcome_unknown` state for ambiguous provider acceptance; public replies are not blindly retried.
- Live grant verification confirms authenticated receives SELECT only; anon has no privileges; service_role retains server-side CRUD. This was explicitly hardened after checking live `role_table_grants`.
