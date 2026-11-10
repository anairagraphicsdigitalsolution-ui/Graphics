create table if not exists public.growth_ad_drafts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 adset_draft_id uuid not null references public.growth_adset_drafts(id) on delete cascade,
 creative_draft_id uuid not null references public.growth_ad_creative_drafts(id) on delete cascade,
 name text not null check(char_length(name) between 3 and 180),
 status text not null default 'draft' check(status in ('draft','submitted','failed')),
 provider_ad_id text,
 approved_by uuid,
 approved_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,creative_draft_id)
);
create index if not exists growth_ad_drafts_org_created_idx on public.growth_ad_drafts(organization_id,created_at desc);
alter table public.growth_ad_drafts enable row level security;
drop policy if exists growth_ad_drafts_select on public.growth_ad_drafts;
create policy growth_ad_drafts_select on public.growth_ad_drafts for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_ad_drafts to authenticated;
grant all on public.growth_ad_drafts to service_role;
