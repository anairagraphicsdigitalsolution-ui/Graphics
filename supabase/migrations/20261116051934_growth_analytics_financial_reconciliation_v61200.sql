-- v6.102.0 Module 12: tenant-scoped actual marketing spend and revenue/refund ledger.
create table if not exists public.growth_marketing_financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  entry_type text not null check (entry_type in ('spend','revenue','refund')),
  amount numeric(16,2) not null check (amount > 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  channel text not null default 'other',
  campaign_id text,
  campaign_name text,
  lead_id uuid references public.growth_leads(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','meta_ads','google_ads','crm','payment_provider','import')),
  external_ref text,
  entry_date date not null default current_date,
  status text not null default 'posted' check (status in ('posted','void')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_type <> 'refund' or lead_id is not null or external_ref is not null or campaign_id is not null)
);
create index if not exists growth_marketing_financial_org_date_idx
  on public.growth_marketing_financial_entries(organization_id,entry_date desc) where status='posted';
create index if not exists growth_marketing_financial_org_campaign_idx
  on public.growth_marketing_financial_entries(organization_id,campaign_id,currency) where status='posted';
create index if not exists growth_marketing_financial_org_type_idx
  on public.growth_marketing_financial_entries(organization_id,entry_type,entry_date desc) where status='posted';
create unique index if not exists growth_marketing_financial_external_ref_uidx
  on public.growth_marketing_financial_entries(organization_id,source,entry_type,external_ref)
  where external_ref is not null;
alter table public.growth_marketing_financial_entries enable row level security;
drop policy if exists growth_marketing_financial_manager_access on public.growth_marketing_financial_entries;
create policy growth_marketing_financial_manager_access on public.growth_marketing_financial_entries
  for all to authenticated
  using (private.is_growth_manager(organization_id))
  with check (private.is_growth_manager(organization_id));
revoke all on public.growth_marketing_financial_entries from anon;
grant select,insert,update,delete on public.growth_marketing_financial_entries to authenticated;
grant all on public.growth_marketing_financial_entries to service_role;
comment on table public.growth_marketing_financial_entries is
  'Tenant-scoped actual marketing spend, recognized revenue and refunds. Currency is retained per row; cross-currency totals must never be combined without an explicit FX rate.';
