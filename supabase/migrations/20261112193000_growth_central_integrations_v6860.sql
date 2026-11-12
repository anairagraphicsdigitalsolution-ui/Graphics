-- v6.86.0 central integration health and provider test audit trail.
alter table public.growth_integrations
  add column if not exists token_expires_at timestamptz,
  add column if not exists last_success_at timestamptz;

create table if not exists public.growth_integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','google','google_cse','meta','whatsapp','instagram','twilio','resend','cashfree','youtube','linkedin','anthropic','gemini','razorpay','smtp')),
  event_type text not null,
  status text not null check (status in ('success','failed','validation_only','warning','pending')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists growth_integration_events_org_created_idx
  on public.growth_integration_events (organization_id, created_at desc);
create index if not exists growth_integration_events_provider_created_idx
  on public.growth_integration_events (provider, created_at desc);
alter table public.growth_integration_events enable row level security;
drop policy if exists "growth_integration_events_no_client_access" on public.growth_integration_events;
create policy "growth_integration_events_no_client_access"
  on public.growth_integration_events for all using (false) with check (false);

-- Existing credentials stay encrypted; direct browser access is intentionally denied.
