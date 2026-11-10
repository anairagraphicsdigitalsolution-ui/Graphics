# Live Supabase Verification — v6.79.0

Project: Anaira Graphics & Digital Solution  
Project ref: `nrsdqrqkffhbicfskilb`  
Region: `ap-northeast-1`

## Applied migrations
1. `growth_workflow_versions_and_runs_v679` — version snapshots, workflow run events, version metadata columns and indexes.
2. `growth_workflow_audit_grants_hardening_v6791` — revokes direct client write grants; authenticated receives SELECT only; service_role retains server-side privileges.
3. `growth_workflow_version_policy_hardening_v6792` — removes the now-unneeded authenticated INSERT policy for immutable workflow snapshots.

## Verified live schema
- `growth_workflow_versions`: exists, RLS enabled.
- `growth_workflow_run_events`: exists, RLS enabled.
- `growth_automation_rules.version`: integer.
- `growth_automation_rules.published_version`: integer.
- `growth_automation_rules.updated_at`: timestamptz.
- Supporting indexes: `growth_workflow_versions_org_rule_idx`, `growth_workflow_run_events_org_run_idx`, `growth_workflow_run_events_rule_idx`.

## Verified access model
- `growth_workflow_versions`: authenticated SELECT only; service_role full privileges.
- `growth_workflow_run_events`: authenticated SELECT only; service_role full privileges.
- `anon`: no direct SELECT/INSERT/UPDATE/DELETE grants on either table.
- RLS policies scope authenticated reads through `private.is_growth_member(organization_id)` or platform-admin access.

## Notes
This verifies schema, RLS flags, policies, indexes and grants. It does not constitute a multi-user penetration test or provider E2E certification. No customer data was modified by the verification queries.
