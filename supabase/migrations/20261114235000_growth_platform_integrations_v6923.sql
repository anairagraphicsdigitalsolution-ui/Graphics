-- v6.92.3: Separate Anaira-owned developer credentials from tenant BYOK credentials.
create table if not exists public.growth_platform_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('openai','google_cse','meta_app','google_oauth_app','google_ads_developer','zerobounce','twilio_lookup','resend_platform')),
  display_name text not null,
  encrypted_credentials text not null,
  settings jsonb not null default '{}'::jsonb,
  connection_status text not null default 'saved' check (connection_status in ('not_configured','saved','connected','error')),
  last_tested_at timestamptz,
  last_error text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_platform_integrations_provider_idx on public.growth_platform_integrations(provider);
alter table public.growth_platform_integrations enable row level security;
drop policy if exists growth_platform_integrations_no_client_access on public.growth_platform_integrations;
create policy growth_platform_integrations_no_client_access on public.growth_platform_integrations for all to authenticated using (false) with check (false);
-- Extend tenant provider catalog for customer-owned Google Ads OAuth and ZeroBounce keys.
alter table public.growth_integrations drop constraint if exists growth_integrations_provider_check;
alter table public.growth_integrations add constraint growth_integrations_provider_check check (provider in ('openai','google','google_cse','google_ads','zerobounce','meta','whatsapp','instagram','twilio','resend','cashfree','youtube','linkedin','anthropic','gemini','razorpay','smtp'));
alter table public.growth_integration_events drop constraint if exists growth_integration_events_provider_check;
alter table public.growth_integration_events add constraint growth_integration_events_provider_check check (provider in ('openai','google','google_cse','google_ads','zerobounce','meta','whatsapp','instagram','twilio','resend','cashfree','youtube','linkedin','anthropic','gemini','razorpay','smtp'));
revoke all on public.growth_platform_integrations from anon, authenticated;
grant all on public.growth_platform_integrations to service_role;
