create table if not exists public.growth_ad_creative_drafts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 adset_draft_id uuid references public.growth_adset_drafts(id) on delete set null,
 name text not null check(char_length(name) between 3 and 180),
 format text not null check(format in ('IMAGE','VIDEO','CAROUSEL')),
 primary_text text not null check(char_length(primary_text) between 1 and 5000),
 headline text check(headline is null or char_length(headline)<=255),
 description text check(description is null or char_length(description)<=1000),
 destination_url text not null,
 call_to_action text not null default 'LEARN_MORE',
 media_urls jsonb not null default '[]'::jsonb,
 status text not null default 'draft' check(status in ('draft','approved','submitted','failed')),
 provider_creative_id text,
 approved_by uuid,
 approved_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists growth_ad_creative_drafts_org_created_idx on public.growth_ad_creative_drafts(organization_id,created_at desc);
create index if not exists growth_ad_creative_drafts_adset_idx on public.growth_ad_creative_drafts(adset_draft_id);
alter table public.growth_ad_creative_drafts enable row level security;
drop policy if exists growth_ad_creative_drafts_select on public.growth_ad_creative_drafts;
create policy growth_ad_creative_drafts_select on public.growth_ad_creative_drafts for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_ad_creative_drafts to authenticated;
grant all on public.growth_ad_creative_drafts to service_role;
