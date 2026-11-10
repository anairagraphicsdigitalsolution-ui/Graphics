create table if not exists public.growth_ad_campaign_drafts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 platform text not null default 'meta' check (platform='meta'),
 ad_account_id text not null,
 name text not null check (char_length(name) between 3 and 180),
 objective text not null,
 daily_budget_minor bigint,
 currency text not null default 'INR',
 special_ad_categories jsonb not null default '[]'::jsonb,
 status text not null default 'draft' check (status in ('draft','approved','submitted','rejected','failed')),
 provider_campaign_id text,
 approved_by uuid,
 approved_at timestamptz,
 submitted_at timestamptz,
 last_error text,
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists growth_ad_campaign_drafts_org_created_idx on public.growth_ad_campaign_drafts(organization_id,created_at desc);
alter table public.growth_ad_campaign_drafts enable row level security;
drop policy if exists growth_ad_campaign_drafts_select on public.growth_ad_campaign_drafts;
create policy growth_ad_campaign_drafts_select on public.growth_ad_campaign_drafts for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_ad_campaign_drafts to authenticated;
grant all on public.growth_ad_campaign_drafts to service_role;
