-- v6.99.0 Website Intelligence: first-party visitor events and lead-form capture.
create table if not exists public.growth_website_tracking_keys (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade,
 key_hash text not null unique,
 key_prefix text not null,
 is_active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create unique index if not exists growth_website_tracking_one_active_idx on public.growth_website_tracking_keys(website_id) where is_active;
create index if not exists growth_website_tracking_org_site_idx on public.growth_website_tracking_keys(organization_id,website_id,is_active);
alter table public.growth_website_tracking_keys enable row level security;
drop policy if exists growth_website_tracking_manager_read on public.growth_website_tracking_keys;
create policy growth_website_tracking_manager_read on public.growth_website_tracking_keys for select to authenticated using (
 exists(select 1 from public.growth_members m where m.organization_id=growth_website_tracking_keys.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager'))
);
revoke all on public.growth_website_tracking_keys from anon,authenticated;
grant select on public.growth_website_tracking_keys to authenticated;
grant all on public.growth_website_tracking_keys to service_role;

create table if not exists public.growth_website_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade,
 event_id text not null,
 visitor_id text not null,
 session_id text not null,
 event_name text not null check(event_name in ('page_view','form_start','form_submit','chat_open','conversion')),
 page_url text not null default '',
 referrer text not null default '',
 utm_source text,
 utm_medium text,
 utm_campaign text,
 utm_term text,
 utm_content text,
 gclid text,
 gbraid text,
 wbraid text,
 event_data jsonb not null default '{}'::jsonb check(jsonb_typeof(event_data)='object'),
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(website_id,event_id)
);
create index if not exists growth_website_events_org_time_idx on public.growth_website_events(organization_id,website_id,occurred_at desc);
create index if not exists growth_website_events_org_event_idx on public.growth_website_events(organization_id,website_id,event_name,occurred_at desc);
create index if not exists growth_website_events_session_idx on public.growth_website_events(website_id,session_id,occurred_at);
alter table public.growth_website_events enable row level security;
drop policy if exists growth_website_events_manager_read on public.growth_website_events;
create policy growth_website_events_manager_read on public.growth_website_events for select to authenticated using (
 exists(select 1 from public.growth_members m where m.organization_id=growth_website_events.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','editor','viewer','client'))
);
revoke all on public.growth_website_events from anon,authenticated;
grant select on public.growth_website_events to authenticated;
grant all on public.growth_website_events to service_role;

create table if not exists public.growth_website_form_submissions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade,
 lead_id uuid references public.growth_leads(id) on delete set null,
 form_key text not null,
 visitor_id text,
 page_url text not null default '',
 consent_to_contact boolean not null default false,
 attribution jsonb not null default '{}'::jsonb check(jsonb_typeof(attribution)='object'),
 created_at timestamptz not null default now()
);
create index if not exists growth_website_forms_org_time_idx on public.growth_website_form_submissions(organization_id,website_id,created_at desc);
alter table public.growth_website_form_submissions enable row level security;
drop policy if exists growth_website_forms_manager_read on public.growth_website_form_submissions;
create policy growth_website_forms_manager_read on public.growth_website_form_submissions for select to authenticated using (
 exists(select 1 from public.growth_members m where m.organization_id=growth_website_form_submissions.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','editor','viewer','client'))
);
revoke all on public.growth_website_form_submissions from anon,authenticated;
grant select on public.growth_website_form_submissions to authenticated;
grant all on public.growth_website_form_submissions to service_role;

comment on table public.growth_website_events is 'First-party, consent-aware website event stream. Visitor and session IDs are pseudonymous random identifiers; no IP address is stored.';
comment on table public.growth_website_form_submissions is 'Website form-to-CRM conversion records; contact consent is recorded independently from form submission.';
