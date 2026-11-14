-- v6.89.4: tenant-scoped CRM meetings and proposal lifecycle.
create table if not exists public.growth_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid not null references public.growth_leads(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  agenda text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  meeting_mode text not null default 'online' check (meeting_mode in ('online','phone','in_person')),
  location text,
  meeting_url text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (meeting_mode <> 'online' or meeting_url is null or meeting_url ~* '^https://')
);
create index if not exists growth_meetings_org_start_idx on public.growth_meetings(organization_id, starts_at desc);
create index if not exists growth_meetings_lead_start_idx on public.growth_meetings(organization_id, lead_id, starts_at desc);

create table if not exists public.growth_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  lead_id uuid not null references public.growth_leads(id) on delete cascade,
  reference_no text not null,
  title text not null check (char_length(title) between 1 and 180),
  summary text,
  line_items jsonb not null default '[]'::jsonb check (jsonb_typeof(line_items) = 'array'),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','sent','accepted','rejected','expired','cancelled')),
  valid_until date,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference_no)
);
create index if not exists growth_proposals_org_status_idx on public.growth_proposals(organization_id, status, created_at desc);
create index if not exists growth_proposals_lead_idx on public.growth_proposals(organization_id, lead_id, created_at desc);

alter table public.growth_meetings enable row level security;
alter table public.growth_proposals enable row level security;
revoke all on table public.growth_meetings, public.growth_proposals from anon, authenticated;
grant all on table public.growth_meetings, public.growth_proposals to service_role;
