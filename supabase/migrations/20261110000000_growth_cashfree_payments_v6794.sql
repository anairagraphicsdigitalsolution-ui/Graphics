-- Cashfree payment ledger for Growth Engine SaaS subscriptions.
create table if not exists public.growth_payment_transactions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 plan_id uuid not null references public.growth_plans(id),
 provider text not null default 'cashfree' check(provider in ('cashfree')),
 provider_order_id text not null unique,
 provider_payment_id text,
 payment_session_id text,
 amount_minor bigint not null check(amount_minor>0),
 currency text not null default 'INR' check(currency='INR'),
 billing_interval text not null check(billing_interval in ('month','year')),
 status text not null default 'created' check(status in ('created','pending','paid','failed','cancelled','expired')),
 customer_email text not null,
 customer_phone text not null,
 provider_payload jsonb not null default '{}'::jsonb,
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists growth_payment_transactions_org_created_idx on public.growth_payment_transactions(organization_id,created_at desc);
create index if not exists growth_payment_transactions_status_idx on public.growth_payment_transactions(status,created_at);
create unique index if not exists growth_payment_transactions_provider_payment_uidx on public.growth_payment_transactions(provider_payment_id) where provider_payment_id is not null;
create table if not exists public.growth_payment_webhook_events (
 id uuid primary key default gen_random_uuid(),
 provider text not null default 'cashfree' check(provider='cashfree'),
 event_key text not null unique,
 event_type text not null,
 provider_order_id text,
 payload jsonb not null default '{}'::jsonb,
 processed_at timestamptz not null default now()
);
alter table public.growth_payment_transactions enable row level security;
alter table public.growth_payment_webhook_events enable row level security;
revoke all on public.growth_payment_transactions,public.growth_payment_webhook_events from public,anon,authenticated;
grant all on public.growth_payment_transactions,public.growth_payment_webhook_events to service_role;
