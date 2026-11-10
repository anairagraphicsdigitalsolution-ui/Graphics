-- Multi-step, tenant-scoped workflow runtime. Existing single-action rules remain compatible.
alter table public.growth_automation_rules
  add column if not exists workflow_steps jsonb not null default '[]'::jsonb;

create table if not exists public.growth_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  rule_id uuid not null references public.growth_automation_rules(id) on delete cascade,
  lead_id uuid references public.growth_leads(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  current_step integer not null default 0 check (current_step >= 0),
  steps jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  next_run_at timestamptz not null default now(),
  locked_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_workflow_runs_due_idx
  on public.growth_workflow_runs(status,next_run_at) where status in ('queued','running');
create index if not exists growth_workflow_runs_org_created_idx
  on public.growth_workflow_runs(organization_id,created_at desc);

alter table public.growth_workflow_runs enable row level security;
drop policy if exists growth_workflow_runs_tenant_select on public.growth_workflow_runs;
create policy growth_workflow_runs_tenant_select on public.growth_workflow_runs
  for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_workflow_runs_tenant_insert on public.growth_workflow_runs;
create policy growth_workflow_runs_tenant_insert on public.growth_workflow_runs
  for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_workflow_runs_tenant_update on public.growth_workflow_runs;
create policy growth_workflow_runs_tenant_update on public.growth_workflow_runs
  for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin())
  with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select,insert,update on public.growth_workflow_runs to authenticated;
grant all on public.growth_workflow_runs to service_role;

-- Atomic claim prevents two overlapping cron invocations from executing the same workflow run.
create or replace function public.claim_due_growth_workflow_runs(batch_limit integer default 10)
returns setof public.growth_workflow_runs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with due as (
    select id from public.growth_workflow_runs
    where status in ('queued','running') and next_run_at <= now()
      and (locked_at is null or locked_at < now() - interval '10 minutes')
    order by next_run_at, created_at
    for update skip locked
    limit greatest(1,least(coalesce(batch_limit,10),50))
  )
  update public.growth_workflow_runs r
    set status='running', locked_at=now(), attempts=attempts+1,
        started_at=coalesce(started_at,now()), updated_at=now()
  from due where r.id=due.id
  returning r.*;
end;
$$;
revoke all on function public.claim_due_growth_workflow_runs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_growth_workflow_runs(integer) to service_role;
