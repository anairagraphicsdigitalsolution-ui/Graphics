-- Durable tenant-scoped dead-letter queue for terminal workflow failures.
create table if not exists public.growth_workflow_dead_letters (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 run_id uuid not null references public.growth_workflow_runs(id) on delete cascade,
 rule_id uuid not null references public.growth_automation_rules(id) on delete cascade,
 lead_id uuid references public.growth_leads(id) on delete set null,
 error_message text not null default '',
 attempts integer not null default 0 check(attempts>=0 and attempts<=1000),
 failed_at timestamptz not null default now(),
 status text not null default 'open' check(status in ('open','retried','discarded')),
 resolved_at timestamptz,
 resolution text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint growth_workflow_dead_letters_run_uidx unique(run_id)
);
create index if not exists growth_workflow_dead_letters_org_status_idx
 on public.growth_workflow_dead_letters(organization_id,status,failed_at desc);
create index if not exists growth_workflow_dead_letters_rule_idx
 on public.growth_workflow_dead_letters(rule_id);
create index if not exists growth_workflow_dead_letters_lead_idx
 on public.growth_workflow_dead_letters(lead_id);
alter table public.growth_workflow_dead_letters enable row level security;
revoke all on public.growth_workflow_dead_letters from public,anon,authenticated;
grant select,update on public.growth_workflow_dead_letters to authenticated;
grant all on public.growth_workflow_dead_letters to service_role;
create policy growth_workflow_dead_letters_manager_read
 on public.growth_workflow_dead_letters for select to authenticated
 using(private.is_growth_member(organization_id));
create policy growth_workflow_dead_letters_manager_update
 on public.growth_workflow_dead_letters for update to authenticated
 using(private.is_growth_manager(organization_id))
 with check(private.is_growth_manager(organization_id));
