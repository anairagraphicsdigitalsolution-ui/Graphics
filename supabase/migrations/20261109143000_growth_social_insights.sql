create table if not exists public.growth_social_insights (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 social_account_id uuid not null references public.growth_social_accounts(id) on delete cascade,
 platform text not null check (platform in ('facebook','instagram')),
 period_start date not null,
 period_end date not null,
 metrics jsonb not null default '[]'::jsonb,
 source_status text not null default 'synced' check (source_status in ('synced','partial','error')),
 synced_at timestamptz not null default now(),
 last_error text,
 created_at timestamptz not null default now(),
 unique(social_account_id,period_start,period_end)
);
create index if not exists growth_social_insights_org_synced_idx on public.growth_social_insights(organization_id,synced_at desc);
alter table public.growth_social_insights enable row level security;
drop policy if exists growth_social_insights_tenant_select on public.growth_social_insights;
create policy growth_social_insights_tenant_select on public.growth_social_insights for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_social_insights to authenticated;
grant all on public.growth_social_insights to service_role;
