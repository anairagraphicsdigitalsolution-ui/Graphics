-- v6.84.9: discovery provenance and outbound voice call audit foundation
alter table public.growth_prospects add column if not exists discovery_query text;
alter table public.growth_prospects add column if not exists discovered_at timestamptz;
alter table public.growth_prospects add column if not exists website_domain text;
create index if not exists growth_prospects_org_domain_idx on public.growth_prospects(organization_id,website_domain) where website_domain is not null;
create table if not exists public.growth_voice_call_attempts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 lead_id uuid not null references public.growth_leads(id) on delete cascade,
 provider text not null check(provider in ('twilio')),
 provider_call_id text,
 destination_phone text not null,
 call_status text not null default 'initiated' check(call_status in ('initiated','queued','ringing','in_progress','completed','busy','failed','no_answer','canceled')),
 script_text text not null,
 consent_verified_at timestamptz not null,
 initiated_by uuid references auth.users(id) on delete set null,
 provider_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists growth_voice_calls_org_created_idx on public.growth_voice_call_attempts(organization_id,created_at desc);
create index if not exists growth_voice_calls_lead_created_idx on public.growth_voice_call_attempts(lead_id,created_at desc);
alter table public.growth_voice_call_attempts enable row level security;
drop policy if exists growth_voice_call_attempts_select on public.growth_voice_call_attempts;
create policy growth_voice_call_attempts_select on public.growth_voice_call_attempts for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_voice_call_attempts to authenticated;
grant all on public.growth_voice_call_attempts to service_role;
