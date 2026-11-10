-- Tenant-scoped invitation lifecycle. Service-role only; no browser access.
create table if not exists public.growth_team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  invited_email text not null,
  invited_user_id uuid,
  invited_role text not null check (invited_role in ('manager','editor','viewer','client')),
  invited_by uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_team_inv_org_created_idx on public.growth_team_invitations(organization_id, created_at desc);
create index if not exists growth_team_inv_email_status_idx on public.growth_team_invitations(lower(invited_email), status);
alter table public.growth_team_invitations enable row level security;
revoke all on public.growth_team_invitations from public, anon, authenticated;
grant all on public.growth_team_invitations to service_role;

create table if not exists public.growth_platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.growth_organizations(id) on delete set null,
  actor_user_id uuid,
  event_type text not null,
  target_user_id uuid,
  target_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists growth_platform_audit_org_created_idx on public.growth_platform_audit_events(organization_id,created_at desc);
alter table public.growth_platform_audit_events enable row level security;
revoke all on public.growth_platform_audit_events from public, anon, authenticated;
grant all on public.growth_platform_audit_events to service_role;
