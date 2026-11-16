-- v6.93.7: explicitly enforce service-role-only access to platform invoice ledgers.
-- These tables contain billing PII and are accessed only through platform-authorized server APIs.
alter table public.growth_manual_payments enable row level security;
alter table public.growth_invoices enable row level security;

revoke all on table public.growth_manual_payments, public.growth_invoices
  from public, anon, authenticated;
grant all on table public.growth_manual_payments, public.growth_invoices
  to service_role;

comment on table public.growth_manual_payments is
  'Service-role only. Manual subscription payment ledger; access via platform-authorized API.';
comment on table public.growth_invoices is
  'Service-role only. Issued subscription invoices; access via platform-authorized API.';
