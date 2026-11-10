-- Workflow snapshots are written only by trusted server-side service-role APIs.
drop policy if exists growth_workflow_versions_insert on public.growth_workflow_versions;
