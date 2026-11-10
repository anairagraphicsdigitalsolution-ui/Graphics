create table if not exists public.growth_ads_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  platform text not null default 'meta' check (platform = 'meta'),
  ad_account_id text not null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '[]'::jsonb,
  source_status text not null default 'synced' check (source_status in ('synced','partial','error')),
  synced_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  unique (organization_id, ad_account_id, period_start, period_end)
);
create index if not exists growth_ads_insights_org_synced_idx on public.growth_ads_insights (organization_id, synced_at desc);
alter table public.growth_ads_insights enable row level security;
drop policy if exists growth_ads_insights_tenant_select on public.growth_ads_insights;
create policy growth_ads_insights_tenant_select on public.growth_ads_insights for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_ads_insights to authenticated;
grant all on public.growth_ads_insights to service_role;
