-- AI Review Management: tenant-isolated review sync, reply drafts and fair review requests.
create table if not exists public.growth_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 provider text not null default 'google',
 provider_review_id text not null,
 account_name text,
 location_name text,
 reviewer_name text,
 reviewer_photo_url text,
 rating smallint check (rating between 1 and 5),
 review_text text not null default '',
 review_time timestamptz,
 update_time timestamptz,
 reply_text text,
 reply_update_time timestamptz,
 ai_reply_draft text,
 ai_sentiment text check (ai_sentiment in ('positive','neutral','negative','mixed') or ai_sentiment is null),
 ai_topics jsonb not null default '[]'::jsonb,
 moderation_status text not null default 'normal' check (moderation_status in ('normal','needs_attention','possible_policy_violation','reported')),
 last_synced_at timestamptz not null default now(),
 raw_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id, provider, provider_review_id)
);
create index if not exists growth_reviews_org_time_idx on public.growth_reviews(organization_id, review_time desc);
create index if not exists growth_reviews_org_rating_idx on public.growth_reviews(organization_id, rating);

create table if not exists public.growth_review_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 customer_name text not null,
 customer_email text,
 customer_phone text,
 channel text not null check (channel in ('email','whatsapp','sms','manual')),
 status text not null default 'draft' check (status in ('draft','sent','failed','cancelled')),
 request_message text not null,
 review_url text,
 sent_at timestamptz,
 provider_message_id text,
 failure_reason text,
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (customer_email is not null or customer_phone is not null or channel = 'manual')
);
create index if not exists growth_review_requests_org_created_idx on public.growth_review_requests(organization_id, created_at desc);

create table if not exists public.growth_review_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 review_id uuid references public.growth_reviews(id) on delete set null,
 request_id uuid references public.growth_review_requests(id) on delete set null,
 event_type text not null,
 status text not null default 'success',
 details jsonb not null default '{}'::jsonb,
 actor_user_id uuid,
 created_at timestamptz not null default now()
);
create index if not exists growth_review_events_org_created_idx on public.growth_review_events(organization_id, created_at desc);

alter table public.growth_reviews enable row level security;
alter table public.growth_review_requests enable row level security;
alter table public.growth_review_events enable row level security;

drop policy if exists growth_reviews_member_select on public.growth_reviews;
create policy growth_reviews_member_select on public.growth_reviews for select to authenticated
 using (exists(select 1 from public.growth_members m where m.organization_id = growth_reviews.organization_id and m.user_id = (select auth.uid())));
drop policy if exists growth_review_requests_member_select on public.growth_review_requests;
create policy growth_review_requests_member_select on public.growth_review_requests for select to authenticated
 using (exists(select 1 from public.growth_members m where m.organization_id = growth_review_requests.organization_id and m.user_id = (select auth.uid())));
drop policy if exists growth_review_events_member_select on public.growth_review_events;
create policy growth_review_events_member_select on public.growth_review_events for select to authenticated
 using (exists(select 1 from public.growth_members m where m.organization_id = growth_review_events.organization_id and m.user_id = (select auth.uid())));

grant select on public.growth_reviews, public.growth_review_requests, public.growth_review_events to authenticated;
grant all on public.growth_reviews, public.growth_review_requests, public.growth_review_events to service_role;
