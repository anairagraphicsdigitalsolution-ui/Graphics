alter table public.growth_ad_campaign_drafts add column if not exists activation_status text not null default 'paused' check (activation_status in ('paused','active','activation_failed'));
alter table public.growth_adset_drafts add column if not exists activation_status text not null default 'paused' check (activation_status in ('paused','active','activation_failed'));
alter table public.growth_ad_drafts add column if not exists activation_status text not null default 'paused' check (activation_status in ('paused','active','activation_failed'));

create table if not exists public.growth_conversion_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 event_id text not null,
 event_name text not null,
 event_time bigint not null,
 event_source_url text not null,
 action_source text not null default 'website',
 user_data_hashes jsonb not null default '{}'::jsonb,
 custom_data jsonb not null default '{}'::jsonb,
 consent_recorded boolean not null default false,
 status text not null default 'queued' check(status in ('queued','sent','failed','blocked')),
 meta_event_id text,
 meta_response jsonb,
 last_error text,
 created_by uuid,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 unique(organization_id,event_id)
);
create index if not exists growth_conversion_events_org_created_idx on public.growth_conversion_events(organization_id,created_at desc);
alter table public.growth_conversion_events enable row level security;
drop policy if exists growth_conversion_events_select on public.growth_conversion_events;
create policy growth_conversion_events_select on public.growth_conversion_events for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_conversion_events to authenticated;
grant all on public.growth_conversion_events to service_role;
