-- Immutable workflow versions, run event history, and controlled recovery.
alter table public.growth_automation_rules
  add column if not exists version integer not null default 1,
  add column if not exists published_version integer,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.growth_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  rule_id uuid not null references public.growth_automation_rules(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  trigger_type text not null,
  workflow_steps jsonb not null check (jsonb_typeof(workflow_steps) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(rule_id, version),
  unique(id, organization_id)
);
create index if not exists growth_workflow_versions_org_rule_idx
  on public.growth_workflow_versions(organization_id, rule_id, version desc);
alter table public.growth_workflow_versions enable row level security;
drop policy if exists growth_workflow_versions_select on public.growth_workflow_versions;
create policy growth_workflow_versions_select on public.growth_workflow_versions
  for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_workflow_versions_insert on public.growth_workflow_versions;
create policy growth_workflow_versions_insert on public.growth_workflow_versions
  for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select, insert on public.growth_workflow_versions to authenticated;
grant all on public.growth_workflow_versions to service_role;

create table if not exists public.growth_workflow_run_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  run_id uuid not null references public.growth_workflow_runs(id) on delete cascade,
  rule_id uuid not null references public.growth_automation_rules(id) on delete cascade,
  step_index integer check (step_index is null or step_index >= 0),
  event_type text not null check (event_type in ('run_started','step_started','step_succeeded','step_waiting','step_skipped','step_failed','run_succeeded','run_failed','run_retried','run_cancelled','run_simulated')) ,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists growth_workflow_run_events_org_run_idx
  on public.growth_workflow_run_events(organization_id, run_id, created_at);
create index if not exists growth_workflow_run_events_rule_idx
  on public.growth_workflow_run_events(rule_id);
alter table public.growth_workflow_run_events enable row level security;
drop policy if exists growth_workflow_run_events_select on public.growth_workflow_run_events;
create policy growth_workflow_run_events_select on public.growth_workflow_run_events
  for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_workflow_run_events to authenticated;
grant all on public.growth_workflow_run_events to service_role;
