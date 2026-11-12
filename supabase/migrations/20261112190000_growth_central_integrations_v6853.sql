-- Central, tenant-scoped integration credential vault.
-- Secrets are AES-256-GCM encrypted by the application before they reach Postgres.
create table if not exists public.growth_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','google','google_cse','meta','whatsapp','instagram','twilio','resend','cashfree','youtube','linkedin','anthropic','gemini','razorpay','smtp')),
  display_name text not null,
  encrypted_credentials text not null,
  settings jsonb not null default '{}'::jsonb,
  connection_status text not null default 'saved' check (connection_status in ('not_configured','saved','connected','error')),
  last_tested_at timestamptz,
  last_error text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create index if not exists growth_integrations_org_idx on public.growth_integrations(organization_id, provider);
alter table public.growth_integrations enable row level security;
drop policy if exists "growth_integrations_no_client_access" on public.growth_integrations;
create policy "growth_integrations_no_client_access" on public.growth_integrations for all using (false) with check (false);
