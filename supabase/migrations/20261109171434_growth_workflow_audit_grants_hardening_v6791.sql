-- Keep workflow audit/version writes server-side; clients may only read tenant-visible rows.
revoke all on table public.growth_workflow_versions from public, anon, authenticated;
revoke all on table public.growth_workflow_run_events from public, anon, authenticated;
grant select on table public.growth_workflow_versions to authenticated;
grant select on table public.growth_workflow_run_events to authenticated;
grant all on table public.growth_workflow_versions to service_role;
grant all on table public.growth_workflow_run_events to service_role;
