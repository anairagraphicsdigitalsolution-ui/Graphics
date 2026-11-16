-- Native WhatsApp Business Calling session lifecycle.
-- Keep this schema aligned with the live LiveKit-compatible database contract.
create table if not exists public.growth_whatsapp_call_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid references public.growth_leads(id) on delete set null,
  permission_id uuid references public.growth_whatsapp_call_permissions(id) on delete set null,
  phone_number_id text not null,
  recipient_phone text not null,
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  call_status text not null default 'connecting' check (call_status in ('initiating','connecting','ringing','active','connected','completed','missed','rejected','terminated','failed')),
  whatsapp_call_id text,
  room_name text not null,
  agent_name text not null default 'Anaira AI',
  provider_error text,
  webhook_event_key text,
  call_metadata jsonb not null default '{}'::jsonb,
  initiated_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  call_transcript text,
  call_summary text,
  agent_model text,
  agent_language text,
  agent_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists growth_wa_call_sessions_call_id_uq
  on public.growth_whatsapp_call_sessions(whatsapp_call_id) where whatsapp_call_id is not null;
create unique index if not exists growth_wa_call_sessions_room_uq
  on public.growth_whatsapp_call_sessions(room_name);
create index if not exists growth_wa_call_sessions_org_created_idx
  on public.growth_whatsapp_call_sessions(organization_id, created_at desc);
create index if not exists growth_wa_call_sessions_lead_idx
  on public.growth_whatsapp_call_sessions(organization_id, lead_id, created_at desc);
create unique index if not exists growth_whatsapp_call_sessions_one_active_lead_idx
  on public.growth_whatsapp_call_sessions(organization_id, lead_id)
  where lead_id is not null and call_status in ('initiating','connecting','ringing','active');
alter table public.growth_whatsapp_call_sessions enable row level security;
drop policy if exists growth_wa_call_sessions_member_select on public.growth_whatsapp_call_sessions;
drop policy if exists growth_wa_call_sessions_select on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_select on public.growth_whatsapp_call_sessions for select to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_wa_call_sessions_insert on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_insert on public.growth_whatsapp_call_sessions for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_wa_call_sessions_update on public.growth_whatsapp_call_sessions;
create policy growth_wa_call_sessions_update on public.growth_whatsapp_call_sessions for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin()) with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select, insert, update on public.growth_whatsapp_call_sessions to authenticated;
grant all on public.growth_whatsapp_call_sessions to service_role;
