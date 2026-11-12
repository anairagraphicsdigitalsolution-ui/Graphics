create table if not exists public.growth_whatsapp_call_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid not null references public.growth_leads(id) on delete cascade,
  phone_number_id text not null,
  recipient_phone text not null,
  request_message_id text,
  permission_status text not null default 'pending' check (permission_status in ('pending','granted','rejected','expired','revoked','failed')),
  is_permanent boolean not null default false,
  expires_at timestamptz,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_wa_call_permissions_org_lead_requested_idx
  on public.growth_whatsapp_call_permissions(organization_id, lead_id, requested_at desc);
create index if not exists growth_wa_call_permissions_org_phone_status_idx
  on public.growth_whatsapp_call_permissions(organization_id, recipient_phone, permission_status, expires_at);
alter table public.growth_whatsapp_call_permissions enable row level security;
drop policy if exists growth_wa_call_permissions_select on public.growth_whatsapp_call_permissions;
create policy growth_wa_call_permissions_select on public.growth_whatsapp_call_permissions
  for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_wa_call_permissions_insert on public.growth_whatsapp_call_permissions;
create policy growth_wa_call_permissions_insert on public.growth_whatsapp_call_permissions
  for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_wa_call_permissions_update on public.growth_whatsapp_call_permissions;
create policy growth_wa_call_permissions_update on public.growth_whatsapp_call_permissions
  for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin())
  with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select, insert, update on public.growth_whatsapp_call_permissions to authenticated;
grant all on public.growth_whatsapp_call_permissions to service_role;
create index if not exists growth_wa_call_permissions_lead_fk_idx
  on public.growth_whatsapp_call_permissions(lead_id);
