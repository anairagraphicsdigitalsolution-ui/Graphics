-- Module 15: credential rotation metadata and platform integration audit trail.
alter table public.growth_integrations
  add column if not exists credential_version integer not null default 1,
  add column if not exists credential_rotated_at timestamptz;
alter table public.growth_platform_integrations
  add column if not exists credential_version integer not null default 1,
  add column if not exists credential_rotated_at timestamptz,
  add column if not exists last_success_at timestamptz;
update public.growth_integrations
set credential_rotated_at = coalesce(credential_rotated_at, updated_at)
where encrypted_credentials is not null and credential_rotated_at is null;
update public.growth_platform_integrations
set credential_rotated_at = coalesce(credential_rotated_at, updated_at)
where encrypted_credentials is not null and credential_rotated_at is null;
create table if not exists public.growth_platform_integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null check (event_type in ('credential_saved','credential_rotated','credential_removed','connection_test','connection_recovered','connection_failed')),
  status text not null check (status in ('success','failed','validation_only')),
  message text not null,
  http_status integer,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists growth_platform_integration_events_provider_created_idx
  on public.growth_platform_integration_events(provider,created_at desc);
alter table public.growth_platform_integration_events enable row level security;
drop policy if exists growth_platform_integration_events_no_client_access on public.growth_platform_integration_events;
create policy growth_platform_integration_events_no_client_access
  on public.growth_platform_integration_events for all to anon,authenticated
  using (false) with check (false);
revoke all on public.growth_platform_integration_events from anon,authenticated;
grant all on public.growth_platform_integration_events to service_role;
comment on table public.growth_platform_integration_events is
  'Redacted audit history for Anaira platform-owned provider credential lifecycle and connection tests. Never stores credential values or authorization headers.';
