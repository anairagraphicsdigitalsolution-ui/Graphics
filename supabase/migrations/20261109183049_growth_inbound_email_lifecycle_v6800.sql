-- Inbound email routing and provider event lifecycle for AI Growth Engine.
create table if not exists public.growth_inbound_email_addresses (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 email_address text not null,
 is_active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique (email_address),
 unique (id, organization_id)
);
create index if not exists growth_inbound_email_org_idx
 on public.growth_inbound_email_addresses(organization_id, is_active);
alter table public.growth_inbound_email_addresses enable row level security;
revoke all on public.growth_inbound_email_addresses from public, anon, authenticated;
grant all on public.growth_inbound_email_addresses to service_role;

create table if not exists public.growth_email_provider_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.growth_organizations(id) on delete cascade,
 provider_event_id text not null unique,
 event_type text not null,
 recipient_email text,
 sender_email text,
 provider_email_id text,
 payload jsonb not null default '{}'::jsonb,
 processed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists growth_email_provider_events_org_created_idx
 on public.growth_email_provider_events(organization_id, created_at desc);
create index if not exists growth_email_provider_events_recipient_idx
 on public.growth_email_provider_events(recipient_email, created_at desc);
alter table public.growth_email_provider_events enable row level security;
revoke all on public.growth_email_provider_events from public, anon, authenticated;
grant all on public.growth_email_provider_events to service_role;

alter table public.growth_leads
 add column if not exists email_bounced_at timestamptz,
 add column if not exists email_complained_at timestamptz;
create index if not exists growth_leads_email_delivery_state_idx
 on public.growth_leads(organization_id, email) where email_bounced_at is not null or email_complained_at is not null;
