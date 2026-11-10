-- Anaira Growth Engine v6.81.1: manual payment collection and invoices
create table if not exists public.growth_manual_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete restrict,
  subscription_id uuid references public.growth_subscriptions(id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'INR' check (currency in ('INR','USD')),
  payment_method text not null check (payment_method in ('cash','upi','bank_transfer','cashfree')),
  payment_reference text,
  payer_name text,
  payer_phone text,
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  paid_at timestamptz not null default now(),
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists growth_manual_payments_org_created_idx
  on public.growth_manual_payments(organization_id, created_at desc);

create table if not exists public.growth_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  organization_id uuid not null references public.growth_organizations(id) on delete restrict,
  payment_id uuid not null unique references public.growth_manual_payments(id) on delete restrict,
  subscription_id uuid references public.growth_subscriptions(id) on delete set null,
  currency text not null default 'INR',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor > 0),
  status text not null default 'paid' check (status in ('paid','void')),
  line_items jsonb not null default '[]'::jsonb,
  payer_name text,
  payer_phone text,
  payment_method text not null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists growth_invoices_org_issued_idx
  on public.growth_invoices(organization_id, issued_at desc);

alter table public.growth_manual_payments enable row level security;
alter table public.growth_invoices enable row level security;
comment on table public.growth_manual_payments is 'Service-role only. Manual subscription payment ledger; access via platform-authorized API.';
comment on table public.growth_invoices is 'Service-role only. Issued subscription invoices; access via platform-authorized API.';
