create table if not exists public.growth_strategy_plans (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 title text not null, objective text not null, audience text, budget_monthly numeric(12,2), channels text[] not null default '{}', plan jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check(status in ('draft','approved','archived')), created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.growth_prospects (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 company_name text not null, contact_name text, website text, email text, phone text, industry text, location text, source text not null default 'manual',
 notes text, status text not null default 'new' check(status in ('new','reviewed','qualified','converted','disqualified')),
 consent_to_contact boolean not null default false, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id, website)
);
create index if not exists growth_strategy_org_created_idx on public.growth_strategy_plans(organization_id,created_at desc);
create index if not exists growth_prospects_org_status_idx on public.growth_prospects(organization_id,status,created_at desc);
alter table public.growth_strategy_plans enable row level security;
alter table public.growth_prospects enable row level security;
drop policy if exists growth_strategy_member_select on public.growth_strategy_plans;
create policy growth_strategy_member_select on public.growth_strategy_plans for select to authenticated using (exists(select 1 from public.growth_members m where m.organization_id=growth_strategy_plans.organization_id and m.user_id=auth.uid()));
drop policy if exists growth_prospects_member_select on public.growth_prospects;
create policy growth_prospects_member_select on public.growth_prospects for select to authenticated using (exists(select 1 from public.growth_members m where m.organization_id=growth_prospects.organization_id and m.user_id=auth.uid()));
grant select on public.growth_strategy_plans, public.growth_prospects to authenticated;
grant all on public.growth_strategy_plans, public.growth_prospects to service_role;
