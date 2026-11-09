-- Phase 2: operational CRM, approval queue, follow-up tasks and campaign controls.
-- Safe additive migration; does not modify portfolio CMS tables.
alter table public.growth_leads
  add column if not exists lead_score integer not null default 50 check (lead_score between 0 and 100),
  add column if not exists follow_up_at timestamptz,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists growth_leads_org_status_created_idx on public.growth_leads(organization_id,status,created_at desc);
create index if not exists growth_leads_follow_up_idx on public.growth_leads(organization_id,follow_up_at) where follow_up_at is not null;
create index if not exists growth_campaigns_org_status_idx on public.growth_campaigns(organization_id,status,created_at desc);
create index if not exists growth_automation_org_enabled_idx on public.growth_automation_rules(organization_id,enabled);

create table if not exists public.growth_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid references public.growth_leads(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'follow_up' check (task_type in ('follow_up','call','email','meeting','review','other')),
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_tasks_org_status_due_idx on public.growth_tasks(organization_id,status,due_at);
create index if not exists growth_tasks_lead_idx on public.growth_tasks(lead_id);
alter table public.growth_tasks enable row level security;
drop policy if exists growth_tasks_tenant_select on public.growth_tasks;
create policy growth_tasks_tenant_select on public.growth_tasks for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_tasks_tenant_insert on public.growth_tasks;
create policy growth_tasks_tenant_insert on public.growth_tasks for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_tasks_tenant_update on public.growth_tasks;
create policy growth_tasks_tenant_update on public.growth_tasks for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin()) with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_tasks_tenant_delete on public.growth_tasks;
create policy growth_tasks_tenant_delete on public.growth_tasks for delete to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select,insert,update,delete on public.growth_tasks to authenticated;
grant update on public.growth_leads to authenticated;
