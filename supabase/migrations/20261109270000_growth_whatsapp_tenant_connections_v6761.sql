-- Tenant-specific WhatsApp Business Platform credentials. Tokens are AES-256-GCM encrypted by the app.
create table if not exists public.growth_whatsapp_connections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.growth_organizations(id) on delete cascade,
 waba_id text,
 phone_number_id text not null unique,
 display_phone_number text,
 verified_name text,
 encrypted_credentials text not null,
 graph_api_version text not null default 'v22.0',
 connection_status text not null default 'connected' check (connection_status in ('connected','disconnected','error','expired')),
 connected_by uuid,
 last_verified_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists growth_whatsapp_connections_status_idx on public.growth_whatsapp_connections(connection_status);
alter table public.growth_whatsapp_connections enable row level security;
revoke all on public.growth_whatsapp_connections from public, anon, authenticated;
grant all on public.growth_whatsapp_connections to service_role;
