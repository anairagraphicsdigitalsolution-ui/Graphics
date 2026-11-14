-- Native WhatsApp Business Calling session lifecycle (outbound, consent-gated).
create table if not exists public.growth_whatsapp_call_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid not null references public.growth_leads(id) on delete cascade,
  permission_id uuid not null references public.growth_whatsapp_call_permissions(id) on delete restrict,
  phone_number_id text not null,
  recipient_phone text not null,
  provider_call_id text unique,
  call_direction text not null default 'outbound' check (call_direction in ('outbound','inbound')),
  call_status text not null default 'initiating' check (call_status in ('initiating','ringing','connected','rejected','terminated','failed','inbound_pending')),
  initiated_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  failure_code text,
  failure_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_wa_call_sessions_org_created_idx on public.growth_whatsapp_call_sessions(organization_id, created_at desc);
create index if not exists growth_wa_call_sessions_lead_created_idx on public.growth_whatsapp_call_sessions(organization_id, lead_id, created_at desc);
create unique index if not exists growth_wa_call_sessions_one_active_per_lead_idx
  on public.growth_whatsapp_call_sessions(organization_id, lead_id)
  where call_status in ('initiating','ringing','connected');
alter table public.growth_whatsapp_call_sessions enable row level security;
drop policy if exists growth_wa_call_sessions_select on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_select on public.growth_whatsapp_call_sessions for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_wa_call_sessions_insert on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_insert on public.growth_whatsapp_call_sessions for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_wa_call_sessions_update on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_update on public.growth_whatsapp_call_sessions for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin()) with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select, insert, update on public.growth_whatsapp_call_sessions to authenticated;
grant all on public.growth_whatsapp_call_sessions to service_role;
