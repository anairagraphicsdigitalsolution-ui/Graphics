-- Phase 31.1: tenant-controlled recurring prospect discovery and campaign analysis.
create table if not exists public.growth_autonomous_schedules (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 schedule_type text not null check (schedule_type in ('prospect_discovery','campaign_analysis')),
 name text not null check (char_length(name) between 2 and 120),
 config jsonb not null default '{}'::jsonb,
 interval_hours integer not null default 24 check (interval_hours between 24 and 720),
 enabled boolean not null default true,
 next_run_at timestamptz not null default now(),
 last_run_at timestamptz,
 locked_at timestamptz,
 attempts integer not null default 0,
 max_attempts integer not null default 4 check (max_attempts between 1 and 8),
 last_error text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists growth_autonomous_schedules_due_idx on public.growth_autonomous_schedules(enabled,next_run_at) where enabled=true;
create index if not exists growth_autonomous_schedules_org_idx on public.growth_autonomous_schedules(organization_id,created_at desc);
alter table public.growth_autonomous_schedules enable row level security;
drop policy if exists growth_autonomous_schedules_member_select on public.growth_autonomous_schedules;
create policy growth_autonomous_schedules_member_select on public.growth_autonomous_schedules for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_autonomous_schedules_manager_write on public.growth_autonomous_schedules;
create policy growth_autonomous_schedules_manager_write on public.growth_autonomous_schedules for all to authenticated using (exists(select 1 from public.growth_members m where m.organization_id=growth_autonomous_schedules.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager')) or public.is_anaira_admin()) with check (exists(select 1 from public.growth_members m where m.organization_id=growth_autonomous_schedules.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager')) or public.is_anaira_admin());
grant select,insert,update,delete on public.growth_autonomous_schedules to authenticated;
grant all on public.growth_autonomous_schedules to service_role;

create table if not exists public.growth_autonomous_schedule_runs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 schedule_id uuid not null references public.growth_autonomous_schedules(id) on delete cascade,
 schedule_type text not null,
 status text not null default 'running' check(status in ('running','completed','partial','failed')),
 result jsonb not null default '{}'::jsonb,
 error_message text,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists growth_autonomous_schedule_runs_org_idx on public.growth_autonomous_schedule_runs(organization_id,created_at desc);
create index if not exists growth_autonomous_schedule_runs_schedule_idx on public.growth_autonomous_schedule_runs(schedule_id,created_at desc);
alter table public.growth_autonomous_schedule_runs enable row level security;
drop policy if exists growth_autonomous_schedule_runs_member_select on public.growth_autonomous_schedule_runs;
create policy growth_autonomous_schedule_runs_member_select on public.growth_autonomous_schedule_runs for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_autonomous_schedule_runs to authenticated;
grant all on public.growth_autonomous_schedule_runs to service_role;

create or replace function public.claim_due_growth_autonomous_schedules(batch_limit integer default 5)
returns setof public.growth_autonomous_schedules language plpgsql security definer set search_path=public as $$
begin
 return query
 with due as (
  select s.id from public.growth_autonomous_schedules s
  join public.growth_organizations o on o.id=s.organization_id and o.status='active'
  where s.enabled=true and s.next_run_at<=now() and (s.locked_at is null or s.locked_at<now()-interval '20 minutes')
  order by s.next_run_at asc for update of s skip locked limit greatest(1,least(batch_limit,20))
 )
 update public.growth_autonomous_schedules s set locked_at=now(),attempts=s.attempts+1,updated_at=now()
 from due where s.id=due.id returning s.*;
end; $$;
revoke all on function public.claim_due_growth_autonomous_schedules(integer) from public,anon,authenticated;
grant execute on function public.claim_due_growth_autonomous_schedules(integer) to service_role;
