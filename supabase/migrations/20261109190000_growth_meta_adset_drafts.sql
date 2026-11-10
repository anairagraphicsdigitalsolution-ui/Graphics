create table if not exists public.growth_adset_drafts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 campaign_draft_id uuid not null references public.growth_ad_campaign_drafts(id) on delete cascade,
 name text not null check(char_length(name) between 3 and 180),
 optimization_goal text not null,
 billing_event text not null default 'IMPRESSIONS',
 daily_budget_minor bigint,
 start_time timestamptz,
 end_time timestamptz,
 targeting jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check(status in ('draft','approved','submitted','failed')),
 provider_adset_id text,
 approved_by uuid,
 approved_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists growth_adset_drafts_campaign_idx on public.growth_adset_drafts(organization_id,campaign_draft_id,created_at desc);
alter table public.growth_adset_drafts enable row level security;
drop policy if exists growth_adset_drafts_select on public.growth_adset_drafts;
create policy growth_adset_drafts_select on public.growth_adset_drafts for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_adset_drafts to authenticated;
grant all on public.growth_adset_drafts to service_role;
